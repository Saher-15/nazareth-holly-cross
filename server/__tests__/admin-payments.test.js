import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// The Payments screen's API: list and filters ("paid but not fulfilled"), detail, resolve with a note, CSV export, the
// dashboard alert. Roles, audit entries, and that nothing can delete a payment.

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
const { resetDashboardCache } = await import('../services/dashboard.js');
const { PAYMENT_GRACE_MS } = await import('../model/payment.js');

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
  for (const name of ['Payment', 'Order', 'Candle', 'AuditLog']) fakes[name].reset();
  resetDashboardCache();
});

const call = (method, path, who = owner, body) => {
  const req = http[method](path).set('X-Forwarded-For', freshIp()).set(who.auth);
  return body === undefined ? req : req.send(body);
};
const audits = (action) => fakes.AuditLog.docs.filter((d) => !action || d.action === action);
const minutesAgo = (n) => new Date(Date.now() - n * 60_000);
const OLD = minutesAgo(PAYMENT_GRACE_MS / 60_000 + 5);

let n = 0;
const payment = (over = {}) => ({
  paypalOrderId: `PAYMENT${String(++n).padStart(10, '0')}`, type: 'order', amount: 23, currency: 'USD', status: 'captured',
  capturedAt: OLD, createdAt: OLD, resolvedAt: null, payerEmail: 'buyer@example.com', payerName: 'Ben Buyer', ...over,
});

