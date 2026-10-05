import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiRequest,
  auditSchema,
  buildQuery,
  dashboardSchema,
  loginResponseSchema,
  meSchema,
  orderSchema,
  ordersPage,
  parseListParams,
  productSchema,
  totpSetupSchema,
  userSchema,
} from '@/lib/api';

afterEach(() => vi.restoreAllMocks());

function reply(status: number, body?: unknown, headers: Record<string, string> = {}) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } }),
  );
}

const order = { _id: 'o1', firstName: 'A', lastName: 'B', email: 'a@b.co', totalPrice: 10, products: [{ productName: 'X', quantity: 2 }], done: false };

describe('response schemas', () => {
  it('login: token, lifetime and user', () => {
    const ok = loginResponseSchema.safeParse({ token: 'x'.repeat(30), expiresIn: 3600, user: { id: '1', username: 'owner', role: 'owner', totpEnabled: false } });
    expect(ok.success).toBe(true);
    expect(loginResponseSchema.safeParse({ token: 'x'.repeat(30), expiresIn: 3600, user: { id: '1', username: 'o', role: 'god', totpEnabled: false } }).success).toBe(false);
    expect(loginResponseSchema.safeParse({ token: 'short', expiresIn: 3600, user: { id: '1', username: 'o', role: 'owner', totpEnabled: false } }).success).toBe(false);
  });

  it('me, TOTP set-up', () => {
    expect(meSchema.safeParse({ id: '1', username: 'o', role: 'viewer', totpEnabled: true, lastLoginAt: null }).success).toBe(true);
    expect(totpSetupSchema.safeParse({ secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP' }).success).toBe(true);
    expect(totpSetupSchema.safeParse({ secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'https://evil.example' }).success).toBe(false);
  });

  it('documents read `_id` or `id` as `id`, keep unknown fields and reject a missing id', () => {
    expect(orderSchema.parse(order).id).toBe('o1');
    expect(orderSchema.parse({ ...order, _id: undefined, id: 'o2', extra: 1 })).toMatchObject({ id: 'o2', extra: 1 });
    expect(orderSchema.safeParse({ ...order, _id: undefined }).success).toBe(false);
    expect(orderSchema.safeParse({ ...order, totalPrice: 'ten' }).success).toBe(false);
  });

  it('products: stock may be null, extra fields are allowed', () => {
    const p = productSchema.parse({ _id: 'p', name: 'N', price: 1, img: 'https://x/y.png', stock: null, category: 'Candles', brandNew: true });
    expect(p.stock).toBeNull();
    expect(productSchema.parse({ _id: 'p', name: 'N', price: 1, img: 'u' }).stock).toBeUndefined();
  });

  it('users and audit entries normalise their shape', () => {
    expect(userSchema.parse({ _id: 'u', username: 'a', role: 'editor' })).toMatchObject({ id: 'u', disabled: false });
    const a = auditSchema.parse({ _id: 'a', createdAt: '2026-01-01T00:00:00Z', actor: { username: 'owner' }, action: 'order.update', target: { id: 1 } });
    expect(a).toMatchObject({ when: '2026-01-01T00:00:00Z', actorName: 'owner' });
    expect(a.targetText).toContain('"id":1');
    expect(auditSchema.parse({ _id: 'b', at: '2026-02-02', actor: 'x', action: 'auth.login' })).toMatchObject({ when: '2026-02-02', actorName: 'x', targetText: '' });
  });

  it('pages and the dashboard', () => {
    expect(ordersPage.safeParse({ items: [order], total: 1, page: 1, size: 25 }).success).toBe(true);
    expect(ordersPage.safeParse({ items: [order], total: -1, page: 1, size: 25 }).success).toBe(false);
    expect(ordersPage.safeParse({ items: [{ nope: true }], total: 1, page: 1, size: 25 }).success).toBe(false);
    const dash = {
      totals: { orders: 1, ordersPending: 1, revenue: 1, candles: 1, candlesPending: 1, contacts: 1, contactsOpen: 1, products: 1, productReviews: 1, prayers: 1, reviews: 1 },
      last30Days: [{ date: '2026-01-01', orders: 1, revenue: 1, candles: 0 }],
      topProducts: [{ productId: 'p', name: 'N', sold: 1, revenue: 1 }],
      lowStock: [{ productId: 'p', name: 'N', stock: 1 }],
      recent: { orders: [order], candles: [], contacts: [] },
    };
    expect(dashboardSchema.safeParse(dash).success).toBe(true);
    expect(dashboardSchema.safeParse({ ...dash, totals: { orders: 1 } }).success).toBe(false);
  });
});

describe('apiRequest', () => {
  it('sends the bearer token and JSON, parses with the schema', async () => {
    reply(200, { id: '1', username: 'o', role: 'owner', totpEnabled: false });
    const me = await apiRequest({ base: 'http://api', path: '/admin/auth/me', token: 'tok', schema: meSchema });
    expect(me.username).toBe('o');
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('http://api/admin/auth/me');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('builds the query without empty values and posts a JSON body', async () => {
    reply(200, {});
    await apiRequest({ base: '', path: '/x', method: 'POST', body: { a: 1 }, query: { page: 2, q: '', status: undefined, size: 25 } });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/x?page=2&size=25');
    expect(init!.body).toBe('{"a":1}');
    expect((init!.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('turns API errors into typed ApiError (401, 403, 428, 429 with Retry-After)', async () => {
    reply(401, { error: 'Invalid credentials' });
    await expect(apiRequest({ base: '', path: '/x' })).rejects.toMatchObject({ status: 401, message: 'Invalid credentials', unauthorized: true });
    reply(403, { error: 'Forbidden' });
    await expect(apiRequest({ base: '', path: '/x' })).rejects.toMatchObject({ forbidden: true });
    reply(428, { error: 'totp_required' });
    await expect(apiRequest({ base: '', path: '/x' })).rejects.toMatchObject({ totpRequired: true, code: 'totp_required' });
    reply(429, { error: 'Too many attempts' }, { 'Retry-After': '120' });
    await expect(apiRequest({ base: '', path: '/x' })).rejects.toMatchObject({ rateLimited: true, retryAfterSeconds: 120 });
    reply(500, 'oops');
    const err = await apiRequest({ base: '', path: '/x' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
  });

  it('204 resolves to undefined; an unexpected shape is a 502 bad_shape; network failure a 502', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiRequest({ base: '', path: '/x', method: 'POST' })).resolves.toBeUndefined();
    reply(200, { nope: true });
    await expect(apiRequest({ base: '', path: '/x', schema: meSchema })).rejects.toMatchObject({ status: 502, code: 'bad_shape' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    await expect(apiRequest({ base: '', path: '/x' })).rejects.toMatchObject({ status: 502, code: 'network' });
  });
});

describe('list parameters', () => {
  it('buildQuery skips empty values', () => {
    expect(buildQuery({ a: 1, b: '', c: undefined, d: null, e: 'x y' })).toBe('?a=1&e=x+y');
    expect(buildQuery()).toBe('');
  });
  it('parseListParams only lets sane values through', () => {
    expect(parseListParams({})).toEqual({ page: 1, size: 25, q: '', status: '', sort: '' });
    expect(parseListParams({ page: '3', size: '50', q: 'abc', status: 'pending', sort: '-createdAt' })).toEqual({ page: 3, size: 50, q: 'abc', status: 'pending', sort: '-createdAt' });
    const bad = parseListParams({ page: '-1', size: '9999', q: 'x'.repeat(500), status: '<script>', sort: 'a;b' }, { sort: '-createdAt' });
    expect(bad).toEqual({ page: 1, size: 25, q: 'x'.repeat(100), status: '', sort: '-createdAt' });
    expect(parseListParams({ page: ['2', '3'] }).page).toBe(2);
    expect(parseListParams({ page: 'NaN' }).page).toBe(1);
  });
});
