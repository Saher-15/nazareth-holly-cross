import { fetchLiveStatus, LiveStatusError, nextPollDelay, NOT_LIVE, sameLiveStatus, type LiveStatus } from './liveStatus';

// One poller of GET /live/status per browser tab (docs/LIVE.md), shared by everything that shows whether a broadcast
// is live: the dot on the header's Live link, the "we are live" window and the /live page (the player and the
// countdown). Framework-free; React reads it through useLiveStatus (useLiveStatus.ts).
//
// Rules, so the API is asked as little as possible:
//   - It polls only while someone asks it to (`request(intervalMs)`), at the SHORTEST interval asked for: the header
//     and the window ask every 30 s, the /live page every 15 s, the countdown every 10 s for half an hour after the
//     announced start.
//   - Never while the tab is hidden; at once when it becomes visible again, unless the last answer is under 5 s old.
//   - After a failure it waits twice as long each time (at most 2 minutes), and at least as long as a Retry-After asks.
//   - It starts from what the server last knew (`seed`, from lib/liveStatusPeek.ts): the first question waits until
//     that answer is one interval old, so a visitor who only glances at a page costs the API nothing.

/** The header's dot and the "we are live" window: every 30 seconds. */
export const HEADER_POLL_MS = 30_000;
/** The /live page (the player appears and goes): every 15 seconds. */
export const LIVE_PAGE_POLL_MS = 15_000;
/** A check is skipped when the last answer is younger than this (switching tabs quickly does not ask again). */
export const MIN_GAP_MS = 5_000;
/** No caller can make it ask more often than this. */
export const MIN_INTERVAL_MS = 5_000;
/** A question that has had no answer after this long counts as failed. */
export const REQUEST_TIMEOUT_MS = 10_000;

export type LiveSnapshot = {
  status: LiveStatus;
  /** When the answer was read (by the server for a seed, else by this tab); null: never. */
  checkedAt: number | null;
};

export type LiveStatusEnv = {
  fetchStatus: (signal: AbortSignal) => Promise<LiveStatus>;
  now: () => number;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (timer: unknown) => void;
  isHidden: () => boolean;
  /** Calls `callback` when the tab is shown or hidden; returns the unsubscribe function. */
  onVisibilityChange: (callback: () => void) => () => void;
};

export type LiveStatusStore = {
  getSnapshot: () => LiveSnapshot;
  subscribe: (listener: () => void) => () => void;
  /** What the server knew: taken when it is newer than what this tab has. */
  seed: (status: LiveStatus, checkedAt: number | null) => void;
  /** Poll at least every `intervalMs` until the returned function is called. */
  request: (intervalMs: number) => () => void;
  /** The interval polled at now (null: not polling). */
  currentInterval: () => number | null;
};

const browserEnv = (): LiveStatusEnv => ({
  fetchStatus: (signal) => fetchLiveStatus(signal),
  now: () => Date.now(),
  setTimer: (callback, ms) => setTimeout(callback, ms),
  clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  isHidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  onVisibilityChange: (callback) => {
    document.addEventListener('visibilitychange', callback);
    return () => document.removeEventListener('visibilitychange', callback);
  },
});

export function createLiveStatusStore(overrides: Partial<LiveStatusEnv> = {}): LiveStatusStore {
  const env: LiveStatusEnv = { ...browserEnv(), ...overrides };
  let snapshot: LiveSnapshot = { status: NOT_LIVE, checkedAt: null };
  let seeded = false;
  let lastAttempt: number | null = null;
  let failures = 0;
  let retryAfter: number | null = null;
  const requests = new Map<number, number>();
  let nextToken = 1;
  let timer: unknown = null;
  let inFlight: AbortController | null = null;
  let stopVisibility: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  const interval = () => (requests.size ? Math.min(...requests.values()) : null);

  /** The last time anything was learned or tried (null: never). */
  const lastRead = () => {
    const times = [snapshot.checkedAt, lastAttempt].filter((t): t is number => t !== null);
    return times.length ? Math.max(...times) : null;
  };

  const clearTimer = () => {
    if (timer !== null) env.clearTimer(timer);
    timer = null;
  };

  function schedule() {
    clearTimer();
    const every = interval();
    if (every === null || inFlight || env.isHidden()) return;
    const wait = nextPollDelay(failures, retryAfter, every);
    const last = lastRead();
    // A clock that disagrees with the server's (an answer "from the future") never delays a poll beyond one wait.
    const delay = last === null ? 0 : Math.min(Math.max(last + wait - env.now(), 0), wait);
    timer = env.setTimer(() => void poll(), delay);
  }

  async function poll() {
    timer = null;
    if (!requests.size || inFlight || env.isHidden()) return;
    const controller = new AbortController();
    inFlight = controller;
    lastAttempt = env.now();
    const timeout = env.setTimer(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const status = await env.fetchStatus(controller.signal);
      if (inFlight !== controller) return; // nobody wants it any more
      failures = 0;
      retryAfter = null;
      snapshot = { status: sameLiveStatus(snapshot.status, status) ? snapshot.status : status, checkedAt: env.now() };
      seeded = true;
      notify();
    } catch (error) {
      if (inFlight !== controller) return;
      failures += 1;
      retryAfter = error instanceof LiveStatusError ? error.retryAfterSeconds : null;
    } finally {
      env.clearTimer(timeout);
      if (inFlight === controller) {
        inFlight = null;
        schedule();
      }
    }
  }

  function onVisibility() {
    if (env.isHidden()) {
      clearTimer(); // a question already on its way still lands
      return;
    }
    if (!requests.size) return;
    const last = lastRead();
    if (failures === 0 && (last === null || env.now() - last >= MIN_GAP_MS)) void poll();
    else schedule();
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    seed(status, checkedAt) {
      const newer = checkedAt !== null && (snapshot.checkedAt === null || checkedAt > snapshot.checkedAt);
      if (seeded && !newer) return;
      seeded = true;
      const changed = !sameLiveStatus(snapshot.status, status);
      snapshot = { status: changed ? status : snapshot.status, checkedAt };
      if (changed) notify();
      if (requests.size) schedule();
    },

    request(intervalMs) {
      const token = nextToken;
      nextToken += 1;
      requests.set(token, Math.max(intervalMs, MIN_INTERVAL_MS));
      if (!stopVisibility) stopVisibility = env.onVisibilityChange(onVisibility);
      schedule();
      return () => {
        if (!requests.delete(token)) return;
        if (requests.size) {
          schedule();
          return;
        }
        clearTimer();
        inFlight?.abort();
        inFlight = null;
        stopVisibility?.();
        stopVisibility = null;
      };
    },

    currentInterval: interval,
  };
}

let shared: LiveStatusStore | null = null;

/** The tab's one store (created on first use, in the browser only). */
export function liveStatusStore(): LiveStatusStore {
  shared ??= createLiveStatusStore();
  return shared;
}

/** Forgets the tab's store (tests). */
export function resetLiveStatusStore(): void {
  shared = null;
}
