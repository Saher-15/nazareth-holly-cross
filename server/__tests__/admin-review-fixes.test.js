import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';

// The fixes of the dashboard review (review 04, docs/ADMIN.md): prices with at most two decimals, product photos only on
// the hosts the website can show, the website asked to refresh after a product change, orders found by their number,
// revenue from verified payments only, account e-mail and unlock, and the audit log naming its targets.

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

const mail = vi.hoisted(() => ({ sendMail: vi.fn(async () => true) }));
vi.mock('../services/emailService.js', () => ({ sendMail: mail.sendMail, SENDER: {} }));

const { fakes, oid, quickHash } = await import('./helpers/fakes.js');
const { PASSWORD, allFilters, castProblem, freshIp, sanitizeChanges, signedIn, startClient } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { signSessionToken } = await import('../services/adminSessions.js');
const { config } = await import('../config/env.js');
const { refreshSite, siteRefreshConfigured } = await import('../services/siteRefresh.js');
const { orderNumberClause } = await import('../route/admin/orders.js');
const { resetDashboardCache } = await import('../services/dashboard.js');

const { http, close } = startClient(createApp());
afterAll(close);

let owner;
let editor;
beforeAll(async () => {
  owner = await signedIn(signSessionToken, { username: 'the-owner', role: 'owner' });
  editor = await signedIn(signSessionToken, { username: 'the-editor', role: 'editor' });
});

const SITE = { ...config.site };
beforeEach(() => {
  for (const name of ['Order', 'Product', 'AuditLog']) fakes[name].reset();
  mail.sendMail.mockReset().mockResolvedValue(true);
  resetDashboardCache();
});
afterEach(() => {
  Object.assign(config.site, SITE);
  vi.unstubAllGlobals();
});

const call = (method, path, who = owner, body) => {
  const req = http[method](path).set('X-Forwarded-For', freshIp()).set(who.auth);
  return body === undefined ? req : req.send(body);
};
const audits = (action) => fakes.AuditLog.docs.filter((d) => !action || d.action === action);
const FIREBASE = 'https://firebasestorage.googleapis.com/v0/b/x/o/cross.jpg?alt=media&token=abc';
const GOOD = { name: 'Olive wood cross', price: 12.5, img: FIREBASE };

describe('products: price', () => {
  it.each([[24.505], [1.001], [10.123]])('refuses %s (more than two decimals: "24,50" typed as 2450 is caught in the form)', async (price) => {
    const res = await call('post', '/admin/products', editor, { ...GOOD, price });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid price: at most two decimals');
  });

  it.each([[24.5], [0.07], [0.1 + 0.2], [9999.99], [10000]])('accepts %s', async (price) => {
    expect((await call('post', '/admin/products', editor, { ...GOOD, price })).status).toBe(201);
  });
});

describe('products: photos only on the hosts the website can show', () => {
  it.each([
    ['img on another host', { img: 'https://upload.wikimedia.org/a.jpg' }, /^Invalid img: the website shows photos only from firebasestorage\.googleapis\.com$/],
    ['an extra photo on another host', { additionalImageUrls: [FIREBASE, 'https://example.com/b.jpg'] }, /^Invalid additionalImageUrls/],
    ['plain http on Firebase', { img: FIREBASE.replace('https:', 'http:') }, /^Invalid img/],
  ])('refuses %s on create', async (_name, over, message) => {
    const res = await call('post', '/admin/products', editor, { ...GOOD, ...over });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(fakes.Product.docs).toHaveLength(0);
  });

  it('accepts a local address outside production (the harness and development)', async () => {
    expect((await call('post', '/admin/products', editor, { ...GOOD, img: 'http://localhost:3911/mock/a.svg' })).status).toBe(201);
  });

  it('an older product keeps its photo editable around it, but a NEW address must be on an allowed host', async () => {
    const [p] = fakes.Product.seed([{ ...GOOD, img: 'https://example.com/old.jpg', additionalImageUrls: ['https://example.com/old2.jpg'] }]);
    const same = await call('put', `/admin/products/${p._id}`, editor, { name: 'Renamed', img: 'https://example.com/old.jpg', additionalImageUrls: ['https://example.com/old2.jpg'], stock: 3 });
    expect(same.status).toBe(200);
    expect(same.body.item).toMatchObject({ name: 'Renamed', stock: 3 });
    const other = await call('put', `/admin/products/${p._id}`, editor, { img: 'https://example.com/new.jpg' });
    expect(other.status).toBe(400);
    expect((await call('patch', `/admin/products/${p._id}`, editor, { img: FIREBASE })).status).toBe(200);
    expect((await call('patch', `/admin/products/${oid()}`, editor, { img: FIREBASE })).status).toBe(404);
  });

  it('follows PRODUCT_IMAGE_HOSTS', async () => {
    const before = [...config.productImageHosts];
    config.productImageHosts.push('images.example.org');
    try {
      expect((await call('post', '/admin/products', editor, { ...GOOD, img: 'https://images.example.org/a.jpg' })).status).toBe(201);
    } finally {
      config.productImageHosts.splice(0, config.productImageHosts.length, ...before);
    }
  });
});

