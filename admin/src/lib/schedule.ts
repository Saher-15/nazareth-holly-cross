// Scheduled broadcasts in the dashboard (docs/LIVE.md "Scheduled broadcasts"). Times are typed and shown in NAZARETH
// time whatever the admin's own clock says; the API converts them to UTC (server/services/liveSchedule.js). The same
// conversion runs here only to check the form before sending (and the API checks again).

import type { ScheduledBroadcast } from './api';

export const NAZARETH_TIME_ZONE = 'Asia/Jerusalem';
export const SCHEDULE_TITLE_MAX = 120;
export const SCHEDULE_DESCRIPTION_MAX = 500;
/** A time may be up to five minutes in the past (the time it takes to fill in the form): the API's rule. */
export const PAST_TOLERANCE_MS = 5 * 60_000;
/** At most about a year ahead: the API's rule (400 days). */
export const MAX_AHEAD_MS = 400 * 24 * 3600_000;
/** "Go live" suggests the scheduled broadcast that starts within this much of now. */
export const MATCH_WINDOW_MS = 2 * 3600_000;
/** A broadcast still "scheduled" this long after its start was missed. */
export const MISSED_AFTER_MS = 2 * 3600_000;

const HOUR = 3600_000;
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const wallFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: NAZARETH_TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** The wall-clock time in Nazareth at the instant `ms`, written as if it were UTC (milliseconds). */
function wallClockAt(ms: number): number {
  const parts = Object.fromEntries(wallFormat.formatToParts(new Date(ms)).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
}

const offsetAt = (ms: number) => wallClockAt(ms) - Math.floor(ms / 1000) * 1000;

/** What a datetime-local field gives ("2026-10-20T19:30", sometimes with seconds) -> "2026-10-20T19:30", or ''. */
export function normalizeLocal(value: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2}(\.\d+)?)?$/.exec(value.trim());
  return m ? m[1] : '';
}

/**
 * "2026-10-20T19:30" in Nazareth -> the UTC instant, or null when it is not a real date and time. The two days a year
 * the clock changes, like the API: a skipped time (spring, 02:00-02:59) moves forward by the gap; a repeated time
 * (autumn, 01:00-01:59) is the first one.
 */
export function nazarethToUtc(local: string): Date | null {
  const m = LOCAL.exec(local);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wall);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  const candidates = [...new Set([offsetAt(wall - 24 * HOUR), offsetAt(wall + 24 * HOUR)])]
    .map((offset) => wall - offset)
    .filter((t) => wallClockAt(t) === wall)
    .sort((a, b) => a - b);
  if (candidates.length) return new Date(candidates[0]);
  return new Date(wall - offsetAt(wall - 24 * HOUR));
}

/** The instant -> "YYYY-MM-DDTHH:MM" in Nazareth (a datetime-local value). */
export function utcToNazarethLocal(value: string | number | Date): string {
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return '';
  return new Date(wallClockAt(ms)).toISOString().slice(0, 16);
}

export type ScheduleProblem = 'format' | 'past' | 'tooFar';

/** The API's checks of a start time, before sending. */
export function scheduleTimeProblem(local: string, now = Date.now()): ScheduleProblem | null {
  const date = nazarethToUtc(normalizeLocal(local));
  if (!date) return 'format';
  if (date.getTime() < now - PAST_TOLERANCE_MS) return 'past';
  if (date.getTime() > now + MAX_AHEAD_MS) return 'tooFar';
  return null;
}

/** The scheduled broadcast "Go live" most likely fulfils: still waiting, starting within two hours of now, the closest. */
export function matchScheduled<T extends Pick<ScheduledBroadcast, 'status' | 'startsAt'>>(items: T[], now = Date.now()): T | null {
  let best: T | null = null;
  let bestGap = Infinity;
  for (const item of items) {
    if (item.status !== 'scheduled') continue;
    const gap = Math.abs(new Date(item.startsAt).getTime() - now);
    if (Number.isFinite(gap) && gap <= MATCH_WINDOW_MS && gap < bestGap) {
      best = item;
      bestGap = gap;
    }
  }
  return best;
}

/** "scheduled" more than two hours after its start: nobody went live for it. */
export function isMissed(item: Pick<ScheduledBroadcast, 'status' | 'startsAt'>, now = Date.now()): boolean {
  return item.status === 'scheduled' && new Date(item.startsAt).getTime() < now - MISSED_AFTER_MS;
}

/** The status shown in the list: the API's, or "missed". */
export type ScheduleDisplayStatus = ScheduledBroadcast['status'] | 'missed';
export const displayStatus = (item: Pick<ScheduledBroadcast, 'status' | 'startsAt'>, now = Date.now()): ScheduleDisplayStatus =>
  isMissed(item, now) ? 'missed' : item.status;

/** Whether a clock in `timeZone` shows another time than Nazareth's at the instant `iso`. */
export function differsFromNazareth(iso: string, timeZone: string): boolean {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms) || !timeZone) return false;
  try {
    const fmt = (zone: string) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, dateStyle: 'short', timeStyle: 'short' }).format(ms);
    return fmt(timeZone) !== fmt(NAZARETH_TIME_ZONE);
  } catch {
    return false;
  }
}
