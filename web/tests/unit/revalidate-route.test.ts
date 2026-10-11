// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/revalidate (src/app/api/revalidate/route.ts): the API asks the site to drop its cached catalogue after a
// product change in the dashboard. Only with the shared secret; without one configured the route does not exist.

const cache = vi.hoisted(() => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('next/cache', () => cache);

const SECRET = 'a-test-secret-that-is-long-enough-123456';
const PRODUCT = 'b0000000000000000000000a';

const call = async (init: { auth?: string; body?: unknown; raw?: string } = {}) => {
  const { POST } = await import('@/app/api/revalidate/route');
  return POST(new Request('http://localhost/api/revalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init.auth !== undefined ? { Authorization: init.auth } : {}) },
    body: init.raw ?? JSON.stringify(init.body ?? {}),
  }));
};

beforeEach(() => {
  cache.revalidateTag.mockReset();
  cache.revalidatePath.mockReset();
  vi.stubEnv('REVALIDATE_SECRET', SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/revalidate', () => {
  it('with the secret: drops the catalogue (no stale copy) and the named product pages in every language', async () => {
    const res = await call({ auth: `Bearer ${SECRET}`, body: { scope: 'shop', productIds: [PRODUCT, 'nope', PRODUCT] } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revalidated: true, products: 1 });
    expect(cache.revalidateTag).toHaveBeenCalledWith('catalog', { expire: 0 });
    expect(cache.revalidatePath).toHaveBeenCalledWith(`/en/shop/${PRODUCT}`);
    expect(cache.revalidatePath).toHaveBeenCalledWith(`/he/shop/${PRODUCT}`);
    expect(cache.revalidatePath).toHaveBeenCalledWith('/ar/shop');
    expect(cache.revalidatePath.mock.calls.every(([path]) => /^\/[a-z]{2}\/shop(\/[a-f0-9]{24})?$/.test(path))).toBe(true);
  });

  it.each([
    ['no header', undefined],
    ['a wrong secret', 'Bearer not-the-secret-at-all-but-long-enough-0000'],
    ['the secret without Bearer', SECRET],
  ])('refuses %s with 401 and revalidates nothing', async (_name, auth) => {
    const res = await call({ auth, body: { productIds: [PRODUCT] } });
    expect(res.status).toBe(401);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it('does not exist while no secret (or a short one) is configured on this deploy', async () => {
    vi.stubEnv('REVALIDATE_SECRET', 'short');
    expect((await call({ auth: 'Bearer short' })).status).toBe(404);
    vi.stubEnv('REVALIDATE_SECRET', '');
    expect((await call({ auth: 'Bearer ' })).status).toBe(404);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it('refuses a body that is not JSON or too large, and never echoes the secret', async () => {
    expect((await call({ auth: `Bearer ${SECRET}`, raw: '{nope' })).status).toBe(400);
    expect((await call({ auth: `Bearer ${SECRET}`, raw: JSON.stringify({ productIds: ['x'.repeat(5000)] }) })).status).toBe(413);
    const ok = await call({ auth: `Bearer ${SECRET}` });
    expect(await ok.text()).not.toContain(SECRET);
    expect(ok.headers.get('cache-control')).toBe('no-store');
  });
});
