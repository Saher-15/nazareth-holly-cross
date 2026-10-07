import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// The legacy admin authentication is GONE (security review 06, finding 1). POST /auth/login (the shared
// ADMIN_PASSWORD) and POST /admin/login (an account's password) used to give an 8-hour token that skipped the second
// factor, roles, disabling, lockout, revocation and the audit log; requireAdmin accepted it on a set of legacy routes.
// These tests prove that: (1) both sign-ins no longer exist, (2) every legacy route no longer exists, (3) a legacy
// token that was issued before the change and is still within its 8 hours opens nothing, anywhere.

const mocks = vi.hoisted(() => ({ findOne: vi.fn(), orderFind: vi.fn() }));

vi.mock('../model/admin.js', () => ({ default: { findOne: (...a) => mocks.findOne(...a), findById: (...a) => mocks.findOne(...a) } }));
vi.mock('../model/order.js', () => ({ default: { find: (...a) => mocks.orderFind(...a) } }));

const { createApp } = await import('../app.js');
const { comparePasswordTimingSafe } = await import('../services/adminAuth.js');
const { verifySessionToken, signSessionToken, SESSION_SECONDS } = await import('../services/adminSessions.js');
const app = createApp();

const SECRET = process.env.JWT_SECRET;
let ipCounter = 0;
const client = () => `10.1.0.${++ipCounter}`;

beforeEach(() => {
  mocks.findOne.mockReset();
  mocks.orderFind.mockReset().mockImplementation(() => { const chain = { sort: () => chain, limit: () => chain, lean: async () => [] }; return chain; });
});

// Exactly what the removed routes used to sign: HS256 with JWT_SECRET, 8 hours.
const LEGACY_TOKENS = {
  'shared-password token': () => jwt.sign({ role: 'admin', auth: 'shared-password' }, SECRET, { expiresIn: '8h' }),
  'account token': () => jwt.sign({ role: 'admin', id: '64b000000000000000000009', username: 'saher', auth: 'account' }, SECRET, { expiresIn: '8h' }),
  'pre-role account token': () => jwt.sign({ id: '64b000000000000000000009', username: 'saher' }, SECRET, { expiresIn: '8h' }),
};

// Every legacy route that accepted those tokens (route/adminRoute.js, the requireAdmin routes of the public routers).
const LEGACY_ROUTES = [
  ['post', '/auth/login'],
  ['post', '/admin/login'],
  ['get', '/admin/stats'],
  ['get', '/order/getAllOrders'],
  ['get', '/order/getOrder/64b000000000000000000001'],
  ['patch', '/order/orderSent/64b000000000000000000001'],
  ['delete', '/order/deleteOrder/64b000000000000000000001'],
  ['get', '/candle/getAllCandleRequests'],
  ['put', '/candle/set_request_done/64b000000000000000000001'],
  ['delete', '/candle/delete_lighting_request/64b000000000000000000001'],
  ['get', '/contact/get_all_contact_us'],
  ['get', '/contact/get_request/64b000000000000000000001'],
  ['patch', '/contact/request_done/64b000000000000000000001'],
  ['delete', '/contact/delete_request/64b000000000000000000001'],
  ['post', '/product/addProduct'],
  ['put', '/product/updateProduct/64b000000000000000000001'],
  ['delete', '/product/deleteProduct/64b000000000000000000001'],
  ['delete', '/prayer/64b000000000000000000001'],
  ['delete', '/review/64b000000000000000000001'],
];

// Addresses that exist in BOTH the old and the new admin API: the dashboard's version answers (a session is needed).
const SHARED_ADMIN_ROUTES = [
  ['get', '/admin/prayers'],
  ['delete', '/admin/prayers/64b000000000000000000001'],
  ['get', '/admin/candles'],
  ['delete', '/admin/candles/64b000000000000000000001'],
  ['get', '/admin/products'],
  ['post', '/admin/products'],
  ['delete', '/admin/products/64b000000000000000000001'],
  ['put', '/admin/products/64b000000000000000000001'],
  ['get', '/admin/product-reviews'],
  ['patch', '/admin/product-reviews/64b000000000000000000001'],
  ['delete', '/admin/product-reviews/64b000000000000000000001'],
];

