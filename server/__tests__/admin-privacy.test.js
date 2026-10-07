import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// Data-protection requests: find out what is stored about an e-mail address, and erase it. Owner only, audited, and the
// audit log never keeps the address.

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

const { fakes, oid } = await import('./helpers/fakes.js');
const { allFilters, castProblem, freshIp, sanitizeChanges, signedIn, startClient } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { signSessionToken } = await import('../services/adminSessions.js');
const { ERASED_EMAIL, NOT_ERASED } = await import('../route/admin/privacy.js');
const { getCatalog } = await import('../services/catalog.js');

const { http, close } = startClient(createApp());
afterAll(close);

let owner;
let editor;
beforeAll(async () => {
  editor = await signedIn(signSessionToken, { username: 'the-editor', role: 'editor' });
});
// A new owner for every test: privacy requests have their own small per-admin limit (20 per 15 minutes).
beforeEach(async () => {
  owner = await signedIn(signSessionToken, { username: 'the-owner', role: 'owner' });
});

const call = (method, path, who = owner, body) => {
  const req = http[method](path).set('X-Forwarded-For', freshIp()).set(who.auth);
  return body === undefined ? req : req.send(body);
};
const audits = (action) => fakes.AuditLog.docs.filter((d) => !action || d.action === action);

const ME = 'maria.rossi@example.com';
const SOMEONE_ELSE = 'other@example.com';

let myOrderId;
let otherOrderId;
beforeEach(() => {
  for (const name of ['Payment', 'Order', 'Candle', 'Contact', 'Review', 'AuditLog', 'Prayer', 'ProductReview', 'Product']) fakes[name].reset();
  const [mine, other] = fakes.Order.seed([
    { firstName: 'Maria', lastName: 'Rossi', email: ME, phone: '+39 06 1234', street: 'Via Roma 1', city: 'Rome', state: 'RM', postal: '00100', country: 'Italy', totalPrice: 40, paypalOrderId: 'MARIA000000000001', paymentVerified: true, products: [{ productID: oid(), productName: 'Olive cross', quantity: 2 }] },
    { firstName: 'Other', lastName: 'Person', email: SOMEONE_ELSE, phone: '1', street: 'x', city: 'y', state: 'z', postal: '1', country: 'IL', totalPrice: 10, products: [] },
  ]);
  myOrderId = mine._id;
  otherOrderId = other._id;
  fakes.Order.seed([{ firstName: 'Maria', lastName: 'Rossi', email: ME, phone: '1', street: 's', city: 'c', state: 'x', postal: '1', country: 'IT', totalPrice: 5, products: [] }]);
  fakes.Candle.seed([
    { firstName: 'Maria', lastName: 'Rossi', email: ME, prayer: 'For my family in Rome', done: true, paypalOrderId: 'MARIA000000000002' },
    { firstName: 'Other', lastName: 'Person', email: SOMEONE_ELSE, prayer: 'Peace', done: false },
  ]);
  fakes.Contact.seed([
    { fullName: 'Maria Rossi', email: 'Maria.Rossi@Example.com', phone: '1', msg: 'Where is my order?' }, // stored as typed
    { fullName: 'Other', email: SOMEONE_ELSE, phone: '1', msg: 'Hello' },
  ]);
  fakes.Review.seed([{ fullName: 'Maria Rossi', email: ME, msg: 'Lovely' }, { fullName: 'Other', email: '', msg: 'Nice' }]);
  fakes.Payment.seed([
    { paypalOrderId: 'MARIA000000000001', type: 'order', amount: 40, status: 'captured', payerEmail: 'maria.rossi@paypal.example', payerName: 'Maria Rossi', linkedTo: { kind: 'order', id: myOrderId } },
    { paypalOrderId: 'MARIA000000000002', type: 'candle', amount: 3, status: 'captured', payerEmail: ME, payerName: 'Maria R' },
    { paypalOrderId: 'MARIA000000000003', type: 'donation', amount: 25, status: 'captured', payerEmail: ME, payerName: 'Maria R', donorName: 'Maria' },
    { paypalOrderId: 'OTHER000000000001', type: 'order', amount: 10, status: 'captured', payerEmail: SOMEONE_ELSE, payerName: 'Other Person', linkedTo: { kind: 'order', id: otherOrderId } },
  ]);
});

