import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The shop's server reads never reach the real API from a unit test.
const { api } = vi.hoisted(() => ({
  api: { catalog: vi.fn(), productReviews: vi.fn(), bestSellers: vi.fn(), similar: vi.fn() },
}));
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<object>()), api }));

import { ApiError } from '@/lib/api';
import { EMPTY_REVIEWS, loadBestSellers, loadCatalogResult, loadReviews } from '@/lib/shop/load';

const PHASE = process.env.NEXT_PHASE;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  process.env.NEXT_PHASE = PHASE;
  vi.restoreAllMocks();
});

describe('shop server reads', () => {
  it('builds an error state while prerendering, keeping the status', async () => {
    process.env.NEXT_PHASE = 'phase-production-build';
    api.catalog.mockRejectedValue(new ApiError('rate limited', 429));
    await expect(loadCatalogResult()).resolves.toEqual({ ok: false, status: 429 });
  });

  it('throws when a cached page is refreshed, so Next keeps the last good page', async () => {
    process.env.NEXT_PHASE = 'phase-production-server';
    api.catalog.mockRejectedValue(new ApiError('down', 503));
    await expect(loadCatalogResult()).rejects.toThrow('down');
    api.productReviews.mockRejectedValue(new ApiError('down', 503));
    await expect(loadReviews('66c70c6387e696939c4ab117', null)).rejects.toThrow('down');
  });

  it('skips the reviews request when the catalogue says there are none', async () => {
    await expect(loadReviews('66c70c6387e696939c4ab117', 0)).resolves.toBe(EMPTY_REVIEWS);
    expect(api.productReviews).not.toHaveBeenCalled();
  });

  it('drops optional extras quietly', async () => {
    process.env.NEXT_PHASE = 'phase-production-server';
    api.bestSellers.mockRejectedValue(new ApiError('rate limited', 429));
    await expect(loadBestSellers()).resolves.toBeNull();
  });
});
