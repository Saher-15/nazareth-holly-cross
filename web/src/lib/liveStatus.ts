import './zodConfig';
import { z } from 'zod';
import { API_URL } from './config';
import { decodeEntities } from './plainText';

// Is a live broadcast on? (docs/LIVE.md) The API answers GET /live/status with
//   { live: false }  or  { live: true, title, startedAt, playbackUrl }
// where playbackUrl is Cloudflare Stream's player page for the broadcast. The browser polls it on the /live page
// (components/community/LiveNow.tsx); the server peeks at it for the header's "live now" dot (liveStatusPeek.ts).

/** Cloudflare Stream's player page: https://customer-<code>.cloudflarestream.com/<32 hex>/iframe, nothing else. */
export const PLAYER_URL = /^https:\/\/customer-[a-z0-9]{1,64}\.cloudflarestream\.com\/[a-f0-9]{32}\/iframe$/;

export type LiveStatus = { live: false } | { live: true; title: string; startedAt: number; playbackUrl: string };

export const NOT_LIVE: LiveStatus = { live: false };

const liveSchema = z.object({
  live: z.literal(true),
  title: z.string().min(1).max(400),
  startedAt: z.string().refine((s) => Number.isFinite(Date.parse(s))),
  playbackUrl: z.string().regex(PLAYER_URL),
});

/**
 * The status as the page uses it, from whatever the API sent. Anything unexpected (a player address that is not
 * Cloudflare's, a missing title) counts as "not live": the page never frames an address it does not recognise.
 */
export function parseLiveStatus(json: unknown): LiveStatus {
  const parsed = liveSchema.safeParse(json);
  if (!parsed.success) return NOT_LIVE;
  return { live: true, title: decodeEntities(parsed.data.title), startedAt: Date.parse(parsed.data.startedAt), playbackUrl: parsed.data.playbackUrl };
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

/** How long to wait before the next poll: 15 s normally, longer after failures (and as long as the API asks). */
export function nextPollDelay(failures: number, retryAfterSeconds: number | null = null): number {
  const base = 15_000;
  const backoff = failures > 0 ? Math.min(base * 2 ** failures, 120_000) : base;
  return Math.max(backoff, (retryAfterSeconds ?? 0) * 1000);
}
