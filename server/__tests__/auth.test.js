import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Admin authentication: the two sign-in routes, the token they issue, and what requireAdmin accepts.

const mocks = vi.hoisted(() => ({ findOne: vi.fn(), orderFind: vi.fn() }));

vi.mock('../model/admin.js', () => ({ default: { findOne: (...a) => mocks.findOne(...a) } }));
vi.mock('../model/order.js', () => ({ default: { find: (...a) => mocks.orderFind(...a) } }));

const { createApp } = await import('../app.js');
const { safeEqual, checkSharedPassword, comparePasswordTimingSafe, forLog, verifyAdminToken } = await import('../services/adminAuth.js');
const app = createApp();

const SECRET = process.env.JWT_SECRET;
let ipCounter = 0;
// Each test uses its own client address so the login limiter (5 failures / 15 min / IP) never leaks between tests.
const client = () => `10.1.0.${++ipCounter}`;
const login = (path, body, ip = client()) => request(app).post(path).set('X-Forwarded-For', ip).send(body);

beforeEach(() => {
  mocks.findOne.mockReset();
  mocks.orderFind.mockReset().mockResolvedValue([]);
});

const accountDoc = (password = 'right-password') => ({
  _id: '64b000000000000000000009',
  username: 'saher',
  comparePassword: vi.fn(async (p) => p === password),
});

describe('POST /auth/login (shared ADMIN_PASSWORD)', () => {
  it('issues an 8-hour HS256 admin token for the right password', async () => {
    const res = await login('/auth/login', { password: process.env.ADMIN_PASSWORD });
    expect(res.status).toBe(200);
    const payload = jwt.verify(res.body.token, SECRET, { algorithms: ['HS256'] });
    expect(payload).toMatchObject({ role: 'admin', auth: 'shared-password' });
    expect(payload.exp - payload.iat).toBe(8 * 3600);
    expect(jwt.decode(res.body.token, { complete: true }).header.alg).toBe('HS256');
  });

  it.each([
    ['a wrong password', { password: 'nope' }],
    ['a password that only starts right', { password: `${process.env.ADMIN_PASSWORD}x` }],
    ['an empty password', { password: '' }],
    ['no password', {}],
    ['an object instead of text', { password: { $ne: null } }],
    ['an array instead of text', { password: [process.env.ADMIN_PASSWORD] }],
    ['a number', { password: 123 }],
  ])('refuses %s', async (_name, body) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await login('/auth/login', body);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
    warn.mockRestore();
  });

  it('stops after 5 failed attempts from one address, and still serves other addresses', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ip = client();
    for (let i = 0; i < 5; i += 1) expect((await login('/auth/login', { password: 'x' }, ip)).status).toBe(401);
    expect((await login('/auth/login', { password: 'x' }, ip)).status).toBe(429);
    expect((await login('/auth/login', { password: process.env.ADMIN_PASSWORD }, client())).status).toBe(200);
    warn.mockRestore();
  });

  it('does not log the password that was tried', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await login('/auth/login', { password: 'super-secret-guess' });
    expect(warn.mock.calls.flat().join(' ')).not.toContain('super-secret-guess');
    warn.mockRestore();
  });
});

