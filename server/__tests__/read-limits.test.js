import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Public reads (catalogue, products, reviews, prayers) have their own large allowance and cache headers, so a
// website build or a CDN does not use up the strict per-IP limit that protects the rest of the API.

const mocks = vi.hoisted(() => ({ product: null }));

vi.mock('../model/product.js', () => {
  const chain = { sort: () => chain, limit: () => chain, skip: () => Promise.resolve([{ name: 'Olive oil' }]) };
  return {
    default: {
      find: vi.fn(() => Object.assign(Promise.resolve([{ name: 'Olive oil' }]), chain)),
      findById: vi.fn(async () => mocks.product),
      countDocuments: vi.fn(() => Promise.resolve(1)),
    },
  };
});
vi.mock('../model/review.js', () => ({
  default: { find: () => ({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) }) },
}));

const { createApp } = await import('../app.js');
const { publicReadCacheControl, READ_LIMIT } = await import('../utils/security.js');
const app = createApp();

const limitOf = (res) => Number(/limit=(\d+)/.exec(res.headers.ratelimit ?? '')?.[1]);

describe('public reads: cache headers', () => {
  it('the product list can be cached by a CDN and served stale while the API is down', async () => {
    const res = await request(app).get('/product/getNProducts').set('X-Forwarded-For', '10.5.0.1');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/\bpublic\b/);
    expect(res.headers['cache-control']).toMatch(/s-maxage=300/);
    expect(res.headers['cache-control']).toMatch(/stale-while-revalidate=\d+/);
    expect(res.headers['cache-control']).toMatch(/stale-if-error=\d+/);
  });

  it('visitor text (reviews) is cached for a shorter time', async () => {
    const res = await request(app).get('/review/getReviews').set('X-Forwarded-For', '10.5.0.2');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/s-maxage=60\b/);
  });

  it('a product that does not exist is never cached (it must appear as soon as it is added)', async () => {
    mocks.product = null;
    const res = await request(app).get('/product/getProduct/64b000000000000000000001').set('X-Forwarded-For', '10.5.0.3');
    expect(res.status).toBe(404);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('only GET and HEAD of the listed addresses are public reads', () => {
    const get = (path, method = 'GET') => publicReadCacheControl({ method, path });
    expect(get('/product/catalog')).toBeTruthy();
    expect(get('/product/bestSellers')).toBeTruthy();
    expect(get('/product/64b000000000000000000001/similar')).toBeTruthy();
    expect(get('/product/64b000000000000000000001/reviews')).toBeTruthy();
    expect(get('/prayer/getPrayers')).toBeTruthy();
    expect(get('/product/addProduct', 'POST')).toBeNull();
    expect(get('/product/deleteProduct/64b000000000000000000001', 'DELETE')).toBeNull();
    expect(get('/order/getAllOrders')).toBeNull();
    expect(get('/admin/anything')).toBeNull();
    expect(get('/review/addReview', 'POST')).toBeNull();
  });

  it('private and write routes carry no public cache header', async () => {
    const res = await request(app).get('/order/getAllOrders').set('X-Forwarded-For', '10.5.0.4');
    expect(res.status).toBe(401);
    expect(res.headers['cache-control'] ?? '').not.toMatch(/public/);
  });
});

describe('public reads: their own allowance', () => {
  it('uses the large read limit, and the other routes keep the strict 200', async () => {
    const read = await request(app).get('/product/getNProducts').set('X-Forwarded-For', '10.5.1.1');
    expect(READ_LIMIT).toBeGreaterThanOrEqual(1000);
    expect(limitOf(read)).toBe(READ_LIMIT);
    const other = await request(app).get('/order/getAllOrders').set('X-Forwarded-For', '10.5.1.1');
    expect(limitOf(other)).toBe(200);
  });

  it('300 reads from one address are all served (a build used to hit 429 after 200)', async () => {
    let limited = 0;
    for (let i = 0; i < 300; i += 1) {
      const res = await request(app).get('/product/getNProducts').set('X-Forwarded-For', '10.5.2.1');
      if (res.status === 429) limited += 1;
    }
    expect(limited).toBe(0);
  });

  it('reads do not use up the strict counter of the same address', async () => {
    const ip = '10.5.3.1';
    for (let i = 0; i < 50; i += 1) await request(app).get('/product/getNProducts').set('X-Forwarded-For', ip);
    const other = await request(app).get('/order/getAllOrders').set('X-Forwarded-For', ip);
    expect(other.headers.ratelimit).toMatch(/remaining=199\b/);
  });
});