describe('POST /admin/privacy/lookup', () => {
  it('counts what is stored about an address, in every collection, without returning any of it', async () => {
    const res = await call('post', '/admin/privacy/lookup', owner, { email: '  Maria.Rossi@Example.COM ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      found: { orders: 2, candles: 1, contacts: 1, reviews: 1, payments: 2, prayers: 0, productReviews: 0 },
      notSearched: ['prayersNotSearched', 'productReviewsNotSearched'], // no name was given
    });
    expect(JSON.stringify(res.body)).not.toMatch(/Rome|Via Roma|Olive/);
  });

  it('says zero for an address nobody used', async () => {
    const res = await call('post', '/admin/privacy/lookup', owner, { email: 'nobody@example.com' });
    expect(res.body.found).toEqual({ orders: 0, candles: 0, contacts: 0, reviews: 0, payments: 0, prayers: 0, productReviews: 0 });
  });

  it('is owner only, and refuses bad input', async () => {
    expect((await call('post', '/admin/privacy/lookup', editor, { email: ME })).status).toBe(403);
    expect((await call('post', '/admin/privacy/lookup', owner, { email: 'not-an-address' })).status).toBe(400);
    expect((await call('post', '/admin/privacy/lookup', owner, { email: { $ne: '' } })).status).toBe(400);
    expect((await call('post', '/admin/privacy/lookup', owner, { email: ME, extra: 1 })).status).toBe(400);
    expect((await call('post', '/admin/privacy/lookup', owner, { email: ERASED_EMAIL })).status).toBe(400);
    expect((await call('get', '/admin/privacy/lookup', owner)).status).toBe(404);
  });

  it('is audited, without the address', async () => {
    await call('post', '/admin/privacy/lookup', owner, { email: ME });
    expect(audits('privacy.lookup')).toHaveLength(1);
    expect(audits('privacy.lookup')[0]).toMatchObject({ actorName: 'the-owner', meta: { orders: 2, candles: 1 } });
    expect(JSON.stringify(fakes.AuditLog.docs)).not.toContain('maria');
  });
});

describe('POST /admin/privacy/erase', () => {
  const erase = (body = { email: ME, confirm: ME }, who = owner) => call('post', '/admin/privacy/erase', who, body);

  it('anonymises the orders (the sale stays in the accounts) and candle requests, deletes messages and site reviews', async () => {
    const res = await erase();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      erased: { orders: 2, candles: 1, contacts: 1, reviews: 1, payments: 3, prayers: 0, productReviews: 0 },
      notErased: ['prayersNotSearched', 'productReviewsNotSearched', ...NOT_ERASED],
    });

    const order = fakes.Order.byId(myOrderId);
    expect(order).toMatchObject({
      firstName: 'Erased', lastName: 'Erased', email: ERASED_EMAIL, phone: 'Erased', street: 'Erased', city: 'Erased', state: 'Erased', postal: 'Erased', country: 'Erased',
      totalPrice: 40, paypalOrderId: 'MARIA000000000001', paymentVerified: true,
    });
    expect(order.products[0].productName).toBe('Olive cross'); // what was sold stays
    expect(order.erasedAt).toBeInstanceOf(Date);
    expect(fakes.Candle.docs.find((c) => c.paypalOrderId === 'MARIA000000000002')).toMatchObject({ firstName: 'Erased', email: ERASED_EMAIL, prayer: 'Erased', done: true });
    expect(fakes.Contact.docs.map((c) => c.fullName)).toEqual(['Other']);
    expect(fakes.Review.docs.map((r) => r.fullName)).toEqual(['Other']);
  });

  it('removes the payer details from the payments (also those found through the order) and keeps the money', async () => {
    await erase();
    const mine = fakes.Payment.docs.filter((p) => p.paypalOrderId.startsWith('MARIA'));
    expect(mine).toHaveLength(3);
    for (const p of mine) {
      expect(p.payerEmail).toBeUndefined();
      expect(p.payerName).toBeUndefined();
      expect(p.donorName).toBeUndefined();
    }
    expect(mine.map((p) => p.amount).sort((a, b) => a - b)).toEqual([3, 25, 40]);
    expect(mine.find((p) => p.paypalOrderId === 'MARIA000000000001').linkedTo.id).toBe(myOrderId);
  });

  it('touches nobody else', async () => {
    await erase();
    expect(fakes.Order.byId(otherOrderId)).toMatchObject({ firstName: 'Other', email: SOMEONE_ELSE, street: 'x' });
    expect(fakes.Candle.docs.find((c) => c.email === SOMEONE_ELSE).prayer).toBe('Peace');
    expect(fakes.Payment.docs.find((p) => p.paypalOrderId === 'OTHER000000000001')).toMatchObject({ payerEmail: SOMEONE_ELSE, payerName: 'Other Person' });
  });

  it('finds the person again nowhere afterwards, and a second erase does nothing', async () => {
    await erase();
    const again = await erase();
    expect(again.body.erased).toEqual({ orders: 0, candles: 0, contacts: 0, reviews: 0, payments: 0, prayers: 0, productReviews: 0 });
    const lookup = await call('post', '/admin/privacy/lookup', owner, { email: ME });
    expect(lookup.body.found).toEqual({ orders: 0, candles: 0, contacts: 0, reviews: 0, payments: 0, prayers: 0, productReviews: 0 });
  });

  it('needs the address typed twice, the same way', async () => {
    expect((await erase({ email: ME, confirm: SOMEONE_ELSE })).status).toBe(400);
    expect((await erase({ email: ME })).status).toBe(400);
    expect((await erase({ email: ME, confirm: ME.toUpperCase() })).status).toBe(200); // case does not matter
    expect(fakes.Order.docs.some((o) => o.email === ME)).toBe(false);
  });

  it('is refused for an editor and a viewer, and changes nothing', async () => {
    expect((await erase(undefined, editor)).status).toBe(403);
    expect(fakes.Order.byId(myOrderId).firstName).toBe('Maria');
    expect(audits('privacy.erase')).toHaveLength(0);
  });

  it('is audited with the counts and a keyed reference, never the address', async () => {
    await erase();
    const entry = audits('privacy.erase')[0];
    expect(entry).toMatchObject({ actorName: 'the-owner', role: 'owner', meta: { orders: 2, candles: 1, contacts: 1, reviews: 1, payments: 3 } });
    expect(entry.target.type).toBe('privacy');
    expect(entry.target.id).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(fakes.AuditLog.docs).toLowerCase()).not.toContain('maria');
    expect(JSON.stringify(fakes.AuditLog.docs)).not.toContain('example.com');
  });

  it('every query it sends survives sanitizeFilter and casts against the real schemas', async () => {
    await call('post', '/admin/privacy/lookup', owner, { email: ME });
    await erase();
    await call('post', '/admin/privacy/lookup', owner, { email: ME, name: 'Maria Rossi', country: 'Italy' });
    await erase({ email: ME, confirm: ME, name: 'Maria Rossi', country: 'Italy' });
    const filters = allFilters().filter((f) => ['Order', 'Candle', 'Contact', 'Review', 'Payment', 'Prayer', 'ProductReview'].includes(f.name));
    expect(filters.length).toBeGreaterThan(8);
    expect(filters.some((f) => f.name === 'Prayer')).toBe(true);
    expect(filters.some((f) => f.name === 'ProductReview')).toBe(true);
    for (const { name, op, filter } of filters) {
      expect(sanitizeChanges(filter), `${name}.${op} ${JSON.stringify(filter)}`).toBeNull();
      expect(await castProblem(name, filter), `${name}.${op} ${JSON.stringify(filter)}`).toBeNull();
    }
  });

  it('treats the address as text: regular-expression characters match themselves', async () => {
    fakes.Contact.seed([{ fullName: 'Dot', email: 'a.b@example.com', phone: '1', msg: 'x' }, { fullName: 'Not dot', email: 'aXb@example.com', phone: '1', msg: 'y' }]);
    const res = await erase({ email: 'a.b@example.com', confirm: 'a.b@example.com' });
    expect(res.body.erased.contacts).toBe(1);
    expect(fakes.Contact.docs.map((c) => c.fullName)).toContain('Not dot');
  });
});

