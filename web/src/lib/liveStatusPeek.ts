import { fetchLiveStatus, NOT_LIVE, type LiveStatus } from './liveStatus';

// Server side only (the locale layout): is a broadcast live, for the header's "live now" dot. docs/LIVE.md.
//
// The layout renders on every request (CSP nonce), so it must never wait for this: it gets the last answer it has
// (or "not live" the first time) and, when that is older than PEEK_TTL_MS, a refresh starts in the background. So the
// API is asked at most every 15 seconds per server instance, however many visitors there are, and a slow or
// unreachable API costs a page nothing.

export const PEEK_TTL_MS = 15_000;
const PEEK_TIMEOUT_MS = 3_000;

let peeked: { at: number; status: LiveStatus } | null = null;
let refreshing: Promise<void> | null = null;

/** Forgets the peeked status (tests). */
export function resetLivePeek() {
  peeked = null;
  refreshing = null;
}

export function peekLiveStatus(now = Date.now(), fetchImpl: typeof fetch = fetch): LiveStatus {
  const stale = !peeked || now - peeked.at >= PEEK_TTL_MS;
  if (stale && !refreshing && process.env.NEXT_PHASE !== 'phase-production-build') {
    refreshing = fetchLiveStatus(AbortSignal.timeout(PEEK_TIMEOUT_MS), fetchImpl)
      .then((status) => {
        peeked = { at: Date.now(), status };
      })
      .catch(() => {
        // keep what we had, and do not ask again before the next window
        peeked = { at: Date.now(), status: peeked?.status ?? NOT_LIVE };
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return peeked?.status ?? NOT_LIVE;
}

/** When the peeked status was read (null: never yet). The /live page hands it to the browser (LiveNow). */
export function livePeekCheckedAt(): number | null {
  return peeked?.at ?? null;
}

/** Waits for a background refresh started by peekLiveStatus (tests). */
export function livePeekSettled(): Promise<void> {
  return refreshing ?? Promise.resolve();
}
