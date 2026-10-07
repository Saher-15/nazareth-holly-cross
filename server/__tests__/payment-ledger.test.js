import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// The payment ledger: the server's own record of every PayPal payment, written at create_order, completed at
// complete_order, linked to the order or candle by the browser's second call. Nothing here reaches PayPal or MongoDB:
// PayPal is a fake fetch, the models are in-memory.

vi.mock('../model/product.js', async () => (await import('./helpers/fakes.js')).fakeModule('Product'));
vi.mock('../model/order.js', async () => (await import('./helpers/fakes.js')).fakeModule('Order', { timestamps: true, unique: ['paypalOrderId'], defaults: { done: false, paymentVerified: false } }));
vi.mock('../model/candle.js', async () => (await import('./helpers/fakes.js')).fakeModule('Candle', { timestamps: true, unique: ['paypalOrderId'], defaults: { done: false, paymentVerified: false } }));
const mail = vi.hoisted(() => ({ sendMail: vi.fn(async () => true) }));
vi.mock('../services/emailService.js', () => ({ sendMail: mail.sendMail, SENDER: {} }));

const { fakes, oid } = await import('./helpers/fakes.js');
const { createApp } = await import('../app.js');
const { config } = await import('../config/env.js');
const { PAYMENT_GRACE_MS } = await import('../model/paymentConstants.js');
const { recordCreated, recordCaptured, unfulfilledFilter, unfulfilledSummary } = await import('../services/payments.js');
const app = createApp();

const PAYPAL = 'ABCDEFGHIJ0123456';
const OTHER = 'ZYXWVUTSRQ6543210';
let ip = 0;
const post = (path, body) => request(app).post(path).set('X-Forwarded-For', `10.7.${Math.floor(++ip / 250)}.${(ip % 250) + 1}`).send(body);

const address = { firstName: 'A', lastName: 'B', phone: '1', email: 'a@b.co', street: 's', city: 'c', state: 'x', postal: '1', country: 'IL' };
const PRODUCT_ID = oid();
const orderBody = (extra = {}) => ({ ...address, products: [{ productID: PRODUCT_ID, productName: 'x', quantity: 2, color: '' }], ...extra });
const candleBody = (extra = {}) => ({ firstName: 'Ann', lastName: 'Lee', email: 'ann@example.com', prayer: 'Peace for all', ...extra });
const PRICE = '23.00'; // 2 x $10, -10%, +$5 shipping

// A fake PayPal: token, create, capture and "read the order back". `state` records what was asked.
function paypal(options = {}) {
  const state = { calls: [], created: options.createId ?? PAYPAL };
  const o = { captureStatus: 'COMPLETED', captureHttp: 201, getStatus: 'COMPLETED', getAmount: PRICE, captureAmount: PRICE, ...options };
  const answer = (status, body) => ({ ok: status < 400, status, json: async () => body });
  global.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url);
    const method = init.method ?? 'GET';
    state.calls.push(`${method} ${u.replace(/^https:\/\/[^/]+/, '')}`);
    if (u.includes('/oauth2/token')) return answer(200, { access_token: 'tok', expires_in: 100 });
    if (u.endsWith('/capture')) {
      if (o.captureHttp >= 400) return answer(o.captureHttp, { name: 'UNPROCESSABLE_ENTITY', message: 'order already captured' });
      return answer(o.captureHttp, {
        id: PAYPAL,
        status: o.captureStatus,
        payer: { email_address: 'Buyer@Example.com', name: { given_name: 'Ben', surname: 'Buyer' } },
        purchase_units: [{ payments: { captures: [{ amount: { value: o.captureAmount, currency_code: 'USD' } }] } }],
      });
    }
    if (method === 'GET') {
      return answer(200, {
        id: PAYPAL,
        status: o.getStatus,
        purchase_units: [{
          amount: { currency_code: 'USD', value: o.getAmount },
          payments: { captures: [{ id: 'CAP', status: 'COMPLETED', amount: { currency_code: 'USD', value: o.getAmount } }] },
        }],
      });
    }
    return answer(201, { id: state.created, status: 'CREATED' });
  });
  return state;
}

const rows = () => fakes.Payment.docs;
const row = (id = PAYPAL) => rows().find((p) => p.paypalOrderId === id);

