import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const OID1 = '64b000000000000000000001';
const OID2 = '64b000000000000000000002';

const productFind = vi.fn();
const orderCreate = vi.fn();
const sendMail = vi.fn(() => Promise.resolve(true));

vi.mock('../model/product.js', () => ({
  default: { find: (...a) => ({ select: () => productFind(...a) }), countDocuments: vi.fn() },
}));
vi.mock('../model/order.js', () => ({ default: { create: (...a) => orderCreate(...a) } }));
vi.mock('../services/emailService.js', () => ({ sendMail: (...a) => sendMail(...a), SENDER: {} }));

const { fakes } = await import('./helpers/fakes.js');
const { createApp } = await import('../app.js');
const app = createApp();

// Fake PayPal: token call + one orders call
function mockPayPal({ orderStatus = 'CREATED', captureStatus = 'COMPLETED', fail = false } = {}) {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/oauth2/token')) {
      return { ok: !fail, status: fail ? 401 : 200, json: async () => ({ access_token: 'tok' }) };
    }
    if (String(url).endsWith('/capture')) {
      return { ok: true, status: 201, json: async () => ({ id: 'ABC', status: captureStatus }) };
    }
    return { ok: true, status: 201, json: async () => ({ id: 'ORDER123456789012', status: orderStatus }) };
  });
}
const orderBody = () => JSON.parse(global.fetch.mock.calls.find(([u]) => String(u).endsWith('/v2/checkout/orders'))[1].body);

beforeEach(() => {
  vi.clearAllMocks();
  fakes.Payment.reset(); // the payment ledger (an in-memory model, __tests__/setup.js) starts empty in every test
  const all = [
    { _id: OID1, price: 10, name: 'Olive oil', stock: null },
    { _id: OID2, price: 50, name: 'Puzzle', stock: 2 },
  ];
  productFind.mockImplementation(async (query) => all.filter((p) => query._id.$in.includes(String(p._id))));
});

describe('create_order pricing', () => {
  it('charges a shop order from database prices (10% off + $5 shipping)', async () => {
    mockPayPal();
    const res = await request(app)
      .post('/order/create_order')
      .send({ type: 'order', items: [{ _id: OID1, quantity: 2 }], amount: 0.01 });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(23); // 20 * 0.9 + 5
    expect(orderBody().purchase_units[0].amount.value).toBe('23.00');
  });

  it('ignores a tampered client amount for shop orders', async () => {
    mockPayPal();
    await request(app).post('/order/create_order').send({ type: 'order', items: [{ _id: OID1, quantity: 1 }], amount: 0.01 });
    expect(orderBody().purchase_units[0].amount.value).toBe('14.00');
  });

  it('rejects unknown products, bad ids and bad quantities', async () => {
    mockPayPal();
    productFind.mockResolvedValueOnce([]);
    expect((await request(app).post('/order/create_order').send({ type: 'order', items: [{ _id: OID1, quantity: 1 }] })).status).toBe(400);
    expect((await request(app).post('/order/create_order').send({ type: 'order', items: [{ _id: 'zzz', quantity: 1 }] })).status).toBe(400);
    expect((await request(app).post('/order/create_order').send({ type: 'order', items: [{ _id: OID1, quantity: 0 }] })).status).toBe(400);
    expect((await request(app).post('/order/create_order').send({ type: 'order', items: [] })).status).toBe(400);
  });

  it('rejects more than the stock', async () => {
    mockPayPal();
    const res = await request(app).post('/order/create_order').send({ type: 'order', items: [{ _id: OID2, quantity: 3 }] });
    expect(res.status).toBe(409);
  });

  it('charges a fixed price for a candle regardless of the amount sent', async () => {
    mockPayPal();
    await request(app).post('/order/create_order').send({ type: 'candle', amount: 0.01 });
    expect(orderBody().purchase_units[0].amount.value).toBe('3.00');
  });

  it('bounds donations', async () => {
    mockPayPal();
    expect((await request(app).post('/order/create_order').send({ type: 'donation', amount: 25 })).status).toBe(200);
    expect((await request(app).post('/order/create_order').send({ type: 'donation', amount: 0.5 })).status).toBe(400);
    expect((await request(app).post('/order/create_order').send({ type: 'donation', amount: 1e9 })).status).toBe(400);
  });

  it('rejects an unknown type', async () => {
    const res = await request(app).post('/order/create_order').send({ type: 'free', amount: 1 });
    expect(res.status).toBe(400);
  });

  it('still accepts legacy clients without a type (deprecated)', async () => {
    mockPayPal();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await request(app).post('/order/create_order').send({ amount: '7' });
    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('answers 502 when PayPal rejects our credentials', async () => {
    mockPayPal({ fail: true });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/order/create_order').send({ type: 'candle' });
    expect(res.status).toBe(502);
    log.mockRestore();
  });
});

describe('complete_order', () => {
  it('rejects a malformed order id', async () => {
    expect((await request(app).post('/order/complete_order').send({ order_id: 'x' })).status).toBe(400);
  });

  it('confirms a completed capture', async () => {
    mockPayPal({ captureStatus: 'COMPLETED' });
    const res = await request(app).post('/order/complete_order').send({ order_id: 'ABCDEFGHIJ0123456' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  it('answers 402 when the capture did not complete', async () => {
    mockPayPal({ captureStatus: 'DECLINED' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/order/complete_order').send({ order_id: 'ABCDEFGHIJ0123456' });
    expect(res.status).toBe(402);
    log.mockRestore();
  });
});

describe('newOrder', () => {
  const address = { firstName: 'A', lastName: 'B', phone: '1', email: 'a@b.co', street: 's', city: 'c', state: 'x', postal: '1', country: 'IL' };

  it('stores the price computed on the server, not the one sent', async () => {
    orderCreate.mockResolvedValue({ _id: 'abc' });
    const res = await request(app)
      .post('/order/newOrder')
      .send({ ...address, totalPrice: 0.01, products: [{ productID: OID1, productName: 'Olive oil', quantity: 2, color: '' }] });
    expect(res.status).toBe(201);
    expect(orderCreate.mock.calls[0][0].totalPrice).toBe(23);
    expect(sendMail).not.toHaveBeenCalled(); // not paid: saved, but no mail to a typed address (security review 06, finding 5)
  });

  it('still answers 422 when a field is missing', async () => {
    const res = await request(app).post('/order/newOrder').send({ ...address, city: '', products: [{ productID: OID1, quantity: 1 }] });
    expect(res.status).toBe(422);
  });
});