describe('POST /admin/login (account in the database)', () => {
  it('issues the same kind of token, with the account in it', async () => {
    mocks.findOne.mockResolvedValue(accountDoc());
    const res = await login('/admin/login', { username: 'saher', password: 'right-password' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('saher');
    expect(mocks.findOne).toHaveBeenCalledWith({ username: 'saher' });
    expect(jwt.verify(res.body.token, SECRET, { algorithms: ['HS256'] })).toMatchObject({
      role: 'admin',
      auth: 'account',
      username: 'saher',
      id: '64b000000000000000000009',
    });
  });

  it('refuses a wrong password and an unknown username with the same answer', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.findOne.mockResolvedValueOnce(accountDoc());
    const wrong = await login('/admin/login', { username: 'saher', password: 'nope' });
    mocks.findOne.mockResolvedValueOnce(null);
    const unknown = await login('/admin/login', { username: 'ghost', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    warn.mockRestore();
  });

  it('never lets an operator object reach the database query (NoSQL injection)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // The classic "log in as the first user" payload.
    const res = await login('/admin/login', { username: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(401);
    expect(mocks.findOne).not.toHaveBeenCalled();

    // Same with a valid password but an operator as the username.
    const res2 = await login('/admin/login', { username: { $gt: '' }, password: 'right-password' });
    expect(res2.status).toBe(401);
    expect(mocks.findOne).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('writes a username with line breaks to the log as one safe line', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.findOne.mockResolvedValue(null);
    await login('/admin/login', { username: 'a"\n[2026] Admin logged in OK', password: 'x' });
    const line = warn.mock.calls.flat().join(' ');
    expect(line).not.toContain('\n');
    expect(line).toContain('\\n');
    warn.mockRestore();
  });

  it('shares the failed-attempt limiter with /auth/login', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.findOne.mockResolvedValue(null);
    const ip = client();
    for (let i = 0; i < 3; i += 1) await login('/auth/login', { password: 'x' }, ip);
    for (let i = 0; i < 2; i += 1) await login('/admin/login', { username: 'a', password: 'x' }, ip);
    expect((await login('/auth/login', { password: 'x' }, ip)).status).toBe(429);
    warn.mockRestore();
  });
});

describe('requireAdmin', () => {
  const get = (token) => {
    const req = request(app).get('/order/getAllOrders');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  const sign = (claims, options = { expiresIn: '1h' }, secret = SECRET) => jwt.sign(claims, secret, options);

  it('accepts a token from either sign-in route', async () => {
    const shared = (await login('/auth/login', { password: process.env.ADMIN_PASSWORD })).body.token;
    expect((await get(shared)).status).toBe(200);

    mocks.findOne.mockResolvedValue(accountDoc());
    const account = (await login('/admin/login', { username: 'saher', password: 'right-password' })).body.token;
    expect((await get(account)).status).toBe(200);
  });

  it('still accepts a token issued before tokens carried a role (an account token had id and username)', async () => {
    expect((await get(sign({ id: '1', username: 'saher' }))).status).toBe(200);
  });

  it('refuses a validly signed token that is not an admin token', async () => {
    expect((await get(sign({ role: 'user' }))).status).toBe(401);
    expect((await get(sign({ sub: 'someone' }))).status).toBe(401);
  });

  it('refuses another algorithm, "none" and a wrong secret', async () => {
    expect((await get(sign({ role: 'admin' }, { expiresIn: '1h', algorithm: 'HS512' }))).status).toBe(401);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
      JSON.stringify({ role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url')}.`;
    expect((await get(none)).status).toBe(401);
    expect((await get(sign({ role: 'admin' }, { expiresIn: '1h' }, 'another-secret-another-secret-xx'))).status).toBe(401);
  });

  it('refuses a token without an issue time, and one older than 8 hours whatever its exp says', async () => {
    const now = Math.floor(Date.now() / 1000);
    expect((await get(sign({ role: 'admin', exp: now + 7 * 24 * 3600 }, { noTimestamp: true }))).status).toBe(401); // no iat
    expect((await get(sign({ role: 'admin', iat: now - 9 * 3600, exp: now + 3600 }, {}))).status).toBe(401); // issued 9h ago
  });

  it('tolerates a few seconds of clock difference, and no more', async () => {
    const now = Math.floor(Date.now() / 1000);
    expect((await get(sign({ role: 'admin', iat: now, exp: now - 2 }, {}))).status).toBe(200); // expired 2s ago
    expect((await get(sign({ role: 'admin', iat: now - 60, exp: now - 30 }, {}))).status).toBe(401);
  });

  it('refuses a missing header, a wrong scheme and garbage', async () => {
    expect((await get()).status).toBe(401);
    expect((await request(app).get('/order/getAllOrders').set('Authorization', `Basic ${SECRET}`)).status).toBe(401);
    expect((await get('not.a.jwt')).status).toBe(401);
  });

  it('keeps private answers out of caches', async () => {
    expect((await get()).headers['cache-control']).toBe('no-store');
    const token = sign({ role: 'admin' });
    expect((await get(token)).headers['cache-control']).toBe('no-store');
  });
});

describe('every admin-only route refuses a visitor', () => {
  const routes = [
    ['get', '/admin/stats'],
    ['get', '/admin/prayers'],
    ['delete', '/admin/prayers/64b000000000000000000001'],
    ['get', '/admin/candles'],
    ['delete', '/admin/candles/64b000000000000000000001'],
    ['get', '/admin/products'],
    ['post', '/admin/products'],
    ['put', '/admin/products/64b000000000000000000001'],
    ['delete', '/admin/products/64b000000000000000000001'],
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
    ['post', '/live/create_room'],
    ['post', '/live/close_room'],
  ];

  it.each(routes)('%s %s -> 401', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
  });
});

describe('admin auth helpers', () => {
  it('safeEqual compares text without throwing on different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', 'a')).toBe(false);
    expect(safeEqual('é', 'é')).toBe(true);
  });

  it('checkSharedPassword needs a non-empty string equal to ADMIN_PASSWORD', () => {
    expect(checkSharedPassword(process.env.ADMIN_PASSWORD)).toBe(true);
    for (const bad of ['', undefined, null, 5, {}, [], 'x']) expect(checkSharedPassword(bad)).toBe(false);
  });

  it('checks a password against a dummy hash when the account does not exist', async () => {
    expect(await comparePasswordTimingSafe(null, 'anything')).toBe(false);
    expect(await comparePasswordTimingSafe(null, undefined)).toBe(false);
    const doc = accountDoc();
    expect(await comparePasswordTimingSafe(doc, 'right-password')).toBe(true);
    expect(await comparePasswordTimingSafe(doc, { $ne: 1 })).toBe(false);
  });

  it('forLog makes one safe, bounded line out of anything', () => {
    expect(forLog('a\nb')).toBe('"a\\nb"');
    expect(forLog(undefined)).toBe('""');
    expect(forLog('x'.repeat(500)).length).toBeLessThanOrEqual(80);
  });

  it('verifyAdminToken throws on junk', () => {
    expect(() => verifyAdminToken('junk')).toThrow();
  });
});
