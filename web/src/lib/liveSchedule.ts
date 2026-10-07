import { API_URL } from './config';
import { OBJECT_ID } from './liveStatus';
import { decodeEntities } from './plainText';
import { dateLocale, NAZARETH_TIME_ZONE } from './time';

// The broadcasts announced from the dashboard (docs/LIVE.md): GET /live/schedule answers
//   { timeZone: 'Asia/Jerusalem', items: [{ id, title, description, startsAt (ISO, UTC), status: 'scheduled' | 'live' }] }
// (published, starting after now - 2 h, soonest first, at most 10). The /live page reads it on the server (lib/api.ts,
// for the HTML and the structured data) and once more in the browser when the page opens; it is never polled.
// Anything unexpected is dropped item by item (an item without a valid id, title or start); an API without the route
// (404) or one that is down means "nothing announced", never made-up data. Other features that list the announced
// broadcasts read them through `parseSchedule` and the `ScheduledBroadcast` type of this module.

/** How long after its start a broadcast that has not gone live is still awaited ("Starting soon"). */
export const STARTING_SOON_MS = 30 * 60_000;
/** While a broadcast is awaited, the page asks for the live status this often (lib/liveStatusStore.ts). */
export const STARTING_SOON_POLL_MS = 10_000;
/** The length written into a calendar entry (an announced broadcast has a start, not an end). */
export const CALENDAR_EVENT_MS = 60 * 60_000;

export type ScheduledBroadcast = {
  /** 24 hex. */
  id: string;
  /** Decoded text (the API stores what the team typed HTML-escaped): render it as text only. */
  title: string;
  /** May be empty. */
  description: string;
  /** Start, milliseconds since the epoch. */
  start: number;
  /** "live": started from the dashboard (shown as live only when the live status agrees). */
  status: 'scheduled' | 'live';
};

const MAX_ITEMS = 50;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** The `items` array of an answer (at most 50), or nothing. */
export const itemsOf = (json: unknown): unknown[] => (isRecord(json) && Array.isArray(json.items) ? json.items.slice(0, MAX_ITEMS) : []);

/** A non-empty string of at most `max` characters, decoded once; null otherwise. */
export const apiText = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() && value.length <= max ? decodeEntities(value.trim()) : null;

/** An ISO date as milliseconds; null when it is not one. */
export const apiTime = (value: unknown): number | null =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

/** GET /live/schedule -> the announced broadcasts, soonest first. */
export function parseSchedule(json: unknown): ScheduledBroadcast[] {
  const items = itemsOf(json).flatMap((raw): ScheduledBroadcast[] => {
    if (!isRecord(raw)) return [];
    const id = typeof raw.id === 'string' && OBJECT_ID.test(raw.id) ? raw.id : null;
    const title = apiText(raw.title, 400);
    const start = apiTime(raw.startsAt);
    if (!id || !title || start === null) return [];
    const description = apiText(raw.description, 2000) ?? '';
    return [{ id, title, description, start, status: raw.status === 'live' ? 'live' : 'scheduled' }];
  });
  return items.sort((a, b) => a.start - b.start);
}

/**
 * One read of a public live route from the browser, without cookies. A 404 (an API that does not have the route yet)
 * is an empty answer; any other failure is null, and the caller keeps what the server rendered.
 */
export async function readInBrowser<T>(path: string, parse: (json: unknown) => T, fetchImpl: typeof fetch = fetch): Promise<T | null> {
  try {
    const res = await fetchImpl(`${API_URL}${path}`, { headers: { Accept: 'application/json' }, credentials: 'omit' });
    if (res.status === 404) return parse({ items: [] });
    if (!res.ok) return null;
    return parse(await res.json());
  } catch {
    return null;
  }
}

export const fetchScheduleInBrowser = (fetchImpl?: typeof fetch) => readInBrowser('/live/schedule', parseSchedule, fetchImpl);

// ---- dates and times (the same on the server and in the browser; Western digits in every language) ----

const dateTimeOptions: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  numberingSystem: 'latn',
};

/** "Sunday 25 October 2026 at 10:00" in Nazareth time (or in `timeZone`), in the page language. */
export function formatBroadcastTime(start: number, locale: string, timeZone: string = NAZARETH_TIME_ZONE): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { ...dateTimeOptions, timeZone }).format(start);
}

/** An announced broadcast with its start already written in Nazareth time and the page language. */
export type BroadcastView = ScheduledBroadcast & { when: string };

/** The label of a broadcast: the same function on the server (for the HTML) and in the browser. */
export const broadcastView = (item: ScheduledBroadcast, locale: string): BroadcastView => ({
  ...item,
  when: formatBroadcastTime(item.start, locale),
});

/**
 * The start in the visitor's own time zone, with the zone's name, or null when the visitor's clock shows the same time
 * as Nazareth's then (one line says it all). `timeZone` defaults to the browser's own: call it in the browser only,
 * after hydration (the server does not know the visitor's zone).
 */
export function formatVisitorTime(start: number, locale: string, timeZone?: string): string | null {
  const zone = timeZone ?? new Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (formatBroadcastTime(start, locale, zone) === formatBroadcastTime(start, locale)) return null;
  return new Intl.DateTimeFormat(dateLocale(locale), { ...dateTimeOptions, timeZone: zone, timeZoneName: 'short' }).format(start);
}

// ---- the countdown ----

export type CountdownParts = { days: number; hours: number; minutes: number; seconds: number };

/** Splits a remaining time into whole days, hours, minutes and seconds (never negative). */
export function countdownParts(ms: number): CountdownParts {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

export type CountdownSummary = { kind: 'days' | 'hours' | 'minutes'; days: number; hours: number; minutes: number };

/**
 * What screen readers get instead of the ticking numbers; it changes at most once a minute: days and hours while more
 * than a day is left, hours and minutes under a day, minutes under an hour (rounded up, so never "0 minutes").
 */
export function countdownSummary(ms: number): CountdownSummary {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return { kind: days ? 'days' : hours ? 'hours' : 'minutes', days, hours, minutes };
}

export type StagePhase = 'countdown' | 'soon';

export type ScheduleView<T extends ScheduledBroadcast = ScheduledBroadcast> = {
  /** The broadcast shown large at the top of /live (none while a broadcast is live: the player is there). */
  next: T | null;
  /** Counting down to it, or past its start and waiting for it to go live ("Starting soon"). */
  phase: StagePhase | null;
  /** The other broadcasts still to come (and, while a broadcast is live, the announced one that is live). */
  others: T[];
};

/**
 * What the stage shows at `now`. A broadcast stays "next" for half an hour after its announced start, then makes way for
 * the following one. While a broadcast is live (the live status says so, not the schedule) there is no countdown.
 */
export function scheduleView<T extends ScheduledBroadcast>(items: readonly T[], now: number, isLive: boolean): ScheduleView<T> {
  const next = isLive ? null : (items.find((item) => now < item.start + STARTING_SOON_MS) ?? null);
  const phase: StagePhase | null = next ? (now < next.start ? 'countdown' : 'soon') : null;
  const others = items.filter((item) => item !== next && (item.start > now || (isLive && item.status === 'live')));
  return { next, phase, others };
}
