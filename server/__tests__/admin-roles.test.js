import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// The role matrix: every dashboard route against every role, and against no token and the old tokens.

vi.mock('../model/admin.js', async () => (await import('./helpers/fakes.js')).fakeAdminModule());
vi.mock('../model/adminSession.js', async () => (await import('./helpers/fakes.js')).fakeModule('AdminSession'));
vi.mock('../model/auditLog.js', async () => (await import('./helpers/fakes.js')).fakeModule('AuditLog'));
vi.mock('../model/order.js', async () => (await import('./helpers/fakes.js')).fakeModule('Order'));
vi.mock('../model/candle.js', async () => (await import('./helpers/fakes.js')).fakeModule('Candle'));
vi.mock('../model/contact.js', async () => (await import('./helpers/fakes.js')).fakeModule('Contact'));
vi.mock('../model/review.js', async () => (await import('./helpers/fakes.js')).fakeModule('Review'));
vi.mock('../model/productReview.js', async () => (await import('./helpers/fakes.js')).fakeModule('ProductReview'));
vi.mock('../model/prayer.js', async () => (await import('./helpers/fakes.js')).fakeModule('Prayer'));
vi.mock('../model/product.js', async () => (await import('./helpers/fakes.js')).fakeModule('Product'));
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(async () => true), SENDER: {} }));

const { fakes } = await import('./helpers/fakes.js');
const { freshIp, signedIn, startClient } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { signSessionToken } = await import('../services/adminSessions.js');
const { setStreamClient } = await import('../services/cloudflareStream.js');
const { fakeStreamClient } = await import('../test-harness/fake-cloudflare.js');
const { utcToNazarethLocal } = await import('../services/liveSchedule.js');
setStreamClient(fakeStreamClient());
afterAll(() => setStreamClient(null));

const { http, close } = startClient(createApp());
afterAll(close);

const ID = '64b000000000000000000001';
const PRODUCT = { name: 'Olive wood cross', price: 12.5, img: 'https://example.com/a.jpg' };

// [method, path, lowest role allowed, body]
export const ROUTES = [
  ['get', '/admin/dashboard', 'viewer'],
  ['get', '/admin/orders', 'viewer'],
  ['get', `/admin/orders/${ID}`, 'viewer'],
  ['patch', `/admin/orders/${ID}`, 'editor', { done: false }],
  ['delete', `/admin/orders/${ID}`, 'owner'],
  ['get', '/admin/candles', 'viewer'],
  ['patch', `/admin/candles/${ID}`, 'editor', { done: true }],
  ['delete', `/admin/candles/${ID}`, 'editor'],
  ['get', '/admin/contacts', 'viewer'],
  ['patch', `/admin/contacts/${ID}`, 'editor', { done: true }],
  ['delete', `/admin/contacts/${ID}`, 'editor'],
  ['get', '/admin/site-reviews', 'viewer'],
  ['patch', `/admin/site-reviews/${ID}`, 'editor', { approved: false }],
  ['delete', `/admin/site-reviews/${ID}`, 'editor'],
  ['get', '/admin/product-reviews', 'viewer'],
  ['patch', `/admin/product-reviews/${ID}`, 'editor', { approved: false }],
  ['delete', `/admin/product-reviews/${ID}`, 'editor'],
  ['get', '/admin/prayers', 'viewer'],
  ['delete', `/admin/prayers/${ID}`, 'editor'],
  ['get', '/admin/products', 'viewer'],
  ['get', `/admin/products/${ID}`, 'viewer'],
  ['post', '/admin/products', 'editor', PRODUCT],
  ['put', `/admin/products/${ID}`, 'editor', { price: 9 }],
  ['patch', `/admin/products/${ID}`, 'editor', { price: 9 }],
  ['delete', `/admin/products/${ID}`, 'editor'],
  ['get', '/admin/export/orders.csv', 'editor'],
  ['get', '/admin/export/candles.csv', 'editor'],
  ['get', '/admin/export/contacts.csv', 'editor'],
  ['get', '/admin/export/payments.csv', 'editor'],
  ['get', '/admin/payments', 'viewer'],
  ['get', `/admin/payments/${ID}`, 'viewer'],
  ['patch', `/admin/payments/${ID}`, 'editor', { resolved: false }],
  ['post', '/admin/privacy/lookup', 'owner', { email: 'someone@example.com' }],
  ['post', '/admin/privacy/erase', 'owner', { email: 'someone@example.com', confirm: 'someone@example.com' }],
  ['get', '/admin/users', 'owner'],
  ['post', '/admin/users', 'owner', { username: 'newperson', password: 'a long unusual passphrase', role: 'viewer' }],
  ['patch', `/admin/users/${ID}`, 'owner', { disabled: false }],
  ['delete', `/admin/users/${ID}`, 'owner'],
  ['get', '/admin/audit', 'owner'],
  // Live broadcasting (route/admin/live.js), against the fake Cloudflare client installed below.
  ['get', '/admin/live', 'editor'],
  ['post', '/admin/live/start', 'editor', { title: 'Role matrix' }],
  ['post', '/admin/live/stop', 'editor', {}],
  // Recordings of broadcasts (route/admin/liveRecordings.js) and scheduled broadcasts (route/admin/liveSchedule.js).
  ['get', '/admin/live/recordings', 'editor'],
  ['post', '/admin/live/recordings', 'editor', { sessionId: ID, sizeBytes: 1024, durationSeconds: 60, mimeType: 'video/webm' }],
  ['post', `/admin/live/recordings/${ID}/upload-url`, 'editor', { sizeBytes: 1024 }],
  ['post', `/admin/live/recordings/${ID}/uploaded`, 'editor', {}],
  ['patch', `/admin/live/recordings/${ID}`, 'editor', { title: 'Role matrix' }],
  ['delete', `/admin/live/recordings/${ID}`, 'editor'],
  ['get', '/admin/live/schedule', 'editor'],
  ['post', '/admin/live/schedule', 'editor', { title: 'Role matrix', startsAtLocal: utcToNazarethLocal(Date.now() + 86_400_000) }],
  ['patch', `/admin/live/schedule/${ID}`, 'editor', { published: true }],
  ['delete', `/admin/live/schedule/${ID}`, 'editor'],
  ['get', '/admin/auth/me', 'viewer'],
  ['post', '/admin/auth/logout', 'viewer'],
];