describe('the website is asked to refresh after a product change (services/siteRefresh.js)', () => {
  it('without REVALIDATE_SECRET nothing is called and the answer says "off"', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    config.site.revalidateSecret = '';
    const res = await call('post', '/admin/products', editor, GOOD);
    expect(res.status).toBe(201);
    expect(res.body.siteRefresh).toBe('off');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(siteRefreshConfigured()).toBe(false);
    config.site.revalidateSecret = 'too-short';
    expect(siteRefreshConfigured()).toBe(false);
  });

  it('with it: POST <SITE_URL>/api/revalidate with the secret in the header and the product id; "done" on success', async () => {
    const secret = 'x'.repeat(40);
    Object.assign(config.site, { url: 'https://site.example', revalidateSecret: secret });
    const fetchSpy = vi.fn(async () => new Response('{"revalidated":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const created = await call('post', '/admin/products', editor, GOOD);
    expect(created.body.siteRefresh).toBe('done');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://site.example/api/revalidate');
    expect(init).toMatchObject({ method: 'POST', redirect: 'error' });
    expect(init.headers.Authorization).toBe(`Bearer ${secret}`);
    expect(JSON.parse(init.body)).toEqual({ scope: 'shop', productIds: [String(created.body.item._id)] });
    const id = created.body.item._id;
    expect((await call('patch', `/admin/products/${id}`, editor, { stock: 0 })).body.siteRefresh).toBe('done');
    expect((await call('delete', `/admin/products/${id}`, editor)).body.siteRefresh).toBe('done');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    // the secret is in the header only: not in answers, the audit log, or the body
    expect(JSON.stringify(fakes.AuditLog.docs)).not.toContain(secret);
    expect(JSON.stringify(created.body)).not.toContain(secret);
  });

  it('"failed" when the site refuses or cannot be reached; the product change is kept either way', async () => {
    Object.assign(config.site, { url: 'https://site.example', revalidateSecret: 'y'.repeat(40) });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 401 })));
    const res = await call('post', '/admin/products', editor, GOOD);
    expect(res.status).toBe(201);
    expect(res.body.siteRefresh).toBe('failed');
    expect(await refreshSite(['nope'], { fetchImpl: async () => { throw new TypeError('fetch failed'); } })).toBe('failed');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('y'.repeat(40));
    expect(fakes.Product.docs).toHaveLength(1);
    warn.mockRestore();
  });
});

const order = (over = {}) => ({
  firstName: 'Anna', lastName: 'Cohen', email: 'anna@example.com', phone: '050', city: 'Nazareth', country: 'IL', totalPrice: 40,
  products: [{ productID: oid(), productName: 'Olive cross', quantity: 2 }], done: false, paymentVerified: true, createdAt: new Date(), ...over,
});