beforeEach(() => {
  vi.clearAllMocks();
  for (const name of ['Payment', 'Order', 'Candle', 'Product']) fakes[name].reset();
  fakes.Product.seed([{ _id: PRODUCT_ID, name: 'Olive oil', price: 10, stock: null }]);
  mail.sendMail.mockResolvedValue(true);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('create_order writes the ledger before the customer can pay', () => {
  it('records a shop order as "created" with the price the SERVER computed', async () => {
    paypal();
    const res = await post('/order/create_order', { type: 'order', items: [{ _id: PRODUCT_ID, quantity: 2 }], amount: 0.01 });
    expect(res.status).toBe(200);
    expect(rows()).toHaveLength(1);
    expect(row()).toMatchObject({ paypalOrderId: PAYPAL, type: 'order', amount: 23, currency: 'USD', status: 'created' });
    expect(row().capturedAt).toBeFalsy();
    expect(row().linkedTo).toBeUndefined();
  });

  it('records a candle at its fixed price', async () => {
    paypal();
    await post('/order/create_order', { type: 'candle', amount: 999 });
    expect(row()).toMatchObject({ type: 'candle', amount: 3, status: 'created' });
  });

  it('records a donation with the donor name when one is sent (it is optional)', async () => {
    paypal();
    await post('/order/create_order', { type: 'donation', amount: 25, donorName: '  Maria Rossi  ' });
    expect(row()).toMatchObject({ type: 'donation', amount: 25, donorName: 'Maria Rossi' });

    fakes.Payment.reset();
    paypal();
    await post('/order/create_order', { type: 'donation', amount: 10 });
    expect(row().donorName).toBeUndefined();
  });

  it('ignores a donor name that is not text, is too long, or is sent for something that is not a donation', async () => {
    paypal();
    await post('/order/create_order', { type: 'donation', amount: 10, donorName: { $ne: 1 } });
    expect(row().donorName).toBeUndefined();
    fakes.Payment.reset();
    paypal();
    await post('/order/create_order', { type: 'donation', amount: 10, donorName: 'x'.repeat(500) });
    expect(row().donorName).toHaveLength(100);
    fakes.Payment.reset();
    paypal();
    await post('/order/create_order', { type: 'candle', donorName: 'Someone' });
    expect(row().donorName).toBeUndefined();
  });

  it('keeps an old client (no type) in the ledger as "unknown"', async () => {
    paypal();
    await post('/order/create_order', { amount: '7' });
    expect(row()).toMatchObject({ type: 'unknown', amount: 7 });
  });

  it('does not hand the PayPal id to the browser when the ledger cannot be written (nothing was charged)', async () => {
    paypal();
    const failing = vi.spyOn(fakes.Payment, 'findOneAndUpdate').mockImplementation(() => { throw new Error('database is down'); });
    const res = await post('/order/create_order', { type: 'candle' });
    failing.mockRestore();
    expect(res.status).toBe(503);
    expect(res.body.id).toBeUndefined();
    expect(res.body.error).toMatch(/nothing was charged/i);
    expect(rows()).toHaveLength(0);
  });

  it('a validation failure never reaches PayPal or the ledger', async () => {
    paypal();
    expect((await post('/order/create_order', { type: 'donation', amount: 0.5 })).status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
  });
});

describe('complete_order marks the payment captured, once', () => {
  beforeEach(async () => {
    paypal();
    await post('/order/create_order', { type: 'order', items: [{ _id: PRODUCT_ID, quantity: 2 }] });
  });

  it('records the capture time and what PayPal says about the payer', async () => {
    const res = await post('/order/complete_order', { order_id: PAYPAL });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: PAYPAL, status: 'COMPLETED' });
    expect(rows()).toHaveLength(1);
    expect(row()).toMatchObject({ status: 'captured', type: 'order', amount: 23, payerEmail: 'buyer@example.com', payerName: 'Ben Buyer' });
    expect(row().capturedAt).toBeInstanceOf(Date);
  });

  it('a second call (retry, double click) captures nothing again and changes nothing', async () => {
    const state = paypal();
    await post('/order/complete_order', { order_id: PAYPAL });
    const capturedAt = row().capturedAt;
    const again = await post('/order/complete_order', { order_id: PAYPAL });
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ id: PAYPAL, status: 'COMPLETED' });
    expect(state.calls.filter((c) => c.endsWith('/capture'))).toHaveLength(1);
    expect(rows()).toHaveLength(1);
    expect(row().capturedAt).toBe(capturedAt);
  });

  it('two calls at the same moment still leave one captured row', async () => {
    paypal();
    const [a, b] = await Promise.all([post('/order/complete_order', { order_id: PAYPAL }), post('/order/complete_order', { order_id: PAYPAL })]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(rows()).toHaveLength(1);
    expect(row().status).toBe('captured');
  });

  it('a payment the ledger never saw (created by the API before the ledger existed) is recorded now as "unknown"', async () => {
    fakes.Payment.reset();
    paypal();
    const res = await post('/order/complete_order', { order_id: PAYPAL });
    expect(res.status).toBe(200);
    expect(row()).toMatchObject({ status: 'captured', type: 'unknown', amount: 23 });
  });

  it('a declined capture is answered 402 and marked failed; a later successful capture of the same order wins', async () => {
    paypal({ captureStatus: 'DECLINED' });
    expect((await post('/order/complete_order', { order_id: PAYPAL })).status).toBe(402);
    expect(row().status).toBe('failed');

    paypal({ captureStatus: 'COMPLETED' });
    expect((await post('/order/complete_order', { order_id: PAYPAL })).status).toBe(200);
    expect(row().status).toBe('captured');
    expect(rows()).toHaveLength(1);
  });

  it('PayPal answering "cannot capture" for an order it already completed (the first answer was lost) is a success', async () => {
    const state = paypal({ captureHttp: 422 });
    const res = await post('/order/complete_order', { order_id: PAYPAL });
    expect(res.status).toBe(200);
    expect(state.calls.some((c) => c.startsWith('GET ') && c.includes(PAYPAL))).toBe(true);
    expect(row().status).toBe('captured'); // (an order read back has no payer details: they stay empty)
    expect(row().payerEmail).toBeUndefined();
  });

  it('PayPal answering "cannot capture" for an order that is not completed (declined card) is a definite 402 and marks it failed', async () => {
    paypal({ captureHttp: 422, getStatus: 'APPROVED' });
    const res = await post('/order/complete_order', { order_id: PAYPAL });
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('Payment was not completed');
    expect(row().status).toBe('failed');
  });

  it('PayPal that cannot be asked at all leaves the outcome unknown (502), and the row stays as it was', async () => {
    global.fetch = vi.fn(async (url, init = {}) => {
      const u = String(url);
      if (u.includes('/oauth2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 100 }) };
      if (u.endsWith('/capture')) return { ok: false, status: 422, json: async () => ({ name: 'UNPROCESSABLE_ENTITY' }) };
      throw new Error('ECONNRESET'); // reading the order back fails
    });
    const res = await post('/order/complete_order', { order_id: PAYPAL });
    expect(res.status).toBe(502);
    expect(row().status).toBe('created');
  });

  it('a ledger failure after PayPal took the money does not tell the customer the payment failed', async () => {
    paypal();
    const failing = vi.spyOn(fakes.Payment, 'findOneAndUpdate').mockImplementation(() => { throw new Error('database is down'); });
    const res = await post('/order/complete_order', { order_id: PAYPAL });
    failing.mockRestore();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('was captured but not recorded'));
  });
});

describe('newOrder links the payment to the order', () => {
  const paid = async () => {
    paypal();
    await post('/order/create_order', { type: 'order', items: [{ _id: PRODUCT_ID, quantity: 2 }] });
    await post('/order/complete_order', { order_id: PAYPAL });
  };

  it('stores the order and points the payment at it', async () => {
    await paid();
    const res = await post('/order/newOrder', orderBody({ paypalOrderId: PAYPAL }));
    expect(res.status).toBe(201);
    const saved = fakes.Order.docs[0];
    expect(saved).toMatchObject({ paypalOrderId: PAYPAL, paymentVerified: true, totalPrice: 23 });
    expect(row().linkedTo).toEqual({ kind: 'order', id: saved._id });
    expect(row().status).toBe('captured');
  });

  it('a second order with the same payment is refused (409) and nothing is stored twice', async () => {
    await paid();
    await post('/order/newOrder', orderBody({ paypalOrderId: PAYPAL }));
    const again = await post('/order/newOrder', orderBody({ paypalOrderId: PAYPAL }));
    expect(again.status).toBe(409);
    expect(fakes.Order.docs).toHaveLength(1);
  });

  it('a payment made as a DONATION cannot pay for an order (even for the same amount)', async () => {
    paypal();
    await post('/order/create_order', { type: 'donation', amount: 23 });
    await post('/order/complete_order', { order_id: PAYPAL });
    const res = await post('/order/newOrder', orderBody({ paypalOrderId: PAYPAL }));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/something else/);
    expect(fakes.Order.docs).toHaveLength(0);
    expect(row().linkedTo).toBeUndefined();
  });

  it('a payment made for a CANDLE cannot pay for an order', async () => {
    paypal();
    await post('/order/create_order', { type: 'candle' });
    await post('/order/complete_order', { order_id: PAYPAL });
    expect((await post('/order/newOrder', orderBody({ paypalOrderId: PAYPAL }))).status).toBe(409);
    expect(fakes.Order.docs).toHaveLength(0);
  });

  it('a payment the ledger does not know is still proven with PayPal, then recorded and linked', async () => {
    paypal();
    const res = await post('/order/newOrder', orderBody({ paypalOrderId: PAYPAL }));
    expect(res.status).toBe(201);
    expect(row()).toMatchObject({ type: 'order', status: 'captured', amount: 23 });
    expect(row().linkedTo.kind).toBe('order');
    expect(row().capturedAt).toBeInstanceOf(Date);
  });

  it('a ledger failure after the order was saved does not fail the order', async () => {
    await paid();
    const failing = vi.spyOn(fakes.Payment, 'findOneAndUpdate').mockImplementation(() => { throw new Error('database is down'); });
    const res = await post('/order/newOrder', orderBody({ paypalOrderId: PAYPAL }));
    failing.mockRestore();
    expect(res.status).toBe(201);
    expect(fakes.Order.docs).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('was not linked'));
  });

  it('an old client that sends no payment id still works (its order is stored unverified)', async () => {
    const res = await post('/order/newOrder', orderBody());
    expect(res.status).toBe(201);
    expect(fakes.Order.docs[0].paymentVerified).toBe(false);
    expect(rows()).toHaveLength(0);
  });
});

