import mongoose from 'mongoose';
import ScheduledBroadcast from '../model/scheduledBroadcast.js';
import { NAZARETH_TIME_ZONE } from './liveConstants.js';

// Scheduled broadcasts (docs/LIVE.md "Scheduled broadcasts"): Nazareth wall time <-> UTC, what the dashboard and the
// website see of an item, and the website's list of upcoming broadcasts (answered from memory for a short while).

const HOUR = 3600_000;
/** A scheduled item stays on the website this long after its start (the broadcast may start a little late). */
export const PUBLIC_GRACE_MS = 2 * HOUR;
/** At most this many upcoming broadcasts on the website. */
export const PUBLIC_LIMIT = 10;
/** How long the public list is answered from memory. */
export const SCHEDULE_CACHE_MS = 30_000;
/** How far ahead a broadcast may be scheduled. */
export const MAX_AHEAD_MS = 400 * 24 * HOUR;

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const wallFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: NAZARETH_TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** The wall-clock time in Nazareth at the instant `ms`, written as if it were UTC (milliseconds). */
function wallClockAt(ms) {
  const parts = Object.fromEntries(wallFormat.formatToParts(new Date(ms)).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
}

/** Nazareth's offset from UTC at the instant `ms` (milliseconds: +2 h in winter, +3 h in summer). */
export const nazarethOffsetAt = (ms) => wallClockAt(ms) - Math.floor(ms / 1000) * 1000;

/**
 * "2026-10-20T19:30" typed in Nazareth time -> the UTC instant (a Date), or null when it is not a real date and time.
 * The two days a year the clock changes:
 *   - a time that does not exist (spring: 02:00-02:59 is skipped) moves forward by the gap (02:30 -> 03:30);
 *   - a time that happens twice (autumn: 01:00-01:59 is repeated) is the first one (summer time).
 */
export function nazarethToUtc(local) {
  const m = LOCAL.exec(String(local ?? ''));
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wall);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  const candidates = [...new Set([nazarethOffsetAt(wall - 24 * HOUR), nazarethOffsetAt(wall + 24 * HOUR)])]
    .map((offset) => wall - offset)
    .filter((t) => wallClockAt(t) === wall)
    .sort((a, b) => a - b);
  if (candidates.length) return new Date(candidates[0]);
  // In the gap: the offset before the change gives the instant that the clock shows one hour later.
  return new Date(wall - nazarethOffsetAt(wall - 24 * HOUR));
}

/** The UTC instant -> "YYYY-MM-DDTHH:MM" in Nazareth (what an <input type="datetime-local"> shows). */
export function utcToNazarethLocal(value) {
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(wallClockAt(ms)).toISOString().slice(0, 16);
}

const iso = (value) => (value ? new Date(value).toISOString() : null);
const actorView = (a) => ({ id: a?.id ? String(a.id) : null, name: a?.name ?? '' });

/** What the dashboard sees of a scheduled broadcast. */
export function scheduleAdminView(doc) {
  if (!doc) return null;
  return {
    _id: String(doc._id),
    title: doc.title,
    description: doc.description ?? '',
    startsAt: iso(doc.startsAt),
    startsAtLocal: utcToNazarethLocal(doc.startsAt),
    timeZone: NAZARETH_TIME_ZONE,
    published: Boolean(doc.published),
    status: doc.status,
    liveSession: doc.liveSession ? String(doc.liveSession) : null,
    createdBy: actorView(doc.createdBy),
    updatedAt: iso(doc.updatedAt),
  };
}

/** What every visitor may know of a published, upcoming broadcast. */
export const schedulePublicView = (doc) => ({
  id: String(doc._id),
  title: doc.title,
  description: doc.description ?? '',
  startsAt: iso(doc.startsAt),
  status: doc.status,
});

let publicCache = null; // { at, body }

export function resetScheduleCache() {
  publicCache = null;
}

/** GET /live/schedule: published, still to come (or started less than two hours ago, or live), soonest first. */
export async function publicSchedule(now = Date.now()) {
  if (publicCache && now - publicCache.at < SCHEDULE_CACHE_MS) return publicCache.body;
  const docs = await ScheduledBroadcast.find({
    published: true,
    status: mongoose.trusted({ $in: ['scheduled', 'live'] }),
    startsAt: mongoose.trusted({ $gt: new Date(now - PUBLIC_GRACE_MS) }),
  }).sort({ startsAt: 1, _id: 1 }).limit(PUBLIC_LIMIT).lean();
  const body = { timeZone: NAZARETH_TIME_ZONE, items: docs.map(schedulePublicView) };
  publicCache = { at: now, body };
  return body;
}

/** The end of a live broadcast: the scheduled item it was started from is done. */
export async function finishScheduledFor(sessionId) {
  if (!sessionId) return 0;
  const result = await ScheduledBroadcast.updateMany({ liveSession: sessionId, status: 'live' }, { $set: { status: 'done' } });
  if (result?.modifiedCount) resetScheduleCache();
  return result?.modifiedCount ?? 0;
}
