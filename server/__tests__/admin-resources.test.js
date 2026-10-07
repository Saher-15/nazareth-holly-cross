import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// The data routes: lists (pagination, search, status, sort), details, changes, e-mail on shipping, products,
// CSV export, the dashboard, the audit trail of every change, and that the old admin site's routes and tokens are gone.

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

const { fakes, oid } = await import('./helpers/fakes.js');
const { allFilters, castProblem, freshIp, sanitizeChanges, signedIn, startClient } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { signSessionToken } = await import('../services/adminSessions.js');
const { getCatalog } = await import('../services/catalog.js');
const { getDashboard, resetDashboardCache, buildDashboard, CACHE_MS } = await import('../services/dashboard.js');

const { http, close } = startClient(createApp());
afterAll(close);

let owner;
let editor;
let viewer;
beforeAll(async () => {
  owner = await signedIn(signSessionToken, { username: 'the-owner', role: 'owner' });
  editor = await signedIn(signSessionToken, { username: 'the-editor', role: 'editor' });
  viewer = await signedIn(signSessionToken, { username: 'the-viewer', role: 'viewer' });
});

beforeEach(() => {
  for (const name of ['Order', 'Candle', 'Contact', 'Review', 'ProductReview', 'Prayer', 'Product', 'AuditLog']) fakes[name].reset();
  mail.sendMail.mockReset().mockResolvedValue(true);
  resetDashboardCache();
});

const call = (method, path, who = owner, body) => {
  const req = http[method](path).set('X-Forwarded-For', freshIp()).set(who.auth);
  return body === undefined ? req : req.send(body);
};
const audits = (action) => fakes.AuditLog.docs.filter((d) => !action || d.action === action);
const days = (n) => new Date(Date.now() - n * 86_400_000);

const order = (over = {}) => ({
  firstName: 'Anna', lastName: 'Cohen', email: 'anna@example.com', phone: '050', city: 'Nazareth', country: 'IL', totalPrice: 40,
  products: [{ productID: oid(), productName: 'Olive cross', quantity: 2 }], done: false, paymentVerified: true, ...over,
});

describe('lists: GET /admin/orders (the same rules apply to every list)', () => {
  it('answers { items, total, page, size } newest first', async () => {
    fakes.Order.seed([order({ lastName: 'Old', createdAt: days(3) }), order({ lastName: 'New', createdAt: days(1) }), order({ lastName: 'Mid', createdAt: days(2) })]);
    const res = await call('get', '/admin/orders');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 3, page: 1, size: 25 });
    expect(res.body.items.map((o) => o.lastName)).toEqual(['New', 'Mid', 'Old']);
  });

  it('paginates', async () => {
    fakes.Order.seed(Array.from({ length: 7 }, (_, i) => order({ lastName: `L${i}`, createdAt: days(i) })));
    const page2 = await call('get', '/admin/orders?page=2&size=3');
    expect(page2.body).toMatchObject({ total: 7, page: 2, size: 3 });
    expect(page2.body.items.map((o) => o.lastName)).toEqual(['L3', 'L4', 'L5']);
    const last = await call('get', '/admin/orders?page=3&size=3');
    expect(last.body.items).toHaveLength(1);
    const beyond = await call('get', '/admin/orders?page=9&size=3');
    expect(beyond.body.items).toEqual([]);
    expect(beyond.body.total).toBe(7);
  });

  it('keeps page and size within bounds whatever is asked (the database never sees a hostile skip or limit)', async () => {
    fakes.Order.seed([order()]);
    const asks = [
      ['size=5000', 1, 100], ['size=0', 1, 1], ['size=-5', 1, 1], ['size=abc', 1, 25], ['page=0', 1, 25], ['page=-9', 1, 25],
      ['page=99999999999999', 10000, 25], ['size[]=5', 1, 25], ['page[$gt]=1', 1, 25], ['size=1e9', 1, 1],
    ];
    for (const [query, page, size] of asks) {
      fakes.Order.calls.length = 0;
      const res = await call('get', `/admin/orders?${query}`);
      expect(res.status, query).toBe(200);
      expect(res.body.page, query).toBe(page);
      expect(res.body.size, query).toBe(size);
      const find = fakes.Order.calls.find((c) => c.op === 'find');
      expect(find.limit, query).toBe(size);
      expect(find.skip, query).toBe((page - 1) * size);
      expect(find.skip).toBeGreaterThanOrEqual(0);
    }
  });

  it('searches text literally and case-insensitively (regex characters are escaped)', async () => {
    fakes.Order.seed([order({ lastName: 'O\'Brien (jr.)' }), order({ lastName: 'Levi' }), order({ lastName: 'Mizrahi', email: 'x@y.com' })]);
    expect((await call('get', '/admin/orders?q=levi')).body.total).toBe(1);
    expect((await call('get', '/admin/orders?q=BRIEN (JR.)')).body.total).toBe(1);
    expect((await call('get', '/admin/orders?q=.*')).body.total).toBe(0); // not a wildcard
    expect((await call('get', '/admin/orders?q=(')).status).toBe(200); // not a regex syntax error
    expect((await call('get', `/admin/orders?q=${'a'.repeat(101)}`)).status).toBe(400);
    expect((await call('get', '/admin/orders?q[$ne]=zzz')).body.total).toBe(3); // an operator object is dropped, not run
    const id = fakes.Order.docs[1]._id;
    expect((await call('get', `/admin/orders?q=${id}`)).body.items.map((o) => o._id)).toEqual([id]);
  });

  it('filters by status and refuses unknown statuses', async () => {
    fakes.Order.seed([order({ done: false }), order({ done: true }), order({ done: false, paymentVerified: false })]);
    expect((await call('get', '/admin/orders?status=pending')).body.total).toBe(2);
    expect((await call('get', '/admin/orders?status=shipped')).body.total).toBe(1);
    expect((await call('get', '/admin/orders?status=unverified')).body.total).toBe(1);
    expect((await call('get', '/admin/orders?status=all')).body.total).toBe(3);
    expect((await call('get', '/admin/orders?status=bogus')).status).toBe(400);
  });

  it('sorts by whitelisted fields only', async () => {
    fakes.Order.seed([order({ totalPrice: 30 }), order({ totalPrice: 10 }), order({ totalPrice: 20 })]);
    expect((await call('get', '/admin/orders?sort=totalPrice')).body.items.map((o) => o.totalPrice)).toEqual([10, 20, 30]);
    expect((await call('get', '/admin/orders?sort=-totalPrice')).body.items.map((o) => o.totalPrice)).toEqual([30, 20, 10]);
    for (const bad of ['email', 'password', '$where', 'constructor', '-__proto__']) {
      expect((await call('get', `/admin/orders?sort=${encodeURIComponent(bad)}`)).status, bad).toBe(400);
    }
  });

  it('every list answers the same shape', async () => {
    for (const path of ['candles', 'contacts', 'site-reviews', 'product-reviews', 'prayers', 'products']) {
      const res = await call('get', `/admin/${path}?size=5`);
      expect(res.status, path).toBe(200);
      expect(Object.keys(res.body).sort(), path).toEqual(['items', 'page', 'size', 'total']);
    }
  });

  it('is open to a viewer', async () => {
    expect((await call('get', '/admin/orders', viewer)).status).toBe(200);
  });
});

