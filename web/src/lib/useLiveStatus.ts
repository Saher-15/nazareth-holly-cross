import { useEffect, useState, useSyncExternalStore } from 'react';
import { NOT_LIVE, type LiveStatus } from './liveStatus';
import { liveStatusStore, type LiveSnapshot } from './liveStatusStore';

// React's view of the tab's one live-status poller (liveStatusStore.ts). Client components only.

/** What the server knew when it rendered the page (lib/liveStatusPeek.ts): the status and when it was read. */
export type LiveSeed = { initial: LiveStatus; checkedAt: number | null };

const subscribe = (listener: () => void) => liveStatusStore().subscribe(listener);
const readSnapshot = () => liveStatusStore().getSnapshot();
const readStatus = () => liveStatusStore().getSnapshot().status;

/**
 * Hands the server's answer to the poller (before the first render reads it, once per mounted component, in the
 * browser only: on the server there is no tab, and a module-wide store would be shared by every visitor), asks it to
 * check at least every `intervalMs` while the component is on the page (null: only listen), and returns what the
 * server rendered, for the first render.
 */
function useLivePoller(intervalMs: number | null, seed: LiveSeed | undefined): LiveSnapshot {
  const [serverSnapshot] = useState<LiveSnapshot>(() => {
    if (seed && typeof window !== 'undefined') liveStatusStore().seed(seed.initial, seed.checkedAt);
    return seed ? { status: seed.initial, checkedAt: seed.checkedAt } : { status: NOT_LIVE, checkedAt: null };
  });
  useLivePolling(intervalMs);
  return serverSnapshot;
}

/** Asks the poller to check at least every `intervalMs` while the component is on the page (null: nothing). */
export function useLivePolling(intervalMs: number | null): void {
  useEffect(() => {
    if (intervalMs === null) return;
    return liveStatusStore().request(intervalMs);
  }, [intervalMs]);
}

/** The live status and when it was read (a new value after every answer). */
export function useLiveSnapshot(intervalMs: number | null, seed?: LiveSeed): LiveSnapshot {
  const serverSnapshot = useLivePoller(intervalMs, seed);
  return useSyncExternalStore(subscribe, readSnapshot, () => serverSnapshot);
}

/**
 * The live status alone: the component draws again only when it changes, not after every poll. On the server and
 * while the browser hydrates it is the seed, so the HTML and the first browser render agree.
 */
export function useLiveStatus(intervalMs: number | null, seed?: LiveSeed): LiveStatus {
  const serverSnapshot = useLivePoller(intervalMs, seed);
  return useSyncExternalStore(subscribe, readStatus, () => serverSnapshot.status);
}
