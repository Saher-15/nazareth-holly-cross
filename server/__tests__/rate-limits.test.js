import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// The payment and "like" endpoints are public and cost money or can be inflated, so each has its own cap.

const mocks = vi.hoisted(() => ({ productFind: vi.fn(), orderCreate: vi.fn(), prayerLike: vi.fn() }));

vi.mock('../model/product.js', () => ({
  default: { find: (...a) => ({ select: () => mocks.productFind(...a) }), countDocuments: vi.fn() },
}));
vi.mock('../model/order.js', () => ({ default: { create: (...a) => mocks.orderCreate(...a), exists: vi.fn() } }));
vi.mock('../model/prayer.js', () => ({
  default: { findByIdAndUpdate: (...a) => mocks.prayerLike(...a), find: vi.fn(), countDocuments: vi.fn() },
  PRAYER_CATEGORIES: [],
}));
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(async () => true), SENDER: {} }));

const { createApp } = await import('../app.js');
const app = createApp();

const OID1 = '64b000000000000000000001';
const address = { firstName: 'A', lastName: 'B', phone: '1', email: 'a@b.co', street: 's', city: 'c', state: 'x', postal: '1', country: 'IL' };

beforeEach(() => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/oauth2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok' }) };
    if (String(url).endsWith('/capture')) return { ok: true, status: 201, json: async () => ({ id: 'ABC', status: 'COMPLETED' }) };
    return { ok: true, status: 201, json: async () => ({ id: 'ORDER123456789012', status: 'CREATED' }) };
  });
  mocks.productFind.mockResolvedValue([{ _id: OID1, price: 10, name: 'Olive oil', stock: null }]);
  mocks.orderCreate.mockResolvedValue({ _id: 'abc' });
  mocks.prayerLike.mockResolvedValue({ likes: 1 });
});

// Sends requests from one client address until the limit answers 429; returns how many were served first.
async function servedBeforeLimit(send, ip, max = 60) {
  for (let i = 0; i < max; i += 1) {
    const res = await send().set('X-Forwarded-For', ip);
    if (res.status === 429) return { served: i, last: res };
  }
  return { served: max, last: null };
}

describe('per-IP limits (15 minutes)', () => {
  it('POST /order/create_order: 30 attempts', async () => {
    const { served, last } = await servedBeforeLimit(() => request(app).post('/order/create_order').send({ type: 'candle' }), '10.4.0.1');
    expect(served).toBe(30);
    expect(last.body.error).toMatch(/payment attempts/i);
    expect(last.headers['ratelimit-policy'] ?? last.headers['ratelimit']).toBeDefined();
  });

  it('POST /order/complete_order: 30 attempts', async () => {
    const { served } = await servedBeforeLimit(() => request(app).post('/order/complete_order').send({ order_id: 'ABCDEFGHIJ0123456' }), '10.4.0.2');
    expect(served).toBe(30);
  });

  it('create_order and complete_order share one budget (a script cannot use both to double its attempts)', async () => {
    const ip = '10.4.0.3';
    for (let i = 0; i < 15; i += 1) await request(app).post('/order/create_order').set('X-Forwarded-For', ip).send({ type: 'candle' });
    for (let i = 0; i < 15; i += 1) await request(app).post('/order/complete_order').set('X-Forwarded-For', ip).send({ order_id: 'ABCDEFGHIJ0123456' });
    const res = await request(app).post('/order/create_order').set('X-Forwarded-For', ip).send({ type: 'candle' });
    expect(res.status).toBe(429);
  });

  it('POST /order/newOrder: 10 orders', async () => {
    const send = () => request(app).post('/order/newOrder').send({ ...address, products: [{ productID: OID1, quantity: 1 }] });
    const { served } = await servedBeforeLimit(send, '10.4.0.4');
    expect(served).toBe(10);
  });

  it('POST /prayer/like/:id: 30 likes', async () => {
    const { served, last } = await servedBeforeLimit(() => request(app).post(`/prayer/like/${OID1}`), '10.4.0.5');
    expect(served).toBe(30);
    expect(last.body.error).toMatch(/likes/i);
  });

  it('the limits are per address: another visitor is not affected', async () => {
    const res = await request(app).post(`/prayer/like/${OID1}`).set('X-Forwarded-For', '10.4.0.99');
    expect(res.status).toBe(200);
  });

  it('a limited request does not reach PayPal', async () => {
    const ip = '10.4.0.6';
    await servedBeforeLimit(() => request(app).post('/order/create_order').send({ type: 'candle' }), ip);
    global.fetch.mockClear();
    const res = await request(app).post('/order/create_order').set('X-Forwarded-For', ip).send({ type: 'candle' });
    expect(res.status).toBe(429);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