describe('lightACandle links the payment to the candle', () => {
  const paidCandle = async (id = PAYPAL) => {
    paypal({ createId: id });
    await post('/order/create_order', { type: 'candle' });
    await post('/order/complete_order', { order_id: id });
  };

  it('a payment the ledger knows as captured still has its amount proven with PayPal ()', async () => {
    await paidCandle();
    const state = paypal({ getAmount: '3.00' }); // fresh call log
    const res = await post('/candle/lightACandle', candleBody({ paypalOrderId: PAYPAL }));
    expect(res.status).toBe(200);
    expect(state.calls.some((c) => c.startsWith('GET '))).toBe(true);
    expect(fakes.Candle.docs[0]).toMatchObject({ paypalOrderId: PAYPAL, paymentVerified: true });
    expect(row().linkedTo).toEqual({ kind: 'candle', id: fakes.Candle.docs[0]._id });
  });

  it('a payment that is not captured in the ledger is proven with PayPal ($3, completed)', async () => {
    paypal({ createId: PAYPAL });
    await post('/order/create_order', { type: 'candle' }); // created, never captured here
    const state = paypal({ getAmount: '3.00' });
    const res = await post('/candle/lightACandle', candleBody({ paypalOrderId: PAYPAL }));
    expect(res.status).toBe(200);
    expect(state.calls.some((c) => c.startsWith('GET '))).toBe(true);
    expect(row()).toMatchObject({ status: 'captured', linkedTo: { kind: 'candle' } });
  });

  it('refuses (402) a payment PayPal says is for another amount, and stores nothing', async () => {
    paypal({ getAmount: '1.00' });
    const res = await post('/candle/lightACandle', candleBody({ paypalOrderId: PAYPAL }));
    expect(res.status).toBe(402);
    expect(fakes.Candle.docs).toHaveLength(0);
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('a cheaper payment the ledger already shows as captured cannot light a candle (402)', async () => {
    await paidCandle(); // e.g. a legacy create_order priced by the client
    paypal({ getAmount: '1.00' });
    const res = await post('/candle/lightACandle', candleBody({ paypalOrderId: PAYPAL }));
    expect(res.status).toBe(402);
    expect(fakes.Candle.docs).toHaveLength(0);
  });

  it('one payment lights one candle: the second request is refused (409)', async () => {
    await paidCandle();
    paypal({ getAmount: '3.00' });
    expect((await post('/candle/lightACandle', candleBody({ paypalOrderId: PAYPAL }))).status).toBe(200);
    expect((await post('/candle/lightACandle', candleBody({ paypalOrderId: PAYPAL }))).status).toBe(409);
    expect(fakes.Candle.docs).toHaveLength(1);
  });

  it('a payment made for an order or a donation cannot light a candle', async () => {
    paypal();
    await post('/order/create_order', { type: 'donation', amount: 3 });
    await post('/order/complete_order', { order_id: PAYPAL });
    const res = await post('/candle/lightACandle', candleBody({ paypalOrderId: PAYPAL }));
    expect(res.status).toBe(409);
    expect(fakes.Candle.docs).toHaveLength(0);
  });

  it('refuses a malformed payment id', async () => {
    expect((await post('/candle/lightACandle', candleBody({ paypalOrderId: 'nope' }))).status).toBe(400);
    expect((await post('/candle/lightACandle', candleBody({ paypalOrderId: { $ne: 1 } }))).status).toBe(400);
  });

  it('an old client without a payment id still works (warning logged), unless proof is required', async () => {
    expect((await post('/candle/lightACandle', candleBody())).status).toBe(200);
    expect(fakes.Candle.docs[0].paymentVerified).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('unverified-candle'));

    config.requirePaymentProof = true;
    try {
      expect((await post('/candle/lightACandle', candleBody())).status).toBe(402);
    } finally {
      config.requirePaymentProof = false;
    }
    expect(fakes.Candle.docs).toHaveLength(1);
  });
});

describe('confirmation mails: only for a paid request, and no visitor text in them (security review 06, finding 5)', () => {
  const paidCandle = async () => {
    paypal({ createId: PAYPAL, getAmount: '3.00' });
    await post('/order/create_order', { type: 'candle' });
    await post('/order/complete_order', { order_id: PAYPAL });
  };
  const paidOrder = async () => {
    paypal();
    await post('/order/create_order', { type: 'order', items: [{ _id: PRODUCT_ID, quantity: 2 }] });
    await post('/order/complete_order', { order_id: PAYPAL });
  };
  const sent = () => mail.sendMail.mock.calls.map(([m]) => m);
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('a paid candle request is confirmed once, in plain text, to exactly the address typed', async () => {
    await paidCandle();
    const res = await post('/candle/lightACandle', candleBody({ email: ' Ann.Lee+nhc@Example.co.il ', paypalOrderId: PAYPAL }));
    expect(res.status).toBe(200);
    expect(sent()).toHaveLength(1);
    const [m] = sent();
    expect(m.to).toEqual(['Ann.Lee+nhc@Example.co.il']);
    expect(m.html).toBeUndefined();
    expect(m.text.split('\n')[0]).toBe('Dear Ann,');
    expect(m.text).toContain(`Your request number: ${fakes.Candle.docs[0]._id}`);
    expect(m.text).toContain(`Your PayPal payment reference: ${PAYPAL}`);
    expect(m.text).not.toContain('Peace for all'); // the prayer is never repeated
    expect(m.text).not.toContain('Lee'); // nor the last name
  });

  it.each([
    ['a phishing sentence with a link', 'Your PayPal refund is ready, claim it at https://evil.example/claim'],
    ['a bare domain', 'evil.example'],
    ['markup', '<a href="https://evil.example">Click</a>'],
    ['an escaped tag (as the API stores it)', '&lt;b&gt;Ann&lt;/b&gt;'],
    ['a line break and a fake header', 'Ann\r\nBcc: victim@example.com'],
    ['digits', 'Call 0501234567'],
    ['a long run of words', 'Ann Bea Cat Dot'],
    ['an invisible right-to-left override', 'Ann\u202Egpj.exe'],
  ])('a name with %s is not echoed: the mail says "Dear friend,"', async (_label, firstName) => {
    await paidCandle();
    const res = await post('/candle/lightACandle', candleBody({ firstName, lastName: 'Visit https://evil.example now', paypalOrderId: PAYPAL }));
    expect(res.status).toBe(200);
    const [m] = sent();
    expect(m.text.split('\n')[0]).toBe('Dear friend,');
    expect(m.text).not.toMatch(/evil|https?:|refund|<|&lt;|Bcc|0501234567|\u202E|Visit/i);
    expect(m.text.split('\n').every((line) => line.length <= 80)).toBe(true);
  });

  it('an UNPAID candle request is saved for the staff, but no mail goes out', async () => {
    const res = await post('/candle/lightACandle', candleBody({ firstName: 'Your PayPal refund is ready', email: 'victim@example.com' }));
    expect(res.status).toBe(200);
    expect(fakes.Candle.docs[0].paymentVerified).toBe(false);
    expect(mail.sendMail).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('no confirmation mail sent'));
  });

  it('a paid shop order is confirmed with the order number only; an UNPAID one is saved without a mail', async () => {
    await paidOrder();
    expect((await post('/order/newOrder', orderBody({ firstName: 'Claim your refund at https://evil.example', paypalOrderId: PAYPAL }))).status).toBe(201);
    await flush();
    expect(sent()).toHaveLength(1);
    const saved = fakes.Order.docs[0]._id;
    expect(sent()[0].text).toBe(`Order number #${String(saved).slice(-8)} (reference ${saved}), we will let you know when your order ships :)`);
    expect(sent()[0].html).toBeUndefined();

    mail.sendMail.mockClear();
    expect((await post('/order/newOrder', orderBody({ email: 'victim@example.com' }))).status).toBe(201);
    await flush();
    expect(fakes.Order.docs).toHaveLength(2);
    expect(mail.sendMail).not.toHaveBeenCalled();
  });
});

