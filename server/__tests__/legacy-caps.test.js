import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// The old "read the whole collection" route that is left (GET /product/getAllProducts, public) keeps its answer (a plain
// array) but is capped and newest first, so one oversized collection cannot exhaust the API's memory. docs/DATABASE.md,
// "growth". (The private ones, /order/getAllOrders, /candle/getAllCandleRequests and /contact/get_all_contact_us, were
// removed with the legacy admin sign-in on 2026-10-07: the dashboard's paginated /admin/* lists replace them.)

vi.mock('../model/product.js', async () => (await import('./helpers/fakes.js')).fakeModule('Product'));

const { fakes } = await import('./helpers/fakes.js');
const { createApp } = await import('../app.js');
const { LEGACY_LIST_CAP } = await import('../utils/pagination.js');
const app = createApp();

let n = 0;
const get = (path) => request(app).get(path).set('X-Forwarded-For', `10.8.${Math.floor(++n / 250)}.${(n % 250) + 1}`);
const stamped = (count, fields) => Array.from({ length: count }, (_, i) => ({ ...fields(i), createdAt: new Date(Date.UTC(2026, 0, 1) + i * 1000) }));

beforeEach(() => {
  fakes.Product.reset();
});

describe('legacy list routes are capped', () => {
  const cases = [
    ['/product/getAllProducts', 'Product', (i) => ({ name: `n${i}`, price: 5, img: 'x' })],
  ];

  it.each(cases)('%s: a plain array, at most the cap, newest first, and says so when it was cut', async (path, model, make) => {
    fakes[model].seed(stamped(LEGACY_LIST_CAP + 3, make));
    const res = await get(path);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(LEGACY_LIST_CAP);
    expect(res.headers['x-result-capped']).toBe(String(LEGACY_LIST_CAP));
    const first = res.body[0].name;
    expect(first).toBe(`n${LEGACY_LIST_CAP + 2}`); // the newest
  });

  it.each(cases)('%s: below the cap everything is returned and no header is added', async (path, model, make) => {
    fakes[model].seed(stamped(3, make));
    const res = await get(path);
    expect(res.body).toHaveLength(3);
    expect(res.headers['x-result-capped']).toBeUndefined();
  });

  it('the cap is a few thousand: more than any list the shop has, far below what could hurt', () => {
    expect(LEGACY_LIST_CAP).toBeGreaterThanOrEqual(1000);
    expect(LEGACY_LIST_CAP).toBeLessThanOrEqual(10_000);
  });
});
