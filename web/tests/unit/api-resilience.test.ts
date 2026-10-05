import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, retryDelayMs } from '@/lib/api';

// A refresh while the API rate-limits (200 requests / 15 minutes per address) or is down must never replace what
// the site already shows with an error. See src/lib/api.ts and docs/PERFORMANCE.md.
describe('reading from the API never ends worse than the last good answer', () => {
  const review = { _id: 'r1', fullName: 'Maria', email: 'Israel', msg: 'Beautiful' };
  const reply = (status: number, body: unknown = [], headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('serves the previous answer when a refresh is rate-limited, and says so in the log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(200, [review])).mockImplementation(() => Promise.resolve(reply(429, {})));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.reviews()).resolves.toEqual([review]);
    const refresh = api.reviews();
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(refresh).resolves.toEqual([review]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('serving the last good answer'));
  });

  it('serves the previous answer when the API cannot be reached at all', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(200, [review])).mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    await api.reviews();
    await expect(api.reviews()).resolves.toEqual([review]);
  });

  it('still fails for an address that was never read successfully', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(reply(503, {}))));
    const assertion = expect(api.reviews()).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it('never answers "not found" with an older answer', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(200, [review])).mockResolvedValue(reply(404, {}));
    vi.stubGlobal('fetch', fetchMock);
    await api.reviews();
    await expect(api.reviews()).rejects.toMatchObject({ status: 404 });
  });

  it('shares one request between identical reads made at the same moment', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(reply(200, [review])));
    vi.stubGlobal('fetch', fetchMock);
    const results = await Promise.all([api.reviews(), api.reviews(), api.reviews()]);
    expect(results).toEqual([[review], [review], [review]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('waits longer, and tries more often, while the site is being built', async () => {
    vi.useFakeTimers();
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(429, {}, { 'Retry-After': '10' }))
      .mockResolvedValueOnce(reply(429, {}, { 'Retry-After': '10' }))
      .mockResolvedValueOnce(reply(429, {}, { 'Retry-After': '10' }))
      .mockResolvedValueOnce(reply(200, [review]));
    vi.stubGlobal('fetch', fetchMock);
    const pending = api.reviews();
    await vi.advanceTimersByTimeAsync(31_000);
    await expect(pending).resolves.toEqual([review]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(retryDelayMs(0, '120', 20_000)).toBe(20_000);
  });
});