describe('GET /admin/orders/:id', () => {
  it('returns the order, 404 for a missing one, 400 for a malformed id', async () => {
    const [o] = fakes.Order.seed([order()]);
    expect((await call('get', `/admin/orders/${o._id}`)).body).toMatchObject({ _id: o._id, email: 'anna@example.com' });
    expect((await call('get', `/admin/orders/${oid()}`)).status).toBe(404);
    for (const bad of ['abc', 'g'.repeat(24), '1'.repeat(25), '..%2F..%2Fetc', '%24ne']) {
      expect((await call('get', `/admin/orders/${bad}`)).status, bad).toBe(400);
    }
  });
});

describe('PATCH /admin/orders/:id { done } (shipping)', () => {
  it('marks shipped and e-mails the customer (the mail the removed /order/orderSent used to send)', async () => {
    const [o] = fakes.Order.seed([order({ email: 'buyer@example.com' })]);
    const res = await call('patch', `/admin/orders/${o._id}`, editor, { done: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ emailSent: true, item: { _id: o._id, done: true } });
    expect(fakes.Order.byId(o._id).done).toBe(true);
    expect(mail.sendMail).toHaveBeenCalledTimes(1);
    expect(mail.sendMail).toHaveBeenCalledWith({
      to: ['buyer@example.com'],
      subject: `Your order #${String(o._id).slice(-8)} was shipped`,
      text: `Your order #${String(o._id).slice(-8)} was shipped :) (reference ${o._id})`,
    });
    expect(audits('order.update')[0]).toMatchObject({ actorName: 'the-editor', role: 'editor', target: { type: 'order', id: o._id }, meta: { done: true, emailSent: true } });
  });

  it('sends the mail once: shipping an order that is already shipped sends nothing', async () => {
    const [o] = fakes.Order.seed([order()]);
    await call('patch', `/admin/orders/${o._id}`, editor, { done: true });
    const again = await call('patch', `/admin/orders/${o._id}`, editor, { done: true });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ emailSent: null, item: { done: true } });
    expect(mail.sendMail).toHaveBeenCalledTimes(1);
  });

  it('keeps the change when the mail cannot be sent, and says so', async () => {
    mail.sendMail.mockResolvedValue(false);
    const [o] = fakes.Order.seed([order()]);
    const res = await call('patch', `/admin/orders/${o._id}`, editor, { done: true });
    expect(res.status).toBe(200);
    expect(res.body.emailSent).toBe(false);
    expect(fakes.Order.byId(o._id).done).toBe(true);
    expect(audits('order.update')[0].meta.emailSent).toBe(false);
  });

  it('can un-ship without sending anything', async () => {
    const [o] = fakes.Order.seed([order({ done: true })]);
    const res = await call('patch', `/admin/orders/${o._id}`, editor, { done: false });
    expect(res.body).toMatchObject({ emailSent: null, item: { done: false } });
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('refuses a body that is not exactly { done: boolean }', async () => {
    const [o] = fakes.Order.seed([order()]);
    for (const body of [{}, { done: 'true' }, { done: 1 }, { done: null }, { done: true, email: 'x@y.com' }, { done: true, totalPrice: 1 }, [true], 'done']) {
      expect((await call('patch', `/admin/orders/${o._id}`, editor, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(fakes.Order.byId(o._id).done).toBe(false);
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('404 for a missing order, and a viewer cannot ship', async () => {
    expect((await call('patch', `/admin/orders/${oid()}`, editor, { done: true })).status).toBe(404);
    const [o] = fakes.Order.seed([order()]);
    expect((await call('patch', `/admin/orders/${o._id}`, viewer, { done: true })).status).toBe(403);
    expect(mail.sendMail).not.toHaveBeenCalled();
  });
});

describe('DELETE /admin/orders/:id (owner only)', () => {
  it('deletes and audits; an editor cannot', async () => {
    const [o] = fakes.Order.seed([order()]);
    expect((await call('delete', `/admin/orders/${o._id}`, editor)).status).toBe(403);
    expect(fakes.Order.docs).toHaveLength(1);
    expect((await call('delete', `/admin/orders/${o._id}`, owner)).status).toBe(200);
    expect(fakes.Order.docs).toHaveLength(0);
    expect(audits('order.delete')[0]).toMatchObject({ actorName: 'the-owner', target: { type: 'order', id: o._id } });
    expect((await call('delete', `/admin/orders/${o._id}`, owner)).status).toBe(404);
  });
});

describe('candles, contacts, site reviews, product reviews, prayers', () => {
  const cases = [
    { path: 'candles', Model: 'Candle', type: 'candle', flag: 'done', seed: { firstName: 'A', lastName: 'B', email: 'a@b.co', prayer: 'Please light a candle', done: false }, status: ['pending', 'done'] },
    { path: 'contacts', Model: 'Contact', type: 'contact', flag: 'done', seed: { fullName: 'Ann', email: 'a@b.co', msg: 'Hello there', done: false }, status: ['open', 'done'] },
    { path: 'site-reviews', Model: 'Review', type: 'site-review', flag: 'approved', seed: { fullName: 'Ann', msg: 'Lovely', approved: true }, status: ['approved', 'hidden'] },
    { path: 'product-reviews', Model: 'ProductReview', type: 'product-review', flag: 'approved', seed: { name: 'Ann', rating: 5, comment: 'Great', approved: true }, status: ['approved', 'hidden'] },
  ];

  describe.each(cases)('/admin/$path', ({ path, Model, type, flag, seed, status }) => {
    const initial = flag === 'done' ? false : true;

    it(`PATCH { ${flag} } changes it and audits`, async () => {
      const [doc] = fakes[Model].seed([seed]);
      const res = await call('patch', `/admin/${path}/${doc._id}`, editor, { [flag]: !initial });
      expect(res.status).toBe(200);
      expect(res.body.item[flag]).toBe(!initial);
      expect(fakes[Model].byId(doc._id)[flag]).toBe(!initial);
      expect(audits(`${type}.update`)[0]).toMatchObject({ target: { type, id: doc._id }, meta: { [flag]: !initial } });
    });

    it('PATCH refuses anything but exactly that boolean, and unknown ids', async () => {
      const [doc] = fakes[Model].seed([seed]);
      for (const body of [{}, { [flag]: 'yes' }, { [flag]: true, extra: 1 }, { other: true }]) {
        expect((await call('patch', `/admin/${path}/${doc._id}`, editor, body)).status, JSON.stringify(body)).toBe(400);
      }
      expect((await call('patch', `/admin/${path}/${oid()}`, editor, { [flag]: true })).status).toBe(404);
      expect((await call('patch', `/admin/${path}/not-an-id`, editor, { [flag]: true })).status).toBe(400);
    });

    it('DELETE removes it, audits, and 404s the second time; a viewer cannot', async () => {
      const [doc] = fakes[Model].seed([seed]);
      expect((await call('delete', `/admin/${path}/${doc._id}`, viewer)).status).toBe(403);
      expect((await call('delete', `/admin/${path}/${doc._id}`, editor)).status).toBe(200);
      expect(fakes[Model].docs).toHaveLength(0);
      expect(audits(`${type}.delete`)).toHaveLength(1);
      expect((await call('delete', `/admin/${path}/${doc._id}`, editor)).status).toBe(404);
    });

    it('GET /:id returns one document to a viewer (the dashboard opens its detail drawers by address)', async () => {
      const [doc] = fakes[Model].seed([seed]);
      const res = await call('get', `/admin/${path}/${doc._id}`, viewer);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ _id: doc._id, ...seed });
      expect((await call('get', `/admin/${path}/${oid()}`, viewer)).status).toBe(404);
      expect((await call('get', `/admin/${path}/not-an-id`, viewer)).status).toBe(400);
    });

    it('lists with the status filter', async () => {
      fakes[Model].seed([seed, { ...seed, [flag]: !initial }]);
      expect((await call('get', `/admin/${path}?status=${status[0]}`)).body.total).toBe(1);
      expect((await call('get', `/admin/${path}?status=${status[1]}`)).body.total).toBe(1);
      expect((await call('get', `/admin/${path}`)).body.total).toBe(2);
      expect((await call('get', `/admin/${path}?status=bogus`)).status).toBe(400);
    });
  });

  it('candles can be searched by prayer text and contacts by message', async () => {
    fakes.Candle.seed([{ firstName: 'A', lastName: 'B', email: 'a@b.co', prayer: 'For my mother', done: false }]);
    fakes.Contact.seed([{ fullName: 'Ann', email: 'a@b.co', msg: 'Do you ship to Brazil?', done: false }]);
    expect((await call('get', '/admin/candles?q=mother')).body.total).toBe(1);
    expect((await call('get', '/admin/contacts?q=brazil')).body.total).toBe(1);
    expect((await call('get', '/admin/contacts?q=nothing')).body.total).toBe(0);
  });

  it('prayers can be listed, searched and deleted (no PATCH)', async () => {
    const [p] = fakes.Prayer.seed([{ name: 'Maria', country: 'Brazil', prayer: 'Peace please', category: 'Peace', likes: 3 }]);
    expect((await call('get', '/admin/prayers?q=maria')).body.total).toBe(1);
    expect((await call('get', `/admin/prayers/${p._id}`, viewer)).body).toMatchObject({ name: 'Maria' });
    expect((await call('patch', `/admin/prayers/${p._id}`, editor, { approved: false })).status).toBe(404);
    expect((await call('delete', `/admin/prayers/${p._id}`, editor)).status).toBe(200);
    expect(audits('prayer.delete')).toHaveLength(1);
  });
});

describe('products', () => {
  const GOOD = { name: 'Olive wood cross', price: 12.5, img: 'https://firebasestorage.googleapis.com/v0/b/x/o/cross.jpg?alt=media&token=abc' };
  const post = (body, who = editor) => call('post', '/admin/products', who, body);

  it('creates a product from whitelisted, validated fields only and audits it', async () => {
    const res = await post({
      ...GOOD, additionalImageUrls: ['https://firebasestorage.googleapis.com/v0/b/x/o/b.jpg'], description: 'Hand carved', uuidv4_: 'abc-1', rate: 3, color: ['brown', 'black'], stock: 4, category: 'crosses',
    });
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ name: 'Olive wood cross', price: 12.5, stock: 4, category: 'crosses', rate: 3, color: ['brown', 'black'] });
    expect(fakes.Product.docs).toHaveLength(1);
    expect(audits('product.create')[0]).toMatchObject({ target: { type: 'product', id: res.body.item._id }, meta: { name: 'Olive wood cross' } });
  });

  it('stores a web address with its "&" intact (the HTML sanitizer writes it as &amp;)', async () => {
    const res = await post({ ...GOOD, img: 'https://firebasestorage.googleapis.com/v0/b/x/o/cross.jpg?alt=media&amp;token=abc' });
    expect(res.status).toBe(201);
    expect(fakes.Product.docs[0].img).toBe('https://firebasestorage.googleapis.com/v0/b/x/o/cross.jpg?alt=media&token=abc');
  });

  it.each([
    ['no name', { price: 5, img: GOOD.img }],
    ['no price', { name: 'Cross', img: GOOD.img }],
    ['no image', { name: 'Cross', price: 5 }],
    ['a one-letter name', { ...GOOD, name: 'X' }],
    ['a 201-letter name', { ...GOOD, name: 'x'.repeat(201) }],
    ['a name that is not text', { ...GOOD, name: ['Cross'] }],
    ['price 0', { ...GOOD, price: 0 }],
    ['a negative price', { ...GOOD, price: -3 }],
    ['price 10001', { ...GOOD, price: 10001 }],
    ['a price written as text', { ...GOOD, price: '5' }],
    ['a javascript: image', { ...GOOD, img: 'javascript:alert(1)' }],
    ['a relative image', { ...GOOD, img: '/a.jpg' }],
    ['21 extra images', { ...GOOD, additionalImageUrls: Array.from({ length: 21 }, () => 'https://example.com/a.jpg') }],
    ['an extra image that is not a URL', { ...GOOD, additionalImageUrls: ['nope'] }],
    ['a 2001-character description', { ...GOOD, description: 'd'.repeat(2001) }],
    ['negative stock', { ...GOOD, stock: -1 }],
    ['fractional stock', { ...GOOD, stock: 1.5 }],
    ['rate 6', { ...GOOD, rate: 6 }],
    ['rate -1', { ...GOOD, rate: -1 }],
    ['an unknown category', { ...GOOD, category: 'weapons' }],
    ['too many colours', { ...GOOD, color: Array.from({ length: 21 }, (_, i) => `c${i}`) }],
    ['an _id', { ...GOOD, _id: '64b000000000000000000001' }],
    ['createdAt', { ...GOOD, createdAt: '2020-01-01' }],
    ['an unknown field', { ...GOOD, isAdmin: true }],
    ['an operator in a field', { ...GOOD, stock: { $gt: 0 } }],
  ])('refuses %s', async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(fakes.Product.docs).toHaveLength(0);
    expect(audits('product.create')).toHaveLength(0);
  });

  it('accepts stock: null (not tracked) and category: null (inferred)', async () => {
    const res = await post({ ...GOOD, stock: null, category: null });
    expect(res.status).toBe(201);
    expect(fakes.Product.docs[0]).toMatchObject({ stock: null, category: null });
  });

  it('updates with PATCH and with PUT (partial), audits the fields, and refuses an empty update', async () => {
    const [p] = fakes.Product.seed([{ ...GOOD, stock: 10, rate: 1 }]);
    const patch = await call('patch', `/admin/products/${p._id}`, editor, { price: 15, stock: 2 });
    expect(patch.status).toBe(200);
    expect(patch.body.item).toMatchObject({ price: 15, stock: 2, name: 'Olive wood cross' });
    const put = await call('put', `/admin/products/${p._id}`, editor, { rate: 5, category: 'gifts' });
    expect(put.body.item).toMatchObject({ rate: 5, category: 'gifts', price: 15 });
    expect(audits('product.update')[0].meta.fields).toEqual(['price', 'stock']);
    expect((await call('patch', `/admin/products/${p._id}`, editor, {})).status).toBe(400);
    expect((await call('patch', `/admin/products/${p._id}`, editor, { price: 0 })).status).toBe(400);
    expect((await call('patch', `/admin/products/${oid()}`, editor, { price: 5 })).status).toBe(404);
    expect(fakes.Product.byId(p._id).price).toBe(15);
  });

  it('uses $set with the validated fields only', async () => {
    const [p] = fakes.Product.seed([GOOD]);
    await call('patch', `/admin/products/${p._id}`, editor, { price: 20 });
    const update = fakes.Product.calls.find((c) => c.op === 'update');
    expect(update.update).toEqual({ $set: { price: 20 } });
    expect(update.options).toMatchObject({ new: true, runValidators: true });
  });

  it('deletes and audits with the name', async () => {
    const [p] = fakes.Product.seed([GOOD]);
    expect((await call('delete', `/admin/products/${p._id}`, viewer)).status).toBe(403);
    expect((await call('delete', `/admin/products/${p._id}`, editor)).status).toBe(200);
    expect(audits('product.delete')[0].meta.name).toBe('Olive wood cross');
    expect((await call('delete', `/admin/products/${p._id}`, editor)).status).toBe(404);
  });

  it('refreshes the storefront catalogue after every change', async () => {
    const [p] = fakes.Product.seed([{ ...GOOD, rate: 1 }]);
    expect((await getCatalog()).find((x) => x._id === p._id).price).toBe(12.5); // now cached
    await call('patch', `/admin/products/${p._id}`, editor, { price: 99 });
    expect((await getCatalog()).find((x) => x._id === p._id).price).toBe(99);
    await call('patch', `/admin/products/${p._id}`, editor, { category: 'rosaries' });
    expect((await getCatalog()).find((x) => x._id === p._id).category).toBe('rosaries'); // the override wins over the name
    await call('delete', `/admin/products/${p._id}`, editor);
    expect((await getCatalog()).find((x) => x._id === p._id)).toBeUndefined();
    const created = await post(GOOD);
    expect((await getCatalog()).find((x) => x._id === created.body.item._id)).toBeTruthy();
  });

  it('lists with search, sort and the stock filters', async () => {
    fakes.Product.seed([{ ...GOOD, name: 'Cross', stock: 0 }, { ...GOOD, name: 'Rosary', stock: 3 }, { ...GOOD, name: 'Bible', stock: 50 }, { ...GOOD, name: 'Candle', stock: null }]);
    expect((await call('get', '/admin/products?q=rosa')).body.items.map((p) => p.name)).toEqual(['Rosary']);
    expect((await call('get', '/admin/products?q=ros')).body.items.map((p) => p.name).sort()).toEqual(['Cross', 'Rosary']); // "contains"
    expect((await call('get', '/admin/products?status=low')).body.items.map((p) => p.name).sort()).toEqual(['Cross', 'Rosary']);
    expect((await call('get', '/admin/products?status=out')).body.items.map((p) => p.name)).toEqual(['Cross']);
    // ok = not tracked, or more than 5 left (the dashboard's "In stock" filter)
    expect((await call('get', '/admin/products?status=ok')).body.items.map((p) => p.name).sort()).toEqual(['Bible', 'Candle']);
    expect((await call('get', '/admin/products?sort=name')).body.items.map((p) => p.name)).toEqual(['Bible', 'Candle', 'Cross', 'Rosary']);
  });
});

describe('GET /admin/export/:resource.csv', () => {
  const get = (name, who = editor) => http.get(`/admin/export/${name}`).set('X-Forwarded-For', freshIp()).set(who.auth);

  it('exports orders as CSV with the right headers and a byte-order mark', async () => {
    fakes.Order.seed([order({ firstName: 'Anna', lastName: 'Cohen', totalPrice: 40.5, products: [{ productName: 'Olive cross', quantity: 2, color: 'brown' }] })]);
    const res = await get('orders.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="orders-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    const lines = res.text.split('\r\n');
    expect(lines[0]).toBe('﻿id,number,createdAt,firstName,lastName,email,phone,street,city,state,postal,country,totalPrice,done,paymentVerified,paypalOrderId,products');
    expect(lines[1]).toContain('Anna,Cohen,anna@example.com');
    expect(lines[1]).toContain(',40.5,false,true,,Olive cross x2 (brown)');
    expect(audits('export.orders')[0]).toMatchObject({ actorName: 'the-editor', meta: { rows: 1 } });
  });

  it('neutralises formula injection in every text cell', async () => {
    const evil = ['=HYPERLINK("http://evil.example","click")', '+1+1', '-2+3', '@SUM(1,1)', '\t=1', '\r=1'];
    fakes.Order.seed(evil.map((value, i) => order({ firstName: value, lastName: `L${i}`, phone: value, city: value })));
    fakes.Contact.seed(evil.map((value) => ({ fullName: value, email: 'a@b.co', phone: value, msg: value, done: false })));
    fakes.Candle.seed(evil.map((value) => ({ firstName: value, lastName: 'x', email: 'a@b.co', prayer: value, done: false })));
    for (const name of ['orders.csv', 'contacts.csv', 'candles.csv']) {
      const body = (await get(name)).text.replace(/^﻿/, '');
      // Every cell of the file: split by the CSV rules, none may start with a formula character.
      const cells = [];
      let cell = '';
      let quoted = false;
      for (let i = 0; i < body.length; i += 1) {
        const ch = body[i];
        if (quoted) {
          if (ch === '"' && body[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',' || ch === '\n') { cells.push(cell.replace(/\r$/, '')); cell = ''; } else cell += ch;
      }
      const dangerous = cells.filter((c) => /^[=+\-@\t\r]/.test(c) && !/^-?\d+(\.\d+)?$/.test(c));
      expect(dangerous, name).toEqual([]);
      expect(cells.some((c) => c === "'=1+1" || c.startsWith("'="))).toBe(true);
    }
  });

  it('exports candles and contacts and records each export', async () => {
    fakes.Candle.seed([{ firstName: 'A', lastName: 'B', email: 'a@b.co', prayer: 'For "peace", please', done: false }]);
    fakes.Contact.seed([{ fullName: 'שלום עולם', email: 'a@b.co', phone: '1', msg: 'Tom &amp; Jerry', done: true }]);
    const candles = await get('candles.csv');
    expect(candles.text).toContain('"For ""peace"", please"');
    const contacts = await get('contacts.csv');
    expect(contacts.text).toContain('שלום עולם');
    expect(contacts.text).toContain('Tom & Jerry');
    expect(audits().map((e) => e.action)).toEqual(['export.candles', 'export.contacts']);
  });

  it('refuses other resources and other names, and viewers', async () => {
    for (const name of ['users.csv', 'orders', 'orders.json', 'audit.csv', '..%2Fapp.js', 'orders.csv%00']) {
      expect([404, 400], name).toContain((await get(name)).status);
    }
    expect((await get('orders.csv', viewer)).status).toBe(403);
    expect((await get('orders.csv', owner)).status).toBe(200);
  });

  it('caps the export at 10 000 rows', async () => {
    await get('orders.csv');
    expect(fakes.Order.calls.find((c) => c.op === 'find').limit).toBe(10_000);
  });
});

describe('GET /admin/dashboard', () => {
  const now = Date.now();
  const dayOf = (offset) => new Date(now - offset * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

  const stubAggregates = () => {
    fakes.Order.aggregateImpl = (pipeline) => {
      const first = pipeline[0];
      if (first.$group?._id === null) return [{ _id: null, orders: 12, ordersPending: 5, revenue: 1234.567, revenueUnverified: 99.994, ordersUnverified: 2 }];
      if (first.$match?.createdAt) return [{ _id: dayOf(0), orders: 3, revenue: 120.5 }, { _id: dayOf(2), orders: 1, revenue: 10 }, { _id: '1999-01-01', orders: 99, revenue: 99 }];
      if (first.$unwind) return [
        { productId: 'p1'.padEnd(24, '0'), name: 'Olive cross', sold: 9, revenue: 90.126 },
        { productId: 'p2'.padEnd(24, '0'), name: 'Rosary', sold: 4, revenue: 40 },
      ];
      return [];
    };
    fakes.Candle.aggregateImpl = () => [{ _id: dayOf(1), candles: 7 }];
  };

  it('answers the documented shape from aggregations and counts', async () => {
    stubAggregates();
    fakes.Candle.seed([{ done: false }, { done: true }, { done: false }]);
    fakes.Contact.seed([{ done: false }, { done: true }]);
    fakes.Product.seed([{ name: 'Cross', stock: 0 }, { name: 'Rosary', stock: 3 }, { name: 'Bible', stock: 50 }, { name: 'Free', stock: null }]);
    fakes.Prayer.seed([{ name: 'a' }, { name: 'b' }]);
    fakes.Review.seed([{ fullName: 'a' }]);
    fakes.ProductReview.seed([{ name: 'a' }, { name: 'b' }, { name: 'c' }]);
    fakes.Order.seed(Array.from({ length: 6 }, (_, i) => order({ lastName: `R${i}`, createdAt: days(6 - i) })));

    const res = await call('get', '/admin/dashboard', viewer);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(Object.keys(res.body).sort()).toEqual(['alerts', 'generatedAt', 'last30Days', 'lowStock', 'recent', 'topProducts', 'totals']);
    expect(res.body.totals).toEqual({
      orders: 12, ordersPending: 5, revenue: 1234.57, revenueUnverified: 99.99, ordersUnverified: 2, candles: 3, candlesPending: 2, contacts: 2, contactsOpen: 1,
      products: 4, productReviews: 3, prayers: 2, reviews: 1,
    });

    expect(res.body.last30Days).toHaveLength(30);
    const byDate = Object.fromEntries(res.body.last30Days.map((d) => [d.date, d]));
    expect(res.body.last30Days.at(-1).date).toBe(dayOf(0));
    expect(byDate[dayOf(0)]).toEqual({ date: dayOf(0), orders: 3, revenue: 120.5, candles: 0 });
    expect(byDate[dayOf(1)]).toEqual({ date: dayOf(1), orders: 0, revenue: 0, candles: 7 });
    expect(byDate[dayOf(2)]).toEqual({ date: dayOf(2), orders: 1, revenue: 10, candles: 0 });
    expect(byDate['1999-01-01']).toBeUndefined();
    expect(res.body.last30Days.filter((d) => d.orders === 0 && d.candles === 0 && d.revenue === 0)).toHaveLength(27);

    expect(res.body.topProducts).toEqual([
      { productId: 'p1'.padEnd(24, '0'), name: 'Olive cross', sold: 9, revenue: 90.13 },
      { productId: 'p2'.padEnd(24, '0'), name: 'Rosary', sold: 4, revenue: 40 },
    ]);
    expect(res.body.lowStock.map((p) => [p.name, p.stock])).toEqual([['Cross', 0], ['Rosary', 3]]);
    expect(Object.keys(res.body.lowStock[0]).sort()).toEqual(['name', 'productId', 'stock']);
    expect(res.body.recent.orders).toHaveLength(5);
    expect(res.body.recent.orders[0].lastName).toBe('R5'); // newest first
    expect(res.body.recent.candles).toHaveLength(3);
    expect(res.body.recent.contacts).toHaveLength(2);
    // The dashboard UI renders these as the same documents its lists use: a candle needs its prayer and e-mail, a
    // message needs its text (found by running the UI against this API: its zod schemas rejected the short rows).
    const selected = (Model) => String(Model.calls.find((c) => c.op === 'find' && c.select)?.select ?? '').split(/\s+/);
    expect(selected(fakes.Candle)).toEqual(expect.arrayContaining(['firstName', 'lastName', 'email', 'prayer', 'done', 'createdAt']));
    expect(selected(fakes.Contact)).toEqual(expect.arrayContaining(['fullName', 'email', 'msg', 'done', 'createdAt']));
  });

  it('is correct on an empty shop (zeros, 30 empty days, no products)', async () => {
    const res = await call('get', '/admin/dashboard');
    expect(res.body.totals).toEqual({ orders: 0, ordersPending: 0, revenue: 0, revenueUnverified: 0, ordersUnverified: 0, candles: 0, candlesPending: 0, contacts: 0, contactsOpen: 0, products: 0, productReviews: 0, prayers: 0, reviews: 0 });
    expect(res.body.last30Days).toHaveLength(30);
    expect(res.body.topProducts).toEqual([]);
    expect(res.body.lowStock).toEqual([]);
    expect(res.body.recent).toEqual({ orders: [], candles: [], contacts: [] });
  });

  it('asks the database to group and count: it never loads the collections', async () => {
    await call('get', '/admin/dashboard');
    const orderOps = fakes.Order.calls.map((c) => c.op);
    expect(orderOps.filter((o) => o === 'aggregate')).toHaveLength(3);
    expect(fakes.Order.calls.filter((c) => c.op === 'find').every((c) => c.limit === 5)).toBe(true);
    const find = fakes.Product.calls.find((c) => c.op === 'find');
    expect(find.limit).toBeLessThanOrEqual(20);
  });

  it('is cached for 30 seconds: a second request and a burst reuse one computation', async () => {
    await call('get', '/admin/dashboard');
    const after = fakes.Order.calls.length;
    await Promise.all([call('get', '/admin/dashboard'), call('get', '/admin/dashboard'), call('get', '/admin/dashboard', viewer)]);
    expect(fakes.Order.calls.length).toBe(after);
    expect(CACHE_MS).toBe(30_000);
    await getDashboard(Date.now() + 31_000); // the cache has expired
    expect(fakes.Order.calls.length).toBeGreaterThan(after);
  });

  it('shares one computation between simultaneous first requests', async () => {
    resetDashboardCache();
    fakes.Order.calls.length = 0;
    await Promise.all([getDashboard(), getDashboard(), getDashboard()]);
    expect(fakes.Order.calls.filter((c) => c.op === 'aggregate')).toHaveLength(3); // once, not three times three
  });

  it('builds the same data directly', async () => {
    const data = await buildDashboard(new Date('2026-10-06T10:00:00Z'));
    expect(data.generatedAt).toBe('2026-10-06T10:00:00.000Z');
    expect(data.last30Days.at(-1).date).toBe('2026-10-06');
  });
});

describe('every change is in the audit log (and no password ever is)', () => {
  it('records actor, role, action and target for a sequence of changes', async () => {
    const [o] = fakes.Order.seed([order()]);
    const [c] = fakes.Candle.seed([{ firstName: 'A', lastName: 'B', email: 'a@b.co', prayer: 'Please', done: false }]);
    await call('patch', `/admin/orders/${o._id}`, editor, { done: true });
    await call('patch', `/admin/candles/${c._id}`, editor, { done: true });
    await call('delete', `/admin/candles/${c._id}`, editor);
    await call('delete', `/admin/orders/${o._id}`, owner);
    expect(audits().map((e) => [e.actorName, e.role, e.action, e.target.type])).toEqual([
      ['the-editor', 'editor', 'order.update', 'order'],
      ['the-editor', 'editor', 'candle.update', 'candle'],
      ['the-editor', 'editor', 'candle.delete', 'candle'],
      ['the-owner', 'owner', 'order.delete', 'order'],
    ]);
    expect(audits().every((e) => e.ipHash && e.ua && e.at instanceof Date)).toBe(true);
  });

  it('refused and failed requests leave no entry', async () => {
    await call('patch', `/admin/orders/${oid()}`, editor, { done: 'x' });
    await call('patch', `/admin/orders/${oid()}`, editor, { done: true }); // 404
    await call('delete', `/admin/orders/${oid()}`, editor); // 403
    expect(audits()).toHaveLength(0);
  });
});

describe('the legacy admin access is gone (security review 06, finding 1)', () => {
  // What the removed sign-ins used to issue: an 8-hour token with no session. One issued before the change opens nothing.
  const legacyTokens = () => [
    jwt.sign({ role: 'admin', auth: 'shared-password' }, process.env.JWT_SECRET, { expiresIn: '8h' }),
    jwt.sign({ role: 'admin', id: oid(), username: 'legacy-user', auth: 'account' }, process.env.JWT_SECRET, { expiresIn: '8h' }),
  ].map((token) => ({ auth: { Authorization: `Bearer ${token}` } }));

  it('the legacy lists and deletes that shared an address with the dashboard refuse a legacy token, and change nothing', async () => {
    const [c] = fakes.Candle.seed([{ firstName: 'A', lastName: 'B', email: 'a@b.co', prayer: 'Please', done: false }]);
    const [p] = fakes.Product.seed([{ name: 'Cross', price: 5, img: 'https://example.com/a.jpg' }]);
    const [pr] = fakes.Prayer.seed([{ name: 'Maria', country: 'BR', prayer: 'x' }]);
    for (const legacy of legacyTokens()) {
      for (const path of ['candles', 'products', 'prayers', 'product-reviews', 'stats']) {
        expect((await call('get', `/admin/${path}`, legacy)).status, path).toBe(path === 'stats' ? 404 : 401);
      }
      expect((await call('delete', `/admin/candles/${c._id}`, legacy)).status).toBe(401);
      expect((await call('delete', `/admin/products/${p._id}`, legacy)).status).toBe(401);
      expect((await call('delete', `/admin/prayers/${pr._id}`, legacy)).status).toBe(401);
      expect((await call('post', '/admin/products', legacy, { name: 'Injected', price: 1, img: 'https://example.com/x.jpg' })).status).toBe(401);
    }
    expect(fakes.Candle.docs).toHaveLength(1);
    expect(fakes.Product.docs.map((d) => d.name)).toEqual(['Cross']);
    expect(fakes.Prayer.docs).toHaveLength(1);
    expect(audits()).toHaveLength(0);
  });

  it('the old order, candle, contact, product, prayer and review routes no longer exist', async () => {
    fakes.Order.seed([order()]);
    const [legacy] = legacyTokens();
    for (const [method, path] of [
      ['get', '/order/getAllOrders'], ['get', `/order/getOrder/${oid()}`], ['patch', `/order/orderSent/${oid()}`], ['delete', `/order/deleteOrder/${oid()}`],
      ['get', '/candle/getAllCandleRequests'], ['get', '/contact/get_all_contact_us'], ['delete', `/prayer/${oid()}`], ['delete', `/review/${oid()}`],
      ['post', '/product/addProduct'], ['delete', `/product/deleteProduct/${oid()}`],
    ]) {
      expect((await call(method, path, legacy)).status, path).toBe(404);
      expect((await call(method, path, owner)).status, `${path} (dashboard token)`).toBe(404);
    }
    expect(fakes.Order.docs).toHaveLength(1);
  });

  it('neither POST /auth/login nor POST /admin/login signs anyone in any more', async () => {
    const { quickHash } = await import('./helpers/fakes.js');
    fakes.Admin.seed([{ username: 'legacy-user', password: quickHash('legacy-password-1') }], { raw: true });
    for (const [path, body] of [['/admin/login', { username: 'legacy-user', password: 'legacy-password-1' }], ['/auth/login', { password: 'legacy-password-1' }]]) {
      const res = await http.post(path).set('X-Forwarded-For', freshIp()).send(body);
      expect(res.status, path).toBe(404);
      expect(res.body.token).toBeUndefined();
    }
  });
});

describe('query filters survive Mongoose sanitizeFilter (which the server runs with)', () => {
  it('knows what it is looking for: an untrusted operator value is rewritten', () => {
    expect(sanitizeChanges({ role: { $exists: false } })).not.toBeNull();
  });

  it('every filter sent by the list, detail, change and dashboard routes comes out unchanged', async () => {
    fakes.Order.seed([order()]);
    fakes.Product.seed([{ name: 'Cross', price: 5, img: 'https://example.com/a.jpg', stock: 1 }]);
    const [c] = fakes.Candle.seed([{ firstName: 'A', lastName: 'B', email: 'a@b.co', prayer: 'Please', done: false }]);
    const [o] = fakes.Order.docs;
    const requests = [
      ['get', '/admin/orders?q=anna&status=pending&sort=-totalPrice&page=2&size=5'],
      ['get', '/admin/orders?status=unverified'], ['get', '/admin/orders?status=shipped'],
      ['get', `/admin/orders?q=${o._id}`], ['get', `/admin/orders/${o._id}`],
      ['patch', `/admin/orders/${o._id}`, { done: true }], ['patch', `/admin/orders/${o._id}`, { done: false }],
      ['get', '/admin/candles?status=pending&q=b'], ['patch', `/admin/candles/${c._id}`, { done: true }],
      ['get', '/admin/contacts?status=open'], ['get', '/admin/site-reviews?status=hidden'],
      ['get', '/admin/product-reviews?status=approved&q=x'], ['get', '/admin/prayers?status=Peace&q=x'],
      ['get', '/admin/products?status=low'], ['get', '/admin/products?status=ok'], ['get', '/admin/products?status=out&q=cross'],
      ['get', `/admin/candles/${c._id}`], ['get', '/admin/users?status=active'],
      ['get', '/admin/dashboard'],
    ];
    for (const [method, path, body] of requests) expect((await call(method, path, owner, body)).status, `${method} ${path}`).toBeLessThan(500);
    resetDashboardCache();
    await call('get', '/admin/dashboard');
    const filters = allFilters();
    expect(filters.length).toBeGreaterThan(20);
    for (const { name, op, filter } of filters) {
      expect(sanitizeChanges(filter), `${name}.${op} ${JSON.stringify(filter)}`).toBeNull();
    }
    // ...and the real schemas can cast them (the fields exist, the values fit)
    for (const { name, op, filter } of filters) {
      expect(await castProblem(name, filter), `${name}.${op} ${JSON.stringify(filter)}`).toBeNull();
    }
  });
});