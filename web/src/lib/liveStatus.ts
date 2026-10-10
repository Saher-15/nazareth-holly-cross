import './zodConfig';
// zod/mini, not zod: this module runs in every page's browser bundle (the header's live dot), see zodConfig.ts.
import * as z from 'zod/mini';
import { API_URL } from './config';
import { decodeEntities } from './plainText';

// Is a live broadcast on? (docs/LIVE.md) The API answers GET /live/status with
//   { live: false }  or  { live: true, id, title, startedAt, playbackUrl }
// where playbackUrl is Cloudflare Stream's player page for the broadcast and id the broadcast's session (24 hex; an
// older API sends no id). One poller per browser tab asks for it (liveStatusStore.ts, read by the header's dot, the
// "we are live" window and the /live page); the server peeks at it to seed that poller (liveStatusPeek.ts).

/** Cloudflare Stream's player page: https://customer-<code>.cloudflarestream.com/<32 hex>/iframe, nothing else. */
export const PLAYER_URL = /^https:\/\/customer-[a-z0-9]{1,64}\.cloudflarestream\.com\/[a-f0-9]{32}\/iframe$/;

/** A database id as the API writes it (24 hex). */
export const OBJECT_ID = /^[a-f0-9]{24}$/;

export type LiveStatus =
  | { live: false }
  | { live: true; /** the broadcast's session id, when the API sends one */ id?: string; title: string; startedAt: number; playbackUrl: string };

export type LiveOn = Extract<LiveStatus, { live: true }>;

export const NOT_LIVE: LiveStatus = { live: false };

const liveSchema = z.object({
  live: z.literal(true),
  id: z.optional(z.unknown()),
  title: z.string().check(z.minLength(1), z.maxLength(400)),
  startedAt: z.string().check(z.refine((s) => Number.isFinite(Date.parse(s)))),
  playbackUrl: z.string().check(z.regex(PLAYER_URL)),
});

/**
 * The status as the page uses it, from whatever the API sent. Anything unexpected (a player address that is not
 * Cloudflare's, a missing title) counts as "not live": the page never frames an address it does not recognise. An id
 * that is not 24 hex is left out (the status still counts; the window then tells broadcasts apart by start and title).
 */
export function parseLiveStatus(json: unknown): LiveStatus {
  const parsed = z.safeParse(liveSchema, json);
  if (!parsed.success) return NOT_LIVE;
  const { id, title, startedAt, playbackUrl } = parsed.data;
  return {
    live: true,
    ...(typeof id === 'string' && OBJECT_ID.test(id) ? { id } : {}),
    title: decodeEntities(title),
    startedAt: Date.parse(startedAt),
    playbackUrl,
  };
}

/** True when two answers describe the same thing (so nothing needs to be drawn again). */
export function sameLiveStatus(a: LiveStatus, b: LiveStatus): boolean {
  if (!a.live || !b.live) return a.live === b.live;
  return a.id === b.id && a.title === b.title && a.startedAt === b.startedAt && a.playbackUrl === b.playbackUrl;
}

export class LiveStatusError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterSeconds: number | null,
  ) {
    super(`live status ${status}`);
  }
}

/** One read from the browser. Throws LiveStatusError (status 0 = no answer) so the caller can back off. */
export async function fetchLiveStatus(signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<LiveStatus> {
  let res: Response;
  try {
    res = await fetchImpl(`${API_URL}/live/status`, { headers: { Accept: 'application/json' }, signal, cache: 'no-store', credentials: 'omit' });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new LiveStatusError(0, null);
  }
  // An API that does not have the route yet answers 404: nothing is live.
  if (res.status === 404) return NOT_LIVE;
  if (!res.ok) {
    const retry = Number(res.headers.get('retry-after'));
    throw new LiveStatusError(res.status, Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  try {
    return parseLiveStatus(await res.json());
  } catch {
    throw new LiveStatusError(502, null);
  }
}

/** The longest pause between two polls after failures (a Retry-After may ask for longer). */
export const MAX_BACKOFF_MS = 120_000;

/**
 * How long to wait before the next poll: `baseMs` (15 s unless the caller asks otherwise) normally, twice as long
 * after each failure up to two minutes, and never less than a Retry-After asks.
 */
export function nextPollDelay(failures: number, retryAfterSeconds: number | null = null, baseMs = 15_000): number {
  const backoff = failures > 0 ? Math.min(baseMs * 2 ** failures, MAX_BACKOFF_MS) : baseMs;
  return Math.max(backoff, (retryAfterSeconds ?? 0) * 1000);
}