describe('orders: found by the number people quote', () => {
  it.each([
    ['the number with #', (id) => `#${id.slice(-8)}`],
    ['the number without #', (id) => id.slice(-8)],
    ['in capitals', (id) => `#${id.slice(-8).toUpperCase()}`],
    ['the full id', (id) => id],
    ['the full id with #', (id) => `#${id}`],
  ])('%s', async (_name, query) => {
    const [a] = fakes.Order.seed([order({ _id: 'c0000000000000000000003f' }), order({ _id: 'c00000000000000000000040' })]);
    const res = await call('get', `/admin/orders?q=${encodeURIComponent(query(a._id))}`, editor);
    expect(res.status).toBe(200);
    expect(res.body.items.map((o) => o._id)).toEqual(['c0000000000000000000003f']);
  });

  it('a short or non-hex text is no order number (names are searched as before)', () => {
    expect(orderNumberClause('3f')).toBeNull();
    expect(orderNumberClause('Cohen')).toBeNull();
    expect(orderNumberClause('#zz000000')).toBeNull();
    expect(orderNumberClause('#0000003f')).toEqual({ $expr: expect.objectContaining({ $regexMatch: { input: { $toString: '$_id' }, regex: '0000003f$', options: 'i' } }) });
  });

  it('the shipped e-mail and the CSV use the same number', async () => {
    const [o] = fakes.Order.seed([order({ _id: 'c0000000000000000000003f', done: false })]);
    await call('patch', `/admin/orders/${o._id}`, editor, { done: true });
    expect(mail.sendMail.mock.calls[0][0]).toMatchObject({ subject: 'Your order #0000003f was shipped' });
    const csv = await call('get', '/admin/export/orders.csv', editor);
    expect(csv.text.split('\r\n')[1].startsWith('c0000000000000000000003f,#0000003f,')).toBe(true);
  });
});

describe('dashboard: revenue counts verified payments only', () => {
  it('the unverified orders are counted apart (number and amount)', async () => {
    fakes.Order.aggregateImpl = (pipeline) => {
      const first = pipeline[0];
      if (first.$group?._id === null) {
        expect(first.$group.revenue).toEqual({ $sum: { $cond: [{ $eq: ['$paymentVerified', true] }, '$totalPrice', 0] } });
        return [{ _id: null, orders: 4, ordersPending: 1, revenue: 100, revenueUnverified: 30.005, ordersUnverified: 1 }];
      }
      if (first.$match?.createdAt) {
        expect(first.$group?.revenue ?? pipeline[1].$group.revenue).toEqual({ $sum: { $cond: [{ $eq: ['$paymentVerified', true] }, '$totalPrice', 0] } });
      }
      return [];
    };
    const res = await call('get', '/admin/dashboard', editor);
    expect(res.body.totals).toMatchObject({ orders: 4, revenue: 100, revenueUnverified: 30.01, ordersUnverified: 1 });
    fakes.Order.aggregateImpl = undefined;
  });
});

