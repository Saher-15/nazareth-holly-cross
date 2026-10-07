import './zodConfig';
import { z } from 'zod';
import { ApiError, getJson } from './api';
import { decodeEntities } from './plainText';

// The broadcasts the team schedules in the dashboard, as the Christian calendar of /live shows them
// (docs/LITURGICAL-CALENDAR.md). The API answers GET /live/schedule (docs/LIVE.md, added by the live-recordings work)
//
//   { timeZone: 'Asia/Jerusalem', items: [{ id, title, description, startsAt, status }] }   (a bare array is read too)
//
// with the published broadcasts still to come. This adapter is the only place that knows that shape. It is written
// so the calendar works before the API has the route: a 404 (or any failure, or a slow answer) means "no broadcasts",
// it never throws, it never makes the page wait more than a moment, and after a failure it does not ask again for a
// while (the API's rate limit is shared by every visitor of the site).

export type CalendarBroadcast = {
  id: string;
  title: string;
  description: string;
  /** The start, ISO 8601 (UTC). */
  startsAt: string;
  /** The start in milliseconds since the epoch. */
  start: number;
};

/** How long a broadcast is assumed to last, for "add to calendar" and the structured data (the API does not say). */
export const BROADCAST_DURATION_MS = 60 * 60 * 1000;
export const MAX_BROADCASTS = 50;

const itemSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(4000).nullish(),
  startsAt: z.string().min(10).max(40),
  status: z.string().max(40).optional(),
});

/** Scheduled or on air; anything else ("done", "cancelled") is not shown. A missing status counts as scheduled. */
const SHOWN = new Set(['scheduled', 'live']);

/** The broadcasts from whatever the API sent: items that do not fit are left out one by one, never the whole list. */
export function parseBroadcastSchedule(json: unknown): CalendarBroadcast[] {
  const raw: unknown[] = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && Array.isArray((json as { items?: unknown }).items)
      ? (json as { items: unknown[] }).items
      : [];
  const seen = new Set<string>();
  const out: CalendarBroadcast[] = [];
  for (const entry of raw.slice(0, 200)) {
    const parsed = itemSchema.safeParse(entry);
    if (!parsed.success) continue;
    const { id, title, description, startsAt, status } = parsed.data;
    const start = Date.parse(startsAt);
    if (!Number.isFinite(start) || seen.has(id) || (status !== undefined && !SHOWN.has(status))) continue;
    seen.add(id);
    out.push({
      id,
      title: decodeEntities(title),
      description: decodeEntities((description ?? '').trim()),
      startsAt: new Date(start).toISOString(),
      start,
    });
  }
  return out.sort((a, b) => a.start - b.start).slice(0, MAX_BROADCASTS);
}

const DEADLINE_MS = 2_500;
const MISSING_PAUSE_MS = 10 * 60_000; // 404: the API does not have the route (yet)
const FAILURE_PAUSE_MS = 2 * 60_000;

let pausedUntil = 0;

/** Forgets a pause after a failure (tests). */
export function resetBroadcastSchedule() {
  pausedUntil = 0;
}

/**
 * The scheduled broadcasts, read on the server when /live is rendered (cached by Next's data cache for a minute,
 * like the API's own answer). Empty when the API has no such route, fails, or takes longer than `deadlineMs`.
 */
export async function loadBroadcastSchedule({ deadlineMs = DEADLINE_MS }: { deadlineMs?: number } = {}): Promise<CalendarBroadcast[]> {
  if (Date.now() < pausedUntil || process.env.NEXT_PHASE === 'phase-production-build') return [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = getJson('/live/schedule', z.unknown(), { revalidate: 60, timeoutMs: 4_000 }).then(parseBroadcastSchedule, (error: unknown) => {
    pausedUntil = Date.now() + (error instanceof ApiError && error.status === 404 ? MISSING_PAUSE_MS : FAILURE_PAUSE_MS);
    return [] as CalendarBroadcast[];
  });
  const deadline = new Promise<CalendarBroadcast[]>((resolve) => {
    timer = setTimeout(() => resolve([]), deadlineMs);
  });
  try {
    return await Promise.race([read, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * schema.org Events for the scheduled broadcasts (structured data is given for the broadcasts only, never for the
 * feasts). `pageUrl` is the /live page in the visitor's language, where the broadcast is watched.
 */
export function broadcastEventsJsonLd(
  broadcasts: readonly CalendarBroadcast[],
  { locale, pageUrl, organizer }: { locale: string; pageUrl: string; organizer: Record<string, unknown> },
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': broadcasts.map((b) => ({
      '@type': 'Event',
      '@id': `${pageUrl}#broadcast-${encodeURIComponent(b.id)}`,
      name: b.title,
      ...(b.description ? { description: b.description } : {}),
      startDate: b.startsAt,
      endDate: new Date(b.start + BROADCAST_DURATION_MS).toISOString(),
      eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: { '@type': 'VirtualLocation', url: pageUrl },
      organizer,
      inLanguage: locale,
    })),
  };
}
