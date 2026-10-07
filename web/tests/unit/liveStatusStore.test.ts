import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveStatusError, NOT_LIVE, parseLiveStatus, type LiveStatus } from '@/lib/liveStatus';
import { createLiveStatusStore, MIN_GAP_MS, REQUEST_TIMEOUT_MS } from '@/lib/liveStatusStore';

// The one live-status poller of a browser tab (lib/liveStatusStore.ts): who asks how often, what it does while the tab
// is hidden, after failures and with the server's answer as a start. Time and visibility are fakes; nothing is fetched.

const PLAYER = `https://customer-abc123.cloudflarestream.com/${'f'.repeat(32)}/iframe`;
const LIVE = parseLiveStatus({ live: true, id: 'b'.repeat(24), title: 'Vespers', startedAt: '2026-10-06T10:00:00Z', playbackUrl: PLAYER });

function setup(answer: () => Promise<LiveStatus> = async () => NOT_LIVE) {
  let hidden = false;
  const visibility = new Set<() => void>();
  const fetchStatus = vi.fn((signal: AbortSignal) => {
    void signal;
    return answer();
  });
  const store = createLiveStatusStore({
    fetchStatus,
    isHidden: () => hidden,
    onVisibilityChange: (callback) => {
      visibility.add(callback);
      return () => visibility.delete(callback);
    },
  });
  const setHidden = (value: boolean) => {
    hidden = value;
    visibility.forEach((callback) => callback());
  };
  return { store, fetchStatus, setHidden, listeners: () => visibility.size };
}

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-10-06T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('the live-status poller of a tab', () => {
  it('polls only while someone asks, once for everyone, at the shortest interval asked for', async () => {
    const { store, fetchStatus } = setup();
    await advance(60_000);
    expect(fetchStatus).not.toHaveBeenCalled(); // nobody asked

    const header = store.request(30_000);
    const popup = store.request(30_000);
    await advance(0);
    expect(fetchStatus).toHaveBeenCalledTimes(1); // nothing known yet: at once, one request for both
    await advance(30_000);
    expect(fetchStatus).toHaveBeenCalledTimes(2);

    const livePage = store.request(15_000);
    expect(store.currentInterval()).toBe(15_000);
    await advance(15_000);
    expect(fetchStatus).toHaveBeenCalledTimes(3);
    const countdown = store.request(10_000);
    await advance(10_000);
    expect(fetchStatus).toHaveBeenCalledTimes(4);

    countdown();
    livePage();
    expect(store.currentInterval()).toBe(30_000);
    await advance(29_000);
    expect(fetchStatus).toHaveBeenCalledTimes(4);
    await advance(1_000);
    expect(fetchStatus).toHaveBeenCalledTimes(5);

    header();
    popup();
    expect(store.currentInterval()).toBeNull();
    await advance(600_000);
    expect(fetchStatus).toHaveBeenCalledTimes(5);
  });

  it('tells its subscribers what changed (and keeps the same object while nothing did)', async () => {
    let answer: LiveStatus = NOT_LIVE;
    const { store } = setup(async () => answer);
    const seen: LiveStatus[] = [];
    store.subscribe(() => seen.push(store.getSnapshot().status));
    store.request(30_000);
    await advance(0);
    const first = store.getSnapshot().status;
    answer = { ...(LIVE as object) } as LiveStatus;
    await advance(30_000);
    expect(store.getSnapshot().status).toEqual(LIVE);
    const live = store.getSnapshot().status;
    answer = { ...(LIVE as object) } as LiveStatus; // a new object with the same content
    await advance(30_000);
    expect(store.getSnapshot().status).toBe(live);
    expect(first).toEqual(NOT_LIVE);
    expect(seen.at(-1)).toBe(live);
  });

  it('starts from the server’s answer: the first question waits until it is one interval old', async () => {
    const { store, fetchStatus } = setup();
    store.seed(LIVE, Date.now() - 10_000);
    expect(store.getSnapshot()).toEqual({ status: LIVE, checkedAt: Date.now() - 10_000 });
    store.request(30_000);
    await advance(19_000);
    expect(fetchStatus).not.toHaveBeenCalled();
    await advance(1_000);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().status).toEqual(NOT_LIVE);
  });

  it('asks at once when the server never asked, and ignores a seed older than what it already knows', async () => {
    const { store, fetchStatus } = setup(async () => LIVE);
    store.seed(NOT_LIVE, null);
    store.request(30_000);
    await advance(0);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().status).toEqual(LIVE);
    store.seed(NOT_LIVE, Date.now() - 5_000); // a page rendered from an older server answer
    expect(store.getSnapshot().status).toEqual(LIVE);
    store.seed(NOT_LIVE, Date.now() + 1); // a newer one is taken
    expect(store.getSnapshot().status).toEqual(NOT_LIVE);
  });

  it('never polls while the tab is hidden, and asks at once when it is shown again (not within 5 seconds)', async () => {
    const { store, fetchStatus, setHidden } = setup();
    store.request(30_000);
    await advance(0);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    setHidden(true);
    await advance(10 * 60_000);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    setHidden(false);
    await advance(0);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    // hidden and shown again quickly: no second question within the minimum gap
    setHidden(true);
    await advance(MIN_GAP_MS - 1_000);
    setHidden(false);
    await advance(0);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    await advance(30_000 - (MIN_GAP_MS - 1_000));
    expect(fetchStatus).toHaveBeenCalledTimes(3);
  });

  it('backs off after failures and honours Retry-After, then returns to its interval', async () => {
    let fail: Error | null = new LiveStatusError(503, null);
    const { store, fetchStatus } = setup(async () => {
      if (fail) throw fail;
      return NOT_LIVE;
    });
    store.request(30_000);
    await advance(0);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    await advance(59_000);
    expect(fetchStatus).toHaveBeenCalledTimes(1); // 60 s after one failure, not 30
    await advance(1_000);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    fail = new LiveStatusError(429, 300);
    await advance(120_000); // two failures: 120 s
    expect(fetchStatus).toHaveBeenCalledTimes(3);
    await advance(299_000);
    expect(fetchStatus).toHaveBeenCalledTimes(3); // the API asked for 300 s
    fail = null;
    await advance(1_000);
    expect(fetchStatus).toHaveBeenCalledTimes(4);
    await advance(30_000);
    expect(fetchStatus).toHaveBeenCalledTimes(5);
  });

  it('gives up on a question that has no answer after 10 seconds (and counts it as a failure)', async () => {
    const { store, fetchStatus } = setup();
    fetchStatus.mockImplementationOnce(
      (signal: AbortSignal) => new Promise<LiveStatus>((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    );
    store.request(30_000);
    await advance(REQUEST_TIMEOUT_MS);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    await advance(60_000);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  });

  it('stops listening to the tab’s visibility when nobody asks any more', () => {
    const { store, listeners } = setup();
    const stop = store.request(30_000);
    expect(listeners()).toBe(1);
    stop();
    stop(); // twice is harmless
    expect(listeners()).toBe(0);
  });
});
