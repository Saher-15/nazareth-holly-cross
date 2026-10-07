import mongoose from 'mongoose';
import LiveRecording from '../model/liveRecording.js';
import { audit } from './audit.js';
import { getStreamClient, recordingStateOf, StreamError, videoPlayerUrl, videoThumbnailUrl } from './cloudflareStream.js';

// Recordings of live broadcasts (docs/LIVE.md "Recordings"): what the dashboard and the website see of one, the
// status check against Cloudflare, the storage figure, and the website's list (answered from memory for a short while).
// The routes are route/admin/liveRecordings.js and route/liveRoute.js.

/** Cloudflare Stream storage: 5 US dollars per 1,000 minutes stored per month (docs/LIVE.md, Costs). */
export const STORAGE_PRICE_PER_1000_MINUTES = 5;
/** The account's plan (Stream > 1,000 minutes), used when Cloudflare does not say. */
export const DEFAULT_STORAGE_LIMIT_MINUTES = 1000;
/** How long the website's list is answered from memory. */
export const RECORDINGS_CACHE_MS = 60_000;
/** How often the dashboard's list asks Cloudflare about one unfinished video, at most. */
export const CHECK_EVERY_MS = 10_000;
/** How many unfinished videos one dashboard read checks with Cloudflare. */
export const CHECKS_PER_READ = 10;
/** An upload that never reached Cloudflare is given up after this long. */
export const UPLOAD_GIVE_UP_MS = 48 * 3600_000;
/** At most this many recordings on the website. */
export const PUBLIC_LIMIT = 50;

const SYSTEM = { auditActor: { username: 'system', role: 'system' }, ip: undefined, headers: {} };
const iso = (value) => (value ? new Date(value).toISOString() : null);

/** What the dashboard sees of a recording. Never the upload address (it is not stored). */
export function recordingAdminView(doc) {
  if (!doc) return null;
  return {
    _id: String(doc._id),
    session: doc.session ? String(doc.session) : null,
    title: doc.title,
    liveStartedAt: iso(doc.liveStartedAt),
    liveEndedAt: iso(doc.liveEndedAt),
    durationSeconds: Math.max(0, Math.round(Number(doc.durationSeconds) || 0)),
    sizeBytes: Math.max(0, Number(doc.sizeBytes) || 0),
    mimeType: doc.mimeType ?? '',
    cfVideoUid: doc.cfVideoUid,
    status: doc.status,
    failReason: doc.failReason ?? null,
    published: Boolean(doc.published),
    publishedAt: iso(doc.publishedAt),
    thumbnailUrl: videoThumbnailUrl(doc.customerCode, doc.cfVideoUid),
    playbackUrl: videoPlayerUrl(doc.customerCode, doc.cfVideoUid),
    createdBy: { id: doc.createdBy?.id ? String(doc.createdBy.id) : null, name: doc.createdBy?.name ?? '' },
    createdAt: iso(doc.createdAt),
  };
}

/** What every visitor may know of a published recording (null when its player address cannot be built). */
export function recordingPublicView(doc) {
  const playbackUrl = videoPlayerUrl(doc.customerCode, doc.cfVideoUid);
  const thumbnailUrl = videoThumbnailUrl(doc.customerCode, doc.cfVideoUid);
  if (!playbackUrl || !thumbnailUrl) return null;
  return {
    id: String(doc._id),
    title: doc.title,
    date: iso(doc.liveStartedAt),
    durationSeconds: Math.max(0, Math.round(Number(doc.durationSeconds) || 0)),
    thumbnailUrl,
    playbackUrl,
  };
}

// ---- the website's list ----

let publicCache = null; // { at, body }

export function resetRecordingsCache() {
  publicCache = null;
}

/** GET /live/recordings: published and ready, newest broadcast first. */
export async function publicRecordings(now = Date.now()) {
  if (publicCache && now - publicCache.at < RECORDINGS_CACHE_MS) return publicCache.body;
  const docs = await LiveRecording.find({ published: true, status: 'ready' }).sort({ liveStartedAt: -1, _id: -1 }).limit(PUBLIC_LIMIT).lean();
  const body = { items: docs.map(recordingPublicView).filter(Boolean) };
  publicCache = { at: now, body };
  return body;
}

// ---- Cloudflare's view of a video ----

/**
 * Asks Cloudflare how far a video is and saves what changed: processing -> ready (with Cloudflare's duration) or
 * failed. Never moves a recording backwards (a browser that said "uploaded" stays "processing" while Cloudflare still
 * says "pendingupload"). A Cloudflare failure leaves the recording as it was. Returns the (possibly updated) document.
 */