describe('the legacy sign-ins no longer exist', () => {
  it.each([
    ['/auth/login', { password: 'anything-at-all' }],
    ['/auth/login', {}],
    ['/admin/login', { username: 'saher', password: 'right-password' }],
    ['/admin/login', { username: { $ne: null }, password: { $ne: null } }],
  ])('POST %s answers 404 and issues no token', async (path, body) => {
    mocks.findOne.mockResolvedValue({ _id: '64b000000000000000000009', username: 'saher', comparePassword: async () => true });
    const res = await request(app).post(path).set('X-Forwarded-For', client()).send(body);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(res.body.token).toBeUndefined();
    expect(res.headers.deprecation).toBeUndefined();
    expect(mocks.findOne).not.toHaveBeenCalled(); // no account is even looked up
  });

  it('never rate-limits them as sign-ins either (there is nothing to guess)', async () => {
    const ip = client();
    for (let i = 0; i < 8; i += 1) {
      expect((await request(app).post('/admin/login').set('X-Forwarded-For', ip).send({ username: 'a', password: 'x' })).status).toBe(404);
    }
  });
});

describe('a legacy token that is still within its 8 hours opens nothing', () => {
  const legacyCases = Object.entries(LEGACY_TOKENS);

  it.each(LEGACY_ROUTES)('%s %s no longer exists (404), with or without a legacy token', async (method, path) => {
    for (const [, make] of legacyCases) {
      const res = await request(app)[method](path).set('X-Forwarded-For', client()).set('Authorization', `Bearer ${make()}`).send({});
      expect(res.status, path).toBe(404);
    }
    expect((await request(app)[method](path).set('X-Forwarded-For', client()).send({})).status).toBe(404);
    expect(mocks.orderFind).not.toHaveBeenCalled();
  });

  it.each(SHARED_ADMIN_ROUTES)('%s %s answers 401 to a legacy token (only the dashboard route is left)', async (method, path) => {
    for (const [name, make] of legacyCases) {
      const res = await request(app)[method](path).set('X-Forwarded-For', client()).set('Authorization', `Bearer ${make()}`).send({});
      expect(res.status, `${name} on ${path}`).toBe(401);
      expect(res.headers['cache-control']).toBe('no-store');
    }
  });

  it.each([
    ['get', '/admin/auth/me'], ['get', '/admin/dashboard'], ['get', '/admin/orders'], ['get', '/admin/contacts'],
    ['get', '/admin/users'], ['get', '/admin/audit'], ['get', '/admin/export/orders.csv'], ['post', '/admin/privacy/lookup'],
    ['get', '/admin/live'], ['post', '/admin/auth/totp/setup'],
  ])('%s %s refuses every legacy token with 401', async (method, path) => {
    for (const [name, make] of legacyCases) {
      expect((await request(app)[method](path).set('X-Forwarded-For', client()).set('Authorization', `Bearer ${make()}`).send({})).status, name).toBe(401);
    }
  });
});

