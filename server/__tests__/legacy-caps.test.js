import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// The old "read the whole collection" routes keep their answer (a plain array) but are capped and newest first, so one
// oversized collection cannot exhaust the API's memory. docs/DATABASE.md, "growth".

vi.mock('../model/order.js', async () => (await import('./helpers/fakes.js')).fakeModule('Order'));
vi.mock('../model/candle.js', async () => (await import('./helpers/fakes.js')).fakeModule('Candle'));
vi.mock('../model/contact.js', async () => (await import('./helpers/fakes.js')).fakeModule('Contact'));
vi.mock('../model/product.js', async () => (await import('./helpers/fakes.js')).fakeModule('Product'));

const { fakes } = await import('./helpers/fakes.js');
const { createApp } = await import('../app.js');
const { LEGACY_LIST_CAP } = await import('../utils/pagination.js');
const app = createApp();

const token = () => jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
let n = 0;
const get = (path, auth = true) => {
  const req = request(app).get(path).set('X-Forwarded-For', `10.8.${Math.floor(++n / 250)}.${(n % 250) + 1}`);
  return auth ? req.set('Authorization', `Bearer ${token()}`) : req;
};
const stamped = (count, fields) => Array.from({ length: count }, (_, i) => ({ ...fields(i), createdAt: new Date(Date.UTC(2026, 0, 1) + i * 1000) }));

beforeEach(() => {
  for (const name of ['Order', 'Candle', 'Contact', 'Product']) fakes[name].reset();
});

describe('legacy list routes are capped', () => {
  const cases = [
    ['/order/getAllOrders', 'Order', (i) => ({ firstName: `n${i}`, lastName: 'x', email: 'a@b.co', totalPrice: 5, products: [] })],
    ['/candle/getAllCandleRequests', 'Candle', (i) => ({ firstName: `n${i}`, lastName: 'x', email: 'a@b.co', prayer: 'Peace' })],
    ['/contact/get_all_contact_us', 'Contact', (i) => ({ fullName: `n${i}`, email: 'a@b.co', msg: 'Hello' })],
    ['/product/getAllProducts', 'Product', (i) => ({ name: `n${i}`, price: 5, img: 'x' })],
  ];

  it.each(cases)('%s: a plain array, at most the cap, newest first, and says so when it was cut', async (path, model, make) => {
    fakes[model].seed(stamped(LEGACY_LIST_CAP + 3, make));
    const res = await get(path, path !== '/product/getAllProducts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(LEGACY_LIST_CAP);
    expect(res.headers['x-result-capped']).toBe(String(LEGACY_LIST_CAP));
    const first = res.body[0].firstName ?? res.body[0].fullName ?? res.body[0].name;
    expect(first).toBe(`n${LEGACY_LIST_CAP + 2}`); // the newest
  });

  it.each(cases)('%s: below the cap everything is returned and no header is added', async (path, model, make) => {
    fakes[model].seed(stamped(3, make));
    const res = await get(path, path !== '/product/getAllProducts');
    expect(res.body).toHaveLength(3);
    expect(res.headers['x-result-capped']).toBeUndefined();
  });

  it('the cap is a few thousand: more than any list the shop has, far below what could hurt', () => {
    expect(LEGACY_LIST_CAP).toBeGreaterThanOrEqual(1000);
    expect(LEGACY_LIST_CAP).toBeLessThanOrEqual(10_000);
  });
});
