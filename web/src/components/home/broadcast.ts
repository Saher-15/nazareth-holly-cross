import '@/lib/zodConfig';
import { z } from 'zod';
import { API_URL } from '@/lib/config';
import { decodeEntities } from '@/lib/plainText';

// The next scheduled live broadcast, for the home page's "Today in Nazareth" strip (server side only).
//
// GET /live/schedule -> { timeZone, items: [{ id, title, description, startsAt, status }] } comes with the recordings
// and scheduled broadcasts of the live page (branch feat/live-recordings, docs/LIVE.md). Until the API has the route it
// answers 404, and the strip leaves the broadcast out. The rules mirror the header's live dot (lib/liveStatusPeek.ts):
// a page never waits for this more than briefly once, the API is asked at most once a minute per server instance, and
// a failed read keeps the last good answer.

export type ScheduledBroadcast = { id: string; title: string; startsAt: number; status: 'scheduled' | 'live' };

const itemSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(400),
  startsAt: z.string().refine((s) => Number.isFinite(Date.parse(s))),
  status: z.enum(['scheduled', 'live']),
});
const scheduleSchema = z.object({ items: z.array(z.unknown()) });

/** The usable broadcasts of an answer, soonest first. Items that do not match the contract are skipped one by one. */
export function parseSchedule(json: unknown): ScheduledBroadcast[] | null {
  const parsed = scheduleSchema.safeParse(json);
  if (!parsed.success) return null;
  return parsed.data.items
    .flatMap((raw) => {
      const item = itemSchema.safeParse(raw);
      return item.success
        ? [{ id: item.data.id, title: decodeEntities(item.data.title), startsAt: Date.parse(item.data.startsAt), status: item.data.status }]
        : [];
    })
    .sort((a, b) => a.startsAt - b.startsAt);
}

/** A broadcast that has not started this long after its time is no longer announced (the live page uses two hours). */
export const BROADCAST_GRACE_MS = 2 * 60 * 60 * 1000;

/** The broadcast to announce at `now`: one that is live, else the soonest still to come (or only just due). */
export function nextBroadcast(items: readonly ScheduledBroadcast[] | null, now: number): ScheduledBroadcast | null {
  if (!items) return null;
  return items.find((b) => b.status === 'live') ?? items.find((b) => b.startsAt + BROADCAST_GRACE_MS > now) ?? null;
}

export const SCHEDULE_TTL_MS = 60_000;
const FIRST_WAIT_MS = 1_000;
const TIMEOUT_MS = 3_000;

/** One read. null: the API has no schedule (404). Throws on any other failure. */
export async function fetchSchedule(fetchImpl: typeof fetch = fetch): Promise<ScheduledBroadcast[] | null> {
  const res = await fetchImpl(`${API_URL}/live/schedule`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`live schedule ${res.status}`);
  return parseSchedule(await res.json());
}

let known: { at: number; items: ScheduledBroadcast[] | null } | null = null;
let refreshing: Promise<void> | null = null;

/** Forgets the remembered schedule (tests). */
export function resetSchedule() {
  known = null;
  refreshing = null;
}

/** The schedule as last read, refreshed in the background when older than a minute. */
export async function peekSchedule(now = Date.now(), fetchImpl: typeof fetch = fetch): Promise<ScheduledBroadcast[] | null> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return null;
  if (!known || now - known.at >= SCHEDULE_TTL_MS) {
    refreshing ??= fetchSchedule(fetchImpl)
      .then((items) => {
        known = { at: now, items };
      })
      .catch(() => {
        known = { at: now, items: known?.items ?? null };
      })
      .finally(() => {
        refreshing = null;
      });
  }
  if (known) return known.items;
  // The very first read of this server instance (on a serverless host: each cold start): wait a moment, never long.
  await Promise.race([refreshing, new Promise((resolve) => setTimeout(resolve, FIRST_WAIT_MS))]);
  return remembered();
}

// (a function, so the type checker does not keep the narrowing from before the await)
const remembered = () => known?.items ?? null;