export async function refreshRecording(doc, { now = Date.now() } = {}) {
  const client = getStreamClient();
  if (!client || !['uploading', 'processing'].includes(doc.status)) return doc;
  let video = null;
  let missing = false;
  try {
    video = await client.getVideo(doc.cfVideoUid);
  } catch (err) {
    if (!(err instanceof StreamError) || err.status !== 404) {
      await LiveRecording.updateOne({ _id: doc._id }, { $set: { checkedAt: new Date(now) } });
      return doc;
    }
    missing = true;
  }

  const changes = { checkedAt: new Date(now) };
  let next = doc.status;
  if (missing) {
    // Cloudflare forgets an upload address that was never used. A recording it had accepted and lost is a failure; one
    // still uploading is given some time (the browser can ask for a new address).
    if (doc.status === 'processing' || now - new Date(doc.createdAt ?? now).getTime() > UPLOAD_GIVE_UP_MS) {
      next = 'failed';
      changes.failReason = 'missing at Cloudflare';
    }
  } else {
    const state = recordingStateOf(video);
    if (state === 'ready') next = 'ready';
    else if (state === 'failed') {
      next = 'failed';
      changes.failReason = `Cloudflare could not encode it${video.errorReason ? ` (${video.errorReason})` : ''}`.slice(0, 120);
    } else if (state === 'processing') next = 'processing';
    if (video.durationSeconds !== null && video.durationSeconds > 0) changes.durationSeconds = video.durationSeconds;
    if (video.customerCode && video.customerCode !== doc.customerCode) changes.customerCode = video.customerCode;
  }
  if (next !== doc.status) changes.status = next;
  if (next === 'failed') changes.published = false;

  const updated = await LiveRecording.findOneAndUpdate({ _id: doc._id, status: doc.status }, { $set: changes }, { new: true }).lean();
  if (!updated) return (await LiveRecording.findById(doc._id).lean()) ?? doc;
  if (changes.status) {
    resetRecordingsCache();
    await audit(SYSTEM, 'live.recording_status', { type: 'liveRecording', id: String(doc._id) }, { from: doc.status, to: next, videoUid: doc.cfVideoUid });
  }
  return updated;
}

/** Checks the unfinished recordings of a list with Cloudflare (a few per read, none checked in the last seconds). */
export async function refreshUnfinished(docs, { now = Date.now() } = {}) {
  const due = docs
    .filter((d) => ['uploading', 'processing'].includes(d.status) && (!d.checkedAt || now - new Date(d.checkedAt).getTime() >= CHECK_EVERY_MS))
    .slice(0, CHECKS_PER_READ);
  if (!due.length) return docs;
  const fresh = new Map((await Promise.all(due.map((d) => refreshRecording(d, { now })))).map((d) => [String(d._id), d]));
  return docs.map((d) => fresh.get(String(d._id)) ?? d);
}

// ---- storage ----

let storageCache = null; // { at, body }
const STORAGE_CACHE_MS = 60_000;

export function resetStorageCache() {
  storageCache = null;
}

/**
 * Minutes of video stored at Cloudflare (Cloudflare's own figure when it answers, else the sum of our recordings),
 * the plan's limit and the price, for the dashboard.
 */
export async function storageSummary(now = Date.now()) {
  if (storageCache && now - storageCache.at < STORAGE_CACHE_MS) return storageCache.body;
  const client = getStreamClient();
  let body = null;
  if (client) {
    try {
      const usage = await client.storageUsage();
      if (usage.minutes !== null) {
        body = { usedMinutes: Math.round(usage.minutes), limitMinutes: usage.limitMinutes || DEFAULT_STORAGE_LIMIT_MINUTES, videos: usage.videos, source: 'cloudflare' };
      }
    } catch {
      // the estimate below
    }
  }
  if (!body) {
    const kept = await LiveRecording.find({ status: mongoose.trusted({ $in: ['processing', 'ready'] }) }).select('durationSeconds').lean();
    const seconds = kept.reduce((sum, d) => sum + (Number(d.durationSeconds) || 0), 0);
    body = { usedMinutes: Math.round(seconds / 60), limitMinutes: DEFAULT_STORAGE_LIMIT_MINUTES, videos: kept.length, source: 'estimate' };
  }
  body.pricePer1000Minutes = STORAGE_PRICE_PER_1000_MINUTES;
  storageCache = { at: now, body };
  return body;
}

/** Deletes a Cloudflare video, best effort: a failure is logged (by id) and reported as false. */
export async function deleteVideoQuietly(uid) {
  const client = getStreamClient();
  if (!client || !uid) return false;
  try {
    await client.deleteVideo(uid);
    return true;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [live] could not delete the Cloudflare video ${String(uid).slice(0, 64)}: ${err?.message ?? 'unknown error'}`);
    return false;
  }
}
