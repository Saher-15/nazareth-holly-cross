import CandleVideo from '../model/candleVideo.js';
import { audit } from './audit.js';
import { getStreamClient, recordingStateOf, StreamError, videoPlayerUrl, videoThumbnailUrl } from './cloudflareStream.js';
import { UPLOAD_GIVE_UP_MS } from './liveRecordings.js';

// The candle page's videos (model/candleVideo.js, docs/ADMIN.md 5.5). The browser uploads the file straight to Cloudflare
// Stream; this module keeps the database in step with Cloudflare and serves the website's list.

export const MAX_CANDLE_VIDEOS = 20;
export const MAX_CANDLE_VIDEO_BYTES = 2 * 1024 ** 3; // 2 GB: a short film of the candles, not a whole broadcast
export const MAX_CANDLE_VIDEO_SECONDS = 30 * 60;
export const PUBLIC_CACHE_MS = 60_000;

const SYSTEM = { auditActor: { username: 'system', role: 'system' }, ip: undefined, headers: {} };
const iso = (value) => (value ? new Date(value).toISOString() : null);

export function candleVideoAdminView(doc) {
  return {
    id: String(doc._id),
    title: doc.title,
    status: doc.status,
    failReason: doc.failReason ?? null,
    published: Boolean(doc.published),
    publishedAt: iso(doc.publishedAt),
    sizeBytes: doc.sizeBytes ?? 0,
    durationSeconds: Math.max(0, Math.round(Number(doc.durationSeconds) || 0)),
    createdAt: iso(doc.createdAt),
    createdBy: doc.createdBy?.name ?? '',
    playbackUrl: doc.status === 'ready' ? videoPlayerUrl(doc.customerCode, doc.cfVideoUid) : null,
    thumbnailUrl: doc.status === 'ready' ? videoThumbnailUrl(doc.customerCode, doc.cfVideoUid) : null,
  };
}

export function candleVideoPublicView(doc) {
  const playbackUrl = videoPlayerUrl(doc.customerCode, doc.cfVideoUid);
  const thumbnailUrl = videoThumbnailUrl(doc.customerCode, doc.cfVideoUid);
  if (!playbackUrl || !thumbnailUrl) return null;
  return {
    id: String(doc._id),
    title: doc.title,
    durationSeconds: Math.max(0, Math.round(Number(doc.durationSeconds) || 0)),
    thumbnailUrl,
    playbackUrl,
  };
}

let publicCache = null; // { at, body }

export function resetCandleVideosCache() {
  publicCache = null;
}

// The website's list: published and ready, newest first. Cached for a minute, dropped on every change.
export async function publicCandleVideos(now = Date.now()) {
  if (publicCache && now - publicCache.at < PUBLIC_CACHE_MS) return publicCache.body;
  const docs = await CandleVideo.find({ published: true, status: 'ready' }).sort({ createdAt: -1 }).limit(MAX_CANDLE_VIDEOS).lean();
  const body = docs.map(candleVideoPublicView).filter(Boolean);
  publicCache = { at: now, body };
  return body;
}

// Asks Cloudflare how far an unfinished video got (uploading -> processing -> ready, or failed). Never throws for a
// Cloudflare problem: the video is simply checked again on the next read.
export async function refreshCandleVideo(doc, { now = Date.now() } = {}) {
  const client = getStreamClient();
  if (!client || !['uploading', 'processing'].includes(doc.status)) return doc;
  let video = null;
  let missing = false;
  try {
    video = await client.getVideo(doc.cfVideoUid);
  } catch (err) {
    if (!(err instanceof StreamError) || err.status !== 404) {
      await CandleVideo.updateOne({ _id: doc._id }, { $set: { checkedAt: new Date(now) } });
      return doc;
    }
    missing = true;
  }
  const changes = { checkedAt: new Date(now) };
  let next = doc.status;
  if (missing) {
    if (doc.status === 'processing' || now - new Date(doc.createdAt ?? now).getTime() > UPLOAD_GIVE_UP_MS) {
      next = 'failed';
      changes.failReason = 'missing at Cloudflare';
    }
  } else {
    const state = recordingStateOf(video);
    if (state === 'failed') {
      next = 'failed';
      changes.failReason = `Cloudflare could not encode it${video.errorReason ? ` (${video.errorReason})` : ''}`.slice(0, 120);
    } else if (state === 'ready' || state === 'processing') next = state;
    if (video.durationSeconds !== null && video.durationSeconds > 0) changes.durationSeconds = video.durationSeconds;
    if (video.customerCode && video.customerCode !== doc.customerCode) changes.customerCode = video.customerCode;
  }
  if (next !== doc.status) changes.status = next;
  if (next === 'failed') changes.published = false;
  const updated = await CandleVideo.findOneAndUpdate({ _id: doc._id, status: doc.status }, { $set: changes }, { new: true }).lean();
  if (!updated) return (await CandleVideo.findById(doc._id).lean()) ?? doc;
  if (changes.status) {
    resetCandleVideosCache();
    await audit(SYSTEM, 'candle_video.status', { type: 'candleVideo', id: String(doc._id) }, { from: doc.status, to: next });
  }
  return updated;
}