// Security review 06, finding 7: prayers and product reviews keep no e-mail address, so the erase used to leave them
// public. They are found by the name (and country) they were published under, only when it is EXACTLY equal.
describe('prayers and product reviews: by the published name, exact matches only', () => {
  let productId;
  beforeEach(() => {
    [{ _id: productId }] = fakes.Product.seed([{ name: 'Olive cross', price: 10, img: 'https://example.com/a.jpg' }]);
    fakes.Prayer.seed([
      { name: 'Maria Rossi', country: 'Italy', prayer: 'For my mother, who is ill', category: 'Health' },
      { name: 'maria rossi', country: 'ITALY', prayer: 'Thank you', category: 'Gratitude' }, // the same, other case
      { name: 'Maria Rossi', country: 'Brazil', prayer: 'Another Maria Rossi', category: 'Peace' }, // a stranger: other country
      { name: 'Maria', country: 'Italy', prayer: 'Only a first name', category: 'Peace' }, // similar, not equal
      { name: 'Maria Rossi-Bianchi', country: 'Italy', prayer: 'A longer name', category: 'Peace' },
      { name: 'Anna &amp; Maria Rossi', country: 'Italy', prayer: 'Stored escaped', category: 'Peace' },
    ]);
    fakes.ProductReview.seed([
      { product: productId, name: 'Maria Rossi', country: 'Italy', rating: 5, title: '', comment: 'Beautiful', approved: true },
      { product: productId, name: 'Maria Rossi', country: '', rating: 4, title: '', comment: 'No country given', approved: true },
      { product: productId, name: 'Maria Rossi', country: 'Brazil', rating: 3, title: '', comment: 'A stranger', approved: true },
      { product: productId, name: 'Mario Rossi', country: 'Italy', rating: 2, title: '', comment: 'Not her', approved: true },
    ]);
  });
  const erase = (body) => call('post', '/admin/privacy/erase', owner, body);
  const prayersLeft = () => fakes.Prayer.docs.map((p) => `${p.name}/${p.country}`).sort();
  const reviewsLeft = () => fakes.ProductReview.docs.map((r) => `${r.name}/${r.country}`).sort();

  it('lookup counts them only when identified: prayers need name AND country, product reviews a name', async () => {
    const byName = await call('post', '/admin/privacy/lookup', owner, { email: ME, name: 'Maria Rossi' });
    expect(byName.body.found).toMatchObject({ prayers: 0, productReviews: 3 });
    expect(byName.body.notSearched).toEqual(['prayersNotSearched']);
    const both = await call('post', '/admin/privacy/lookup', owner, { email: ME, name: ' maria ROSSI ', country: 'italy' });
    expect(both.body.found).toMatchObject({ prayers: 2, productReviews: 1 });
    expect(both.body.notSearched).toEqual([]);
    expect((await call('post', '/admin/privacy/lookup', owner, { email: ME, country: 'Italy' })).status).toBe(400); // a country alone
    for (const bad of [{ name: 'M' }, { name: { $ne: null } }, { name: ['Maria Rossi'] }, { name: 'x'.repeat(201) }, { name: 'Maria\nRossi' }]) {
      expect((await call('post', '/admin/privacy/lookup', owner, { email: ME, ...bad })).status, JSON.stringify(bad)).toBe(400);
    }
  });

  it('erase deletes exactly the equal ones, leaves similar names and strangers, and says what it did not search', async () => {
    const res = await erase({ email: ME, confirm: ME, name: 'Maria Rossi', country: 'Italy' });
    expect(res.status).toBe(200);
    expect(res.body.erased).toMatchObject({ prayers: 2, productReviews: 1, orders: 2 });
    expect(res.body.notErased).toEqual([...NOT_ERASED]);
    expect(prayersLeft()).toEqual(['Anna &amp; Maria Rossi/Italy', 'Maria Rossi-Bianchi/Italy', 'Maria Rossi/Brazil', 'Maria/Italy']);
    expect(reviewsLeft()).toEqual(['Maria Rossi/', 'Maria Rossi/Brazil', 'Mario Rossi/Italy']);
  });

  it('with a name only, product reviews of that name go (any country) and prayers are not touched', async () => {
    const res = await erase({ email: ME, confirm: ME, name: 'Maria Rossi' });
    expect(res.body.erased).toMatchObject({ prayers: 0, productReviews: 3 });
    expect(res.body.notErased).toEqual(['prayersNotSearched', ...NOT_ERASED]);
    expect(fakes.Prayer.docs).toHaveLength(6);
    expect(reviewsLeft()).toEqual(['Mario Rossi/Italy']);
  });

  it('a name with "&" matches what the API stored escaped, and regular-expression characters match themselves', async () => {
    const res = await erase({ email: ME, confirm: ME, name: 'Anna & Maria Rossi', country: 'Italy' });
    expect(res.body.erased.prayers).toBe(1);
    expect(prayersLeft()).not.toContain('Anna &amp; Maria Rossi/Italy');
    const dot = await erase({ email: ME, confirm: ME, name: 'Maria.Rossi', country: 'Italy' }); // "." is not "any character"
    expect(dot.body.erased.prayers).toBe(0);
    const star = await erase({ email: ME, confirm: ME, name: 'Maria.*', country: '.*' });
    expect(star.body.erased).toMatchObject({ prayers: 0, productReviews: 0 });
  });

  it('the storefront catalogue (product ratings) is rebuilt after a review is erased', async () => {
    expect((await getCatalog()).find((p) => p._id === String(productId)).price).toBe(10); // now cached
    fakes.Product.docs[0].price = 11; // a change the cache does not know about
    await erase({ email: ME, confirm: ME, name: 'Nobody Here' }); // nothing erased: the cache stays
    expect((await getCatalog()).find((p) => p._id === String(productId)).price).toBe(10);
    await erase({ email: ME, confirm: ME, name: 'Maria Rossi', country: 'Italy' }); // a review erased: rebuilt
    expect((await getCatalog()).find((p) => p._id === String(productId)).price).toBe(11);
  });

  it('the audit entry has the counts, never the name or the country', async () => {
    await erase({ email: ME, confirm: ME, name: 'Maria Rossi', country: 'Italy' });
    const entry = audits('privacy.erase')[0];
    expect(entry.meta).toMatchObject({ prayers: 2, productReviews: 1 });
    expect(JSON.stringify(fakes.AuditLog.docs).toLowerCase()).not.toMatch(/maria|rossi|italy/);
  });
});