describe('verifySessionToken: only a dashboard session token passes', () => {
  const sign = (claims, options = { expiresIn: SESSION_SECONDS }, secret = SECRET) => jwt.sign(claims, secret, { algorithm: 'HS256', ...options });

  it('accepts what POST /admin/auth/login signs', () => {
    const token = signSessionToken({ id: '64b000000000000000000009', role: 'owner' }, 'sid-1');
    expect(verifySessionToken(token)).toMatchObject({ sub: '64b000000000000000000009', role: 'owner', sid: 'sid-1' });
  });

  it.each(Object.entries(LEGACY_TOKENS))('refuses a legacy %s', (_name, make) => {
    expect(() => verifySessionToken(make())).toThrow();
  });

  it('refuses a token without a session id, a subject or a known role', () => {
    expect(() => verifySessionToken(sign({ sub: 'x', role: 'owner' }))).toThrow();
    expect(() => verifySessionToken(sign({ sid: 's', role: 'owner' }))).toThrow();
    expect(() => verifySessionToken(sign({ sub: 'x', sid: 's', role: 'admin' }))).toThrow();
  });

  it('refuses a session-shaped token that lives longer than a session, or was issued too long ago', () => {
    expect(() => verifySessionToken(sign({ sub: 'x', sid: 's', role: 'owner' }, { expiresIn: '8h' }))).toThrow();
    const now = Math.floor(Date.now() / 1000);
    expect(() => verifySessionToken(sign({ sub: 'x', sid: 's', role: 'owner', iat: now - 2 * 3600, exp: now + 60 }, {}))).toThrow();
    expect(() => verifySessionToken(sign({ sub: 'x', sid: 's', role: 'owner', exp: now + 600 }, { noTimestamp: true }))).toThrow();
  });

  it('refuses another algorithm, "none" and a wrong secret', () => {
    expect(() => verifySessionToken(sign({ sub: 'x', sid: 's', role: 'owner' }, { expiresIn: 600, algorithm: 'HS512' }))).toThrow();
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
      JSON.stringify({ sub: 'x', sid: 's', role: 'owner', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 }),
    ).toString('base64url')}.`;
    expect(() => verifySessionToken(none)).toThrow();
    expect(() => verifySessionToken(sign({ sub: 'x', sid: 's', role: 'owner' }, { expiresIn: 600 }, 'another-secret-another-secret-xx'))).toThrow();
    expect(() => verifySessionToken('junk')).toThrow();
  });
});

describe('every private route refuses a visitor without a token', () => {
  const routes = [
    ['get', '/admin/dashboard'],
    ['get', '/admin/prayers'],
    ['delete', '/admin/prayers/64b000000000000000000001'],
    ['get', '/admin/candles'],
    ['delete', '/admin/candles/64b000000000000000000001'],
    ['get', '/admin/products'],
    ['post', '/admin/products'],
    ['put', '/admin/products/64b000000000000000000001'],
    ['delete', '/admin/products/64b000000000000000000001'],
    ['get', '/admin/orders'],
    ['patch', '/admin/orders/64b000000000000000000001'],
    ['delete', '/admin/orders/64b000000000000000000001'],
    ['get', '/admin/contacts'],
    ['get', '/admin/site-reviews'],
    ['get', '/admin/product-reviews'],
    ['get', '/admin/payments'],
    ['get', '/admin/export/orders.csv'],
    ['get', '/admin/users'],
    ['get', '/admin/audit'],
    ['post', '/admin/privacy/lookup'],
    ['post', '/admin/privacy/erase'],
    // (the old /live/create_room and /live/close_room were removed: docs/LIVE.md; live broadcasting is /admin/live)
    ['get', '/admin/live'],
    ['post', '/admin/live/start'],
    ['post', '/admin/live/stop'],
  ];

  it.each(routes)('%s %s -> 401', async (method, path) => {
    const res = await request(app)[method](path).set('X-Forwarded-For', client()).send({});
    expect(res.status).toBe(401);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('admin auth helpers', () => {
  const accountDoc = (password = 'right-password') => ({ comparePassword: vi.fn(async (p) => p === password) });

  it('checks a password against a dummy hash when the account does not exist', async () => {
    expect(await comparePasswordTimingSafe(null, 'anything')).toBe(false);
    expect(await comparePasswordTimingSafe(null, undefined)).toBe(false);
    const doc = accountDoc();
    expect(await comparePasswordTimingSafe(doc, 'right-password')).toBe(true);
    expect(await comparePasswordTimingSafe(doc, { $ne: 1 })).toBe(false);
  });
});