describe('users: e-mail for "Forgot your password?", unlock', () => {
  beforeEach(() => {
    fakes.Admin.reset();
    fakes.AdminSession.reset();
  });

  it('creates an account with an e-mail address (lower case), refuses one that another account uses', async () => {
    const me = await signedIn(signSessionToken, { username: 'boss', role: 'owner' });
    const base = { username: 'new.editor', password: 'a long unusual passphrase', role: 'editor' };
    const res = await call('post', '/admin/users', me, { ...base, email: 'New.Editor@Example.com' });
    expect(res.status).toBe(201);
    expect(res.body.item.email).toBe('new.editor@example.com');
    expect(audits('user.create')[0].meta).toMatchObject({ username: 'new.editor', email: true });
    expect(JSON.stringify(audits())).not.toContain('example.com');
    expect((await call('post', '/admin/users', me, { ...base, username: 'second', email: 'NEW.EDITOR@example.com' })).status).toBe(409);
    expect((await call('post', '/admin/users', me, { ...base, username: 'third', email: 'not-an-address' })).status).toBe(400);
    expect((await call('post', '/admin/users', me, { ...base, username: 'fourth', email: '' })).status).toBe(201);
    // another account's USERNAME is an address (the first owner's): it cannot be someone else's e-mail either
    fakes.Admin.seed([{ username: 'owner@example.org', password: quickHash(PASSWORD), role: 'owner' }]);
    expect((await call('post', '/admin/users', me, { ...base, username: 'fifth', email: 'owner@example.org' })).status).toBe(409);
  });

  it('sets, changes and removes the e-mail with PATCH (audited without the address); the reset link then reaches it', async () => {
    const me = await signedIn(signSessionToken, { username: 'boss', role: 'owner' });
    const [u] = fakes.Admin.seed([{ username: 'staff', password: quickHash(PASSWORD), role: 'editor' }]);
    const set = await call('patch', `/admin/users/${u._id}`, me, { email: 'staff@example.com' });
    expect(set.status).toBe(200);
    expect(set.body.item.email).toBe('staff@example.com');
    expect(audits('user.update')[0].meta).toMatchObject({ email: 'changed' });
    const forgot = await http.post('/admin/auth/forgot-password').set('X-Forwarded-For', freshIp()).send({ email: 'staff@example.com' });
    expect(forgot.status).toBe(202);
    await vi.waitFor(() => expect(mail.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: ['staff@example.com'] })));
    const removed = await call('patch', `/admin/users/${u._id}`, me, { email: '' });
    expect(removed.body.item.email).toBe('');
    expect(audits('user.update')[1].meta).toMatchObject({ email: 'removed' });
    // an owner may set their own address too
    expect((await call('patch', `/admin/users/${me.admin._id}`, me, { email: 'boss@example.com' })).status).toBe(200);
  });

  it('unlock lifts a lockout only (no session ends, the role and the state stay), and is audited', async () => {
    const me = await signedIn(signSessionToken, { username: 'boss', role: 'owner' });
    const [u] = fakes.Admin.seed([{ username: 'locked', password: quickHash(PASSWORD), role: 'editor', failedLogins: 5, lockedUntil: new Date(Date.now() + 10 * 60_000) }]);
    const before = await call('get', '/admin/users', me);
    expect(before.body.items.find((x) => x.username === 'locked').lockedUntil).toBeTruthy();
    const res = await call('patch', `/admin/users/${u._id}`, me, { unlock: true });
    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({ lockedUntil: null, disabled: false, role: 'editor' });
    expect(fakes.Admin.byId(u._id).failedLogins).toBe(0);
    expect(audits('user.update')[0].meta).toMatchObject({ unlock: true });
    const login = await http.post('/admin/auth/login').set('X-Forwarded-For', freshIp()).send({ username: 'locked', password: PASSWORD });
    expect(login.status).toBe(200);
    // an editor cannot
    const ed = await signedIn(signSessionToken, { username: 'ed', role: 'editor' });
    expect((await call('patch', `/admin/users/${u._id}`, ed, { unlock: true })).status).toBe(403);
  });

  it('every new filter survives sanitizeFilter and casts against the real schemas', async () => {
    const me = await signedIn(signSessionToken, { username: 'boss', role: 'owner' });
    const [u] = fakes.Admin.seed([{ username: 'staff', password: quickHash(PASSWORD), role: 'editor' }]);
    await call('patch', `/admin/users/${u._id}`, me, { email: 'staff@example.com' });
    await call('post', '/admin/users', me, { username: 'x.y', password: 'a long unusual passphrase', role: 'viewer', email: 'x@example.com' });
    fakes.Order.seed([order()]);
    await call('get', '/admin/orders?q=%230000003f', editor);
    await call('get', '/admin/audit', me);
    const filters = allFilters();
    for (const { name, op, filter } of filters) expect(sanitizeChanges(filter), `${name}.${op} ${JSON.stringify(filter)}`).toBeNull();
    for (const { name, op, filter } of filters) expect(await castProblem(name, filter), `${name}.${op} ${JSON.stringify(filter)}`).toBeNull();
  });
});

describe('audit log: targets named for a person', () => {
  it('a user by username, a product by name, an order by its number; nothing for the rest', async () => {
    const me = await signedIn(signSessionToken, { username: 'boss', role: 'owner' });
    const [u] = fakes.Admin.seed([{ username: 'staff', password: quickHash(PASSWORD), role: 'editor' }]);
    const [p] = fakes.Product.seed([GOOD]);
    const gone = oid();
    fakes.AuditLog.seed([
      { at: new Date(Date.now() - 4000), actorName: 'boss', action: 'user.update', target: { type: 'user', id: String(u._id) }, meta: { role: 'viewer' } },
      { at: new Date(Date.now() - 3000), actorName: 'boss', action: 'product.update', target: { type: 'product', id: String(p._id) }, meta: { fields: ['price'] } },
      { at: new Date(Date.now() - 2000), actorName: 'boss', action: 'product.delete', target: { type: 'product', id: gone }, meta: { name: 'Old rosary' } },
      { at: new Date(Date.now() - 1000), actorName: 'boss', action: 'order.update', target: { type: 'order', id: 'c0000000000000000000003f' }, meta: { done: true } },
      { at: new Date(), actorName: 'boss', action: 'auth.login', target: {}, meta: {} },
    ]);
    const res = await call('get', '/admin/audit?sort=at', me);
    expect(res.status).toBe(200);
    expect(res.body.items.map((e) => e.targetName ?? null)).toEqual(['staff', 'Olive wood cross', 'Old rosary', '#0000003f', null]);
  });
});