describe('GET /admin/payments', () => {
  it('lists newest first with the documented page shape', async () => {
    fakes.Payment.seed([payment({ createdAt: minutesAgo(300) }), payment({ createdAt: minutesAgo(100), amount: 3, type: 'candle' }), payment({ createdAt: minutesAgo(200) })]);
    const res = await call('get', '/admin/payments', viewer);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 3, page: 1, size: 25 });
    expect(res.body.items.map((p) => p.amount)).toEqual([3, 23, 23]);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('"unfulfilled" is: captured, for an order / candle / old client, nothing linked, not resolved, past the grace period', async () => {
    fakes.Payment.seed([
      payment({ paypalOrderId: 'UNFULFILLED0000001' }),
      payment({ paypalOrderId: 'UNFULFILLED0000002', type: 'candle', amount: 3 }),
      payment({ paypalOrderId: 'UNFULFILLED0000003', type: 'unknown' }),
      payment({ paypalOrderId: 'JUSTPAID000000001', capturedAt: minutesAgo(1) }),
      payment({ paypalOrderId: 'DONATION00000001', type: 'donation' }),
      payment({ paypalOrderId: 'LINKED0000000001', linkedTo: { kind: 'order', id: oid() } }),
      payment({ paypalOrderId: 'RESOLVED000000001', resolvedAt: new Date(), resolvedBy: 'someone', notes: 'refunded' }),
      payment({ paypalOrderId: 'CREATED0000000001', status: 'created', capturedAt: null }),
      payment({ paypalOrderId: 'FAILED00000000001', status: 'failed', capturedAt: null }),
    ]);
    const res = await call('get', '/admin/payments?status=unfulfilled');
    expect(res.status).toBe(200);
    expect(res.body.items.map((p) => p.paypalOrderId).sort()).toEqual(['UNFULFILLED0000001', 'UNFULFILLED0000002', 'UNFULFILLED0000003']);
    expect(res.body.total).toBe(3);
  });

  it.each([
    ['captured', 5], ['created', 1], ['failed', 1], ['resolved', 1], ['order', 5], ['candle', 1], ['donation', 1],
  ])('status=%s', async (status, expected) => {
    fakes.Payment.seed([
      payment(), payment(), payment({ resolvedAt: new Date(), notes: 'x' }), payment({ type: 'donation' }),
      payment({ status: 'created', capturedAt: null, type: 'order' }), payment({ status: 'failed', capturedAt: null, type: 'order' }),
      payment({ type: 'candle' }),
    ]);
    const res = await call('get', `/admin/payments?status=${status}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(expected);
  });

  it('searches the PayPal id, the payer and the donor, and refuses an unknown status or sort', async () => {
    fakes.Payment.seed([payment({ paypalOrderId: 'FINDME00000000001', payerEmail: 'zed@example.com' }), payment({ donorName: 'Sister Maria', type: 'donation' }), payment()]);
    expect((await call('get', '/admin/payments?q=findme')).body.total).toBe(1);
    expect((await call('get', '/admin/payments?q=zed@')).body.total).toBe(1);
    expect((await call('get', '/admin/payments?q=maria')).body.total).toBe(1);
    expect((await call('get', '/admin/payments?status=nope')).status).toBe(400);
    expect((await call('get', '/admin/payments?sort=payerEmail')).status).toBe(400);
    expect((await call('get', '/admin/payments?sort=-amount')).status).toBe(200);
  });

  it('one payment by id; 400 for a bad id, 404 for a missing one', async () => {
    const [p] = fakes.Payment.seed([payment()]);
    expect((await call('get', `/admin/payments/${p._id}`, viewer)).body).toMatchObject({ paypalOrderId: p.paypalOrderId, amount: 23 });
    expect((await call('get', '/admin/payments/nope')).status).toBe(400);
    expect((await call('get', `/admin/payments/${oid()}`)).status).toBe(404);
  });
});

describe('PATCH /admin/payments/:id (resolve)', () => {
  it('an editor resolves an unfulfilled payment with a note; it is audited and leaves the unfulfilled list', async () => {
    const [p] = fakes.Payment.seed([payment()]);
    const res = await call('patch', `/admin/payments/${p._id}`, editor, { resolved: true, note: 'Refunded in PayPal, customer informed' });
    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({ resolvedBy: 'the-editor', notes: 'Refunded in PayPal, customer informed' });
    expect(res.body.item.resolvedAt).toBeTruthy();
    expect(audits('payment.update')[0]).toMatchObject({ actorName: 'the-editor', target: { type: 'payment', id: p._id }, meta: { resolved: true } });
    expect((await call('get', '/admin/payments?status=unfulfilled')).body.total).toBe(0);
    expect((await call('get', '/admin/payments?status=resolved')).body.total).toBe(1);
  });

  it('needs a note to resolve', async () => {
    const [p] = fakes.Payment.seed([payment()]);
    expect((await call('patch', `/admin/payments/${p._id}`, editor, { resolved: true })).status).toBe(400);
    expect((await call('patch', `/admin/payments/${p._id}`, editor, { resolved: true, note: '   ' })).status).toBe(400);
    expect(fakes.Payment.byId(p._id).resolvedAt).toBeNull();
  });

  it('reopens a resolved payment (the note stays for the record)', async () => {
    const [p] = fakes.Payment.seed([payment({ resolvedAt: new Date(), resolvedBy: 'x', notes: 'first note' })]);
    const res = await call('patch', `/admin/payments/${p._id}`, owner, { resolved: false });
    expect(res.status).toBe(200);
    expect(res.body.item.resolvedAt).toBeNull();
    expect(res.body.item.notes).toBe('first note');
    expect((await call('get', '/admin/payments?status=unfulfilled')).body.total).toBe(1);
  });

  it('a payment that already has an order or candle needs no resolving (409)', async () => {
    const [p] = fakes.Payment.seed([payment({ linkedTo: { kind: 'order', id: oid() } })]);
    expect((await call('patch', `/admin/payments/${p._id}`, editor, { resolved: true, note: 'x' })).status).toBe(409);
  });

  it('refuses unknown fields (no editing the amount, the status or the link), long notes, and a viewer', async () => {
    const [p] = fakes.Payment.seed([payment()]);
    expect((await call('patch', `/admin/payments/${p._id}`, editor, { resolved: false, amount: 1 })).status).toBe(400);
    expect((await call('patch', `/admin/payments/${p._id}`, editor, { resolved: false, status: 'captured' })).status).toBe(400);
    expect((await call('patch', `/admin/payments/${p._id}`, editor, { resolved: true, note: 'x'.repeat(1001) })).status).toBe(400);
    expect((await call('patch', `/admin/payments/${p._id}`, viewer, { resolved: false })).status).toBe(403);
    expect(fakes.Payment.byId(p._id)).toMatchObject({ amount: 23, status: 'captured' });
  });

  it('404 for a payment that does not exist', async () => {
    expect((await call('patch', `/admin/payments/${oid()}`, editor, { resolved: false })).status).toBe(404);
  });

  it('there is no way to delete a payment through the API', async () => {
    const [p] = fakes.Payment.seed([payment()]);
    for (const who of [owner, editor]) {
      expect((await call('delete', `/admin/payments/${p._id}`, who)).status).toBe(404);
      expect((await call('put', `/admin/payments/${p._id}`, who, { resolved: false })).status).toBe(404);
      expect((await call('post', '/admin/payments', who, payment())).status).toBe(404);
    }
    expect(fakes.Payment.docs).toHaveLength(1);
  });
});

describe('GET /admin/export/payments.csv', () => {
  it('exports the ledger for an editor (not a viewer) and audits it', async () => {
    fakes.Payment.seed([payment({ paypalOrderId: 'EXPORT00000000001', payerName: '=HYPERLINK("http://evil")', linkedTo: { kind: 'order', id: 'abc123' } })]);
    expect((await call('get', '/admin/export/payments.csv', viewer)).status).toBe(403);
    const res = await call('get', '/admin/export/payments.csv', editor);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/payments-\d{4}-\d{2}-\d{2}\.csv/);
    const [header, line] = res.text.replace(/^﻿/, '').split('\r\n');
    expect(header).toBe('id,createdAt,capturedAt,paypalOrderId,type,status,amount,currency,payerEmail,payerName,donorName,linkedKind,linkedId,resolvedAt,resolvedBy,notes');
    expect(line).toContain('EXPORT00000000001');
    expect(line).toContain(',order,abc123,'); // linked kind and id
    expect(line).toContain("\"'=HYPERLINK(\"\"http://evil\"\")\""); // formula injection neutralised
    expect(audits('export.payments')[0]).toMatchObject({ meta: { rows: 1 } });
  });

  it('?status=unfulfilled exports only the customers who paid and have nothing saved', async () => {
    fakes.Payment.seed([payment({ paypalOrderId: 'UNFULFILLED0000001' }), payment({ paypalOrderId: 'LINKED0000000001', linkedTo: { kind: 'order', id: oid() } })]);
    const res = await call('get', '/admin/export/payments.csv?status=unfulfilled', editor);
    expect(res.text).toContain('UNFULFILLED0000001');
    expect(res.text).not.toContain('LINKED0000000001');
    expect((await call('get', '/admin/export/payments.csv?status=bogus', editor)).status).toBe(400);
    expect((await call('get', '/admin/export/orders.csv?status=unfulfilled', editor)).status).toBe(200); // ignored for the others
  });
});

describe('the dashboard alert', () => {
  it('counts the unfulfilled payments and their amount', async () => {
    fakes.Payment.aggregateImpl = (pipeline) => {
      const rows = fakes.Payment.docs.filter((d) => d.status === 'captured' && !d.linkedTo && !d.resolvedAt && d.type !== 'donation');
      return pipeline.some((s) => s.$group) ? [{ _id: null, amount: rows.reduce((sum, d) => sum + d.amount, 0) }] : rows;
    };
    fakes.Payment.seed([payment({ amount: 23 }), payment({ amount: 3, type: 'candle' }), payment({ type: 'donation' }), payment({ linkedTo: { kind: 'order', id: oid() } })]);
    const res = await call('get', '/admin/dashboard', viewer);
    expect(res.status).toBe(200);
    expect(res.body.alerts).toEqual({ unfulfilledPayments: { count: 2, amount: 26 } });
  });

  it('says zero when everything is fulfilled', async () => {
    const res = await call('get', '/admin/dashboard', viewer);
    expect(res.body.alerts).toEqual({ unfulfilledPayments: { count: 0, amount: 0 } });
  });
});

describe('query filters survive Mongoose sanitizeFilter and the real Payment schema', () => {
  it('every filter the payments routes and the dashboard send comes out unchanged and casts', async () => {
    const [p] = fakes.Payment.seed([payment()]);
    const requests = [
      ['get', '/admin/payments?status=unfulfilled&q=ben&sort=-amount'], ['get', '/admin/payments?status=resolved'],
      ['get', '/admin/payments?status=captured'], ['get', '/admin/payments?status=order'], ['get', `/admin/payments/${p._id}`],
      ['patch', `/admin/payments/${p._id}`, { resolved: true, note: 'handled' }],
      ['get', '/admin/export/payments.csv?status=unfulfilled'], ['get', '/admin/dashboard'],
    ];
    for (const [method, path, body] of requests) expect((await call(method, path, editor, body)).status, `${method} ${path}`).toBeLessThan(500);
    const filters = allFilters().filter((f) => f.name === 'Payment');
    expect(filters.length).toBeGreaterThan(5);
    for (const { name, op, filter } of filters) {
      expect(sanitizeChanges(filter), `${name}.${op} ${JSON.stringify(filter)}`).toBeNull();
      expect(await castProblem(name, filter), `${name}.${op} ${JSON.stringify(filter)}`).toBeNull();
    }
  });
});