describe('services/payments', () => {
  it('recordCreated twice keeps one row and never rewrites the amount', async () => {
    await recordCreated({ paypalOrderId: PAYPAL, type: 'order', amount: 23 });
    await recordCreated({ paypalOrderId: PAYPAL, type: 'candle', amount: 3 });
    expect(rows()).toHaveLength(1);
    expect(row()).toMatchObject({ type: 'order', amount: 23 });
  });

  it('the unique index stops two rows for one PayPal order', async () => {
    await new fakes.Payment({ paypalOrderId: PAYPAL, type: 'order', amount: 1 }).save();
    await expect(new fakes.Payment({ paypalOrderId: PAYPAL, type: 'order', amount: 1 }).save()).rejects.toMatchObject({ code: 11000 });
  });

  it('recordCaptured reports whether it was the first time', async () => {
    await recordCreated({ paypalOrderId: PAYPAL, type: 'order', amount: 23 });
    expect((await recordCaptured(PAYPAL, {})).firstTime).toBe(true);
    expect((await recordCaptured(PAYPAL, {})).firstTime).toBe(false);
  });

  describe('unfulfilled payments', () => {
    const NOW = Date.now();
    const old = new Date(NOW - PAYMENT_GRACE_MS - 60_000);
    const fresh = new Date(NOW - 60_000);
    const base = { status: 'captured', type: 'order', amount: 10, capturedAt: old, resolvedAt: null };
    const seed = () => fakes.Payment.seed([
      { ...base, paypalOrderId: 'UNFULFILLED0000001' },
      { ...base, paypalOrderId: 'UNFULFILLED0000002', type: 'candle', amount: 3 },
      { ...base, paypalOrderId: 'UNFULFILLED0000003', type: 'unknown', amount: 5 },
      { ...base, paypalOrderId: 'JUSTNOW000000001', capturedAt: fresh }, // the browser is still saving it
      { ...base, paypalOrderId: 'DONATION00000001', type: 'donation' }, // complete by itself
      { ...base, paypalOrderId: 'LINKED0000000001', linkedTo: { kind: 'order', id: oid() } },
      { ...base, paypalOrderId: 'RESOLVED000000001', resolvedAt: new Date() },
      { ...base, paypalOrderId: 'CREATED0000000001', status: 'created', capturedAt: null }, // never paid
      { ...base, paypalOrderId: 'FAILED00000000001', status: 'failed' },
    ]);

    it('lists captured order / candle / unknown payments with nothing linked, after the grace period', async () => {
      seed();
      const found = await fakes.Payment.find(unfulfilledFilter(NOW));
      expect(found.map((p) => p.paypalOrderId).sort()).toEqual(['UNFULFILLED0000001', 'UNFULFILLED0000002', 'UNFULFILLED0000003']);
    });

    it('sums them for the dashboard alert', async () => {
      seed();
      fakes.Payment.aggregateImpl = (pipeline) => {
        const matched = fakes.Payment.docs.filter((d) => pipeline[0].$match && ['UNFULFILLED0000001', 'UNFULFILLED0000002', 'UNFULFILLED0000003'].includes(d.paypalOrderId));
        return [{ _id: null, amount: matched.reduce((s, d) => s + d.amount, 0) }];
      };
      expect(await unfulfilledSummary(NOW)).toEqual({ count: 3, amount: 18 });
    });
  });
});
