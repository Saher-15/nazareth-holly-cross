import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// An order must not be creatable for a payment that never happened: /order/newOrder can carry the
// PayPal order id, and then PayPal itself is asked whether it was COMPLETED for the exact price.

const OID1 = '64b000000000000000000001';
const PAYPAL_ID = 'ABCDEFGHIJ0123456';

const mocks = vi.hoisted(() => ({
  productFind: vi.fn(),
  orderCreate: vi.fn(),
  orderExists: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('../model/product.js', () => ({
  default: { find: (...a) => ({ select: () => mocks.productFind(...a) }), countDocuments: vi.fn() },
}));
vi.mock('../model/order.js', () => ({
  default: { create: (...a) => mocks.orderCreate(...a), exists: (...a) => mocks.orderExists(...a) },
}));
vi.mock('../services/emailService.js', () => ({ sendMail: (...a) => mocks.sendMail(...a), SENDER: {} }));

const { fakes } = await import('./helpers/fakes.js');
const { createApp } = await import('../app.js');
const { config } = await import('../config/env.js');
const app = createApp();

const address = { firstName: 'A', lastName: 'B', phone: '1', email: 'a@b.co', street: 's', city: 'c', state: 'x', postal: '1', country: 'IL' };
const products = [{ productID: OID1, productName: 'Whatever the browser says', quantity: 2, color: 'brown' }];
// 2 x $10, -10%, +$5 shipping
const PRICE = '23.00';

let ipCounter = 0;
const post = (body) => request(app).post('/order/newOrder').set('X-Forwarded-For', `10.2.0.${++ipCounter}`).send(body);

// A fake PayPal that answers the token call and "GET /v2/checkout/orders/:id".
function paypalOrder(overrides = {}) {
  return {
    id: PAYPAL_ID,
    status: 'COMPLETED',
    purchase_units: [
      {
        amount: { currency_code: 'USD', value: PRICE },
        payments: { captures: [{ id: 'CAP1', status: 'COMPLETED', amount: { currency_code: 'USD', value: PRICE } }] },
      },
    ],
    ...overrides,
  };
}
function mockPayPal({ order = paypalOrder(), status = 200, unreachable = false } = {}) {
  global.fetch = vi.fn(async (url, init) => {
    if (String(url).includes('/oauth2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok' }) };
    if (unreachable) throw new Error('ECONNRESET');
    expect(init.method).toBe('GET');
    return { ok: status < 400, status, json: async () => (status < 400 ? order : { name: 'RESOURCE_NOT_FOUND', message: 'no such order' }) };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fakes.Payment.reset(); // the payment ledger (an in-memory model, __tests__/setup.js) starts empty in every test
  mocks.productFind.mockImplementation(async () => [{ _id: OID1, price: 10, name: 'Olive oil', stock: null }]);
  mocks.orderCreate.mockResolvedValue({ _id: 'abc' });
  mocks.orderExists.mockResolvedValue(null);
  mocks.sendMail.mockResolvedValue(true);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('newOrder with proof of payment', () => {
  it('saves the order as verified when PayPal says it was paid in full', async () => {
    mockPayPal();
    const res = await post({ ...address, products, paypalOrderId: PAYPAL_ID });
    expect(res.status).toBe(201);
    const saved = mocks.orderCreate.mock.calls[0][0];
    expect(saved).toMatchObject({ totalPrice: 23, paypalOrderId: PAYPAL_ID, paymentVerified: true });
    expect(global.fetch.mock.calls.some(([u]) => String(u).endsWith(`/v2/checkout/orders/${PAYPAL_ID}`))).toBe(true);
    expect(mocks.sendMail).toHaveBeenCalledOnce();
  });

  it('asks PayPal with the server-computed price, not the one the browser sent', async () => {
    mockPayPal({ order: paypalOrder({ purchase_units: [{ amount: { currency_code: 'USD', value: '0.01' }, payments: { captures: [{ status: 'COMPLETED', amount: { currency_code: 'USD', value: '0.01' } }] } }] }) });
    const res = await post({ ...address, products, totalPrice: 0.01, paypalOrderId: PAYPAL_ID });
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/does not match/i);
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it.each([
    ['created but never approved', paypalOrder({ status: 'CREATED' })],
    ['approved but not captured', paypalOrder({ status: 'APPROVED' })],
    ['voided', paypalOrder({ status: 'VOIDED' })],
    ['paid in another currency', paypalOrder({ purchase_units: [{ amount: { currency_code: 'EUR', value: PRICE }, payments: { captures: [{ status: 'COMPLETED', amount: { currency_code: 'EUR', value: PRICE } }] } }] })],
    ['completed with no capture listed', paypalOrder({ purchase_units: [{ amount: { currency_code: 'USD', value: PRICE } }] })],
    ['captured but refunded', paypalOrder({ purchase_units: [{ amount: { currency_code: 'USD', value: PRICE }, payments: { captures: [{ status: 'REFUNDED', amount: { currency_code: 'USD', value: PRICE } }] } }] })],
    ['captured for less than the price', paypalOrder({ purchase_units: [{ amount: { currency_code: 'USD', value: PRICE }, payments: { captures: [{ status: 'COMPLETED', amount: { currency_code: 'USD', value: '5.00' } }] } }] })],
    ['for several purchases', paypalOrder({ purchase_units: [paypalOrder().purchase_units[0], paypalOrder().purchase_units[0]] })],
    ['with no purchase at all', paypalOrder({ purchase_units: [] })],
  ])('refuses an order whose payment is %s', async (_name, order) => {
    mockPayPal({ order });
    const res = await post({ ...address, products, paypalOrderId: PAYPAL_ID });
    expect(res.status).toBe(402);
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it('refuses a payment that does not exist at PayPal', async () => {
    mockPayPal({ status: 404 });
    const res = await post({ ...address, products, paypalOrderId: PAYPAL_ID });
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('Payment not found');
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it('fails closed (502, nothing saved) when PayPal cannot be asked', async () => {
    mockPayPal({ unreachable: true });
    const res = await post({ ...address, products, paypalOrderId: PAYPAL_ID });
    expect(res.status).toBe(502);
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it('lets one payment pay for one order only', async () => {
    mockPayPal();
    mocks.orderExists.mockResolvedValueOnce({ _id: 'earlier' });
    const res = await post({ ...address, products, paypalOrderId: PAYPAL_ID });
    expect(res.status).toBe(409);
    expect(mocks.orderExists).toHaveBeenCalledWith({ paypalOrderId: PAYPAL_ID });
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled(); // no need to ask PayPal
  });

  it('closes the race between two simultaneous orders with the same payment (unique index -> 409)', async () => {
    mockPayPal();
    mocks.orderCreate.mockRejectedValueOnce(Object.assign(new Error('E11000 duplicate key error ... paypalOrderId_1 ...'), { code: 11000 }));
    const res = await post({ ...address, products, paypalOrderId: PAYPAL_ID });
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).not.toContain('E11000');
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it.each([['abc'], ['abcdefghij0123456'], ['ABCDEFGHIJ012345'], [12345678901234567], [{ $ne: null }], [['ABCDEFGHIJ0123456']]])(
    'refuses a malformed paypalOrderId (%j)',
    async (bad) => {
      const res = await post({ ...address, products, paypalOrderId: bad });
      expect([400, 422]).toContain(res.status);
      expect(mocks.orderCreate).not.toHaveBeenCalled();
    },
  );
});

describe('newOrder without proof of payment (clients that do not send it yet)', () => {
  it('still works, is stored as unverified, and logs a warning', async () => {
    const res = await post({ ...address, products });
    expect(res.status).toBe(201);
    const saved = mocks.orderCreate.mock.calls[0][0];
    expect(saved).not.toHaveProperty('paypalOrderId');
    expect(saved).not.toHaveProperty('paymentVerified');
    expect(saved.totalPrice).toBe(23);
    expect(console.warn.mock.calls.flat().join(' ')).toMatch(/unverified-order.*without paypalOrderId/);
  });

  it.each([[''], [null]])('treats an empty paypalOrderId (%j) as not sent', async (empty) => {
    const res = await post({ ...address, products, paypalOrderId: empty });
    expect(res.status).toBe(201);
  });

  it('is refused (402) once REQUIRE_PAYMENT_PROOF is on, and a verified payment still works', async () => {
    config.requirePaymentProof = true;
    try {
      const refused = await post({ ...address, products });
      expect(refused.status).toBe(402);
      expect(mocks.orderCreate).not.toHaveBeenCalled();

      mockPayPal();
      const accepted = await post({ ...address, products, paypalOrderId: PAYPAL_ID });
      expect(accepted.status).toBe(201);
    } finally {
      config.requirePaymentProof = false;
    }
  });
});

describe('newOrder input', () => {
  it('stores product names and ids from the database, not what the browser said', async () => {
    await post({ ...address, products: [{ productID: OID1, productName: '<b>Free gold</b>', quantity: 2, color: 'brown', price: 0 }] });
    expect(mocks.orderCreate.mock.calls[0][0].products).toEqual([{ productID: OID1, productName: 'Olive oil', quantity: 2, color: 'brown' }]);
  });

  it('builds the order from the known fields only (no mass assignment)', async () => {
    await post({ ...address, products, done: true, paymentVerified: true, _id: 'x', totalPrice: 1, date: '1999-01-01', createdAt: 'x' });
    const saved = mocks.orderCreate.mock.calls[0][0];
    expect(saved.done).toBe(false);
    expect(saved).not.toHaveProperty('paymentVerified');
    expect(saved).not.toHaveProperty('_id');
    expect(saved.totalPrice).toBe(23);
    expect(saved.date).toBeInstanceOf(Date);
  });

  it.each([
    ['an address list instead of one address', { email: 'a@b.co,victim@example.com' }],
    ['angle brackets', { email: 'Boss <a@b.co>' }],
    ['a line break (header injection)', { email: 'a@b.co\r\nBcc: x@y.zz' }],
    ['no @', { email: 'nobody' }],
    ['an object', { email: { $ne: null } }],
    ['a name that is an array', { firstName: ['A'] }],
    ['a street that is an object', { street: { $gt: '' } }],
    ['a blank city', { city: '   ' }],
  ])('refuses %s', async (_name, patch) => {
    const res = await post({ ...address, products, ...patch });
    expect(res.status).toBe(422);
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it('accepts a phone or postal code sent as a number', async () => {
    const res = await post({ ...address, products, phone: 972521234567, postal: 16000 });
    expect(res.status).toBe(201);
    expect(mocks.orderCreate.mock.calls[0][0]).toMatchObject({ phone: '972521234567', postal: '16000' });
  });

  it('rejects products that are not a list, or are not valid ids', async () => {
    expect((await post({ ...address, products: 'x' })).status).toBe(422);
    expect((await post({ ...address, products: [] })).status).toBe(422);
    expect((await post({ ...address, products: [{ productID: { $ne: null }, quantity: 1 }] })).status).toBe(400);
    expect((await post({ ...address, products: [{ productID: 'abcdefghijkl', quantity: 1 }] })).status).toBe(400); // 12 characters
  });
});
