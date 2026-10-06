import mongoose from 'mongoose';
import LiveSession from '../model/liveSession.js';
import { audit } from './audit.js';
import { getStreamClient, playerUrl } from './cloudflareStream.js';

// The live broadcast's state (docs/LIVE.md): what the public status says, how a session ends, the automatic end of a
// forgotten one. The routes are route/admin/live.js (dashboard) and route/liveRoute.js (public).

/** A broadcast that is still "live" after this long is ended automatically (the admin's browser died, a tab stayed open). */
export const LIVE_MAX_MS = 6 * 60 * 60 * 1000;
/** How long the public status is answered from memory: viewers poll it, the database is asked at most this often. */
export const STATUS_CACHE_MS = 5_000;

const SYSTEM = { auditActor: { username: 'system', role: 'system' }, ip: undefined, headers: {} };

const actorOf = (user) => (user ? { id: user.id ?? null, name: String(user.username ?? '').slice(0, 100) } : { id: null, name: 'system' });
const iso = (value) => (value ? new Date(value).toISOString() : null);

/** What the dashboard sees of a session. Never the WHIP address (it is not stored). */
export function adminView(doc) {
  if (!doc) return null;
  return {
    _id: String(doc._id),
    title: doc.title,
    status: doc.status,
    inputUid: doc.inputUid,
    whepUrl: doc.whepUrl,
    playbackUrl: playerUrl(doc.whepUrl, doc.inputUid),
    startedAt: iso(doc.startedAt),
    endedAt: iso(doc.endedAt),
    endReason: doc.endReason ?? null,
    startedBy: { id: doc.startedBy?.id ? String(doc.startedBy.id) : null, name: doc.startedBy?.name ?? '' },
    endedBy: doc.endedBy?.name ? { id: doc.endedBy.id ? String(doc.endedBy.id) : null, name: doc.endedBy.name } : null,
    inputDeleted: Boolean(doc.inputDeleted),
  };
}

// ---- the public status, from memory for a few seconds ----

let statusCache = null; // { at, body }

export function resetLiveStatusCache() {
  statusCache = null;
}

/** What every visitor may know: is a broadcast on, its title, since when, and where to watch it. */
export function publicStatus(doc) {
  const playback = doc ? playerUrl(doc.whepUrl, doc.inputUid) : null;
  if (!doc || doc.status !== 'live' || !playback) return { live: false };
  return { live: true, title: doc.title, startedAt: iso(doc.startedAt), playbackUrl: playback };
}

export async function liveStatus(now = Date.now()) {
  if (statusCache && now - statusCache.at < STATUS_CACHE_MS) return statusCache.body;
  await endStaleSessions({ now });
  const current = await LiveSession.findOne({ status: 'live' }).lean();
  const body = publicStatus(current);
  statusCache = { at: now, body };
  return body;
}

// ---- ending a session ----

/** Deletes the Cloudflare input, best effort: a failure is logged (by name and id, never an address) and kept in the record. */
export async function deleteInputQuietly(uid) {
  const client = getStreamClient();
  if (!client || !uid) return false;
  try {
    await client.deleteLiveInput(uid);
    return true;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [live] could not delete the Cloudflare live input ${String(uid).slice(0, 64)}: ${err?.message ?? 'unknown error'}`);
    return false;
  }
}

/**
 * Ends a live session once (an atomic status change: two stops at the same moment end it once), deletes its
 * Cloudflare input, writes the audit entry. Returns the ended session, or null when it was not live any more.
 */
export async function endSession(session, { reason, user = null, req = SYSTEM, now = Date.now() } = {}) {
  const ended = await LiveSession.findOneAndUpdate(
    { _id: session._id, status: 'live' },
    { $set: { status: 'ended', endedAt: new Date(now), endReason: reason, endedBy: actorOf(user) } },
    { new: true },
  ).lean();
  if (!ended) return null;
  resetLiveStatusCache();
  const inputDeleted = await deleteInputQuietly(ended.inputUid);
  if (inputDeleted) await LiveSession.updateOne({ _id: ended._id }, { $set: { inputDeleted: true } });
  const minutes = Math.max(0, Math.round((now - new Date(ended.startedAt).getTime()) / 60_000));
  await audit(req, reason === 'auto' ? 'live.auto_end' : 'live.stop', { type: 'live', id: String(ended._id) }, { reason, minutes, inputDeleted });
  return { ...ended, inputDeleted };
}

/** Ends every session that has been live for longer than LIVE_MAX_MS. Called on reads and by a timer (index.js). */
export async function endStaleSessions({ now = Date.now() } = {}) {
  // mongoose.trusted: the server runs with sanitizeFilter, which would otherwise turn $lt into an equality test.
  const stale = await LiveSession.find({ status: 'live', startedAt: mongoose.trusted({ $lt: new Date(now - LIVE_MAX_MS) }) }).lean();
  for (const session of stale) await endSession(session, { reason: 'auto', now });
  return stale.length;
}