const LOGOUT = '/admin/auth/logout'; // ends the caller's own session, so the aggregate checks below skip it
const RANK = { viewer: 1, editor: 2, owner: 3 };
const accounts = {};

beforeAll(async () => {
  // One account per role. (Each makes at most about 160 requests; the limit is 300 per admin per 15 minutes.)
  for (const role of Object.keys(RANK)) accounts[role] = await signedIn(signSessionToken, { username: `matrix-${role}`, role });
});

const call = (method, path, auth, body) => {
  const req = http[method](path).set('X-Forwarded-For', freshIp());
  if (auth) req.set(auth);
  return body ? req.send(body) : req.send();
};

describe('role matrix', () => {
  it('covers every dashboard route exactly once', () => {
    const keys = ROUTES.map(([m, p]) => `${m} ${p}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(ROUTES.length).toBeGreaterThanOrEqual(35);
  });

  describe.each(ROUTES)('%s %s (needs %s)', (method, path, minimum, body) => {
    it('401 without a token', async () => {
      const res = await call(method, path, null, body);
      expect(res.status).toBe(401);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it.each(Object.keys(RANK))('as %s', async (role) => {
      // A logout revokes the caller's session: use a fresh one so the other roles' requests keep working.
      const a = path === LOGOUT ? await signedIn(signSessionToken, { role }) : accounts[role];
      const res = await call(method, path, a.auth, body);
      if (RANK[role] < RANK[minimum]) {
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Forbidden' });
      } else {
        expect([401, 403]).not.toContain(res.status);
        expect(res.status).toBeLessThan(500);
      }
    });
  });

  it('a forbidden request changes nothing and writes no audit entry', async () => {
    fakes.AuditLog.reset();
    fakes.Order.seed([{ _id: ID, firstName: 'A', lastName: 'B', email: 'a@b.co', done: false }]);
    for (const [method, path, minimum, body] of ROUTES.filter(([, , m]) => m !== 'viewer')) {
      const res = await call(method, path, accounts.viewer.auth, body);
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    expect(fakes.AuditLog.docs).toHaveLength(0);
    expect(fakes.Order.byId(ID).done).toBe(false);
  });

  it('an editor is refused exactly the owner routes', async () => {
    const refused = [];
    for (const [method, path, minimum, body] of ROUTES.filter(([, p]) => p !== LOGOUT)) {
      if ((await call(method, path, accounts.editor.auth, body)).status === 403) refused.push(`${method} ${path}`);
    }
    expect(refused.sort()).toEqual(ROUTES.filter(([, p, m]) => m === 'owner').map(([m, p]) => `${m} ${p}`).sort());
  });

  it('a viewer can only read', async () => {
    const allowed = [];
    for (const [method, path, minimum, body] of ROUTES.filter(([, p]) => p !== LOGOUT)) {
      if ((await call(method, path, accounts.viewer.auth, body)).status !== 403) allowed.push(method);
    }
    expect([...new Set(allowed)]).toEqual(['get']);
    expect(ROUTES.filter(([m, , min]) => m === 'get' && min === 'viewer').length).toBeGreaterThan(0);
  });

  it('refuses an account whose stored role is not a real role (damaged data gives no access)', async () => {
    const odd = await signedIn(signSessionToken, { role: 'superuser' });
    expect((await call('get', '/admin/orders', odd.auth)).status).toBe(401);
    expect((await call('get', '/admin/users', odd.auth)).status).toBe(401);
  });

  it('a token that claims owner but whose account is a viewer is a viewer', async () => {
    const a = await signedIn(signSessionToken, { role: 'viewer' });
    const forged = signSessionToken({ id: a.admin._id, role: 'owner' }, a.sid);
    expect((await call('get', '/admin/users', { Authorization: `Bearer ${forged}` })).status).toBe(403);
  });

  it('unknown dashboard addresses answer 401 without a token and 404 with one', async () => {
    expect((await call('get', '/admin/orders/unknown/deep', null)).status).toBe(401);
    expect((await call('get', '/admin/nothing-here', accounts.owner.auth)).status).toBe(404);
  });
});
