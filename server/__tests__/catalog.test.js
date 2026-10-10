import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const ID = {
  oil: '64b000000000000000000001',
  rosaryGold: '64b000000000000000000002',
  rosaryWood: '64b000000000000000000003',
  necklace: '64b000000000000000000004',
  glassCross: '64b000000000000000000005',
};
const PRODUCTS = [
  { _id: ID.oil, name: 'Olive oil', price: 10, img: 'a', rate: 12 },
  { _id: ID.rosaryGold, name: 'Golden rosary', price: 15, img: 'b', rate: 1 },
  { _id: ID.rosaryWood, name: 'Wood rosary', price: 7, img: 'c', rate: 1 },
  { _id: ID.necklace, name: 'Golden necklace with cross', price: 15, img: 'd', rate: 1 },
  { _id: ID.glassCross, name: 'Red vitrage glass cross with stand', price: 65, img: 'e', rate: 1 },
];

const orderAggregate = vi.fn();
const reviewAggregate = vi.fn();
const reviewFind = vi.fn();
const reviewCount = vi.fn();
const reviewCreate = vi.fn();

vi.mock('../model/product.js', () => ({
  default: { find: () => { const chain = { select: () => chain, lean: async () => PRODUCTS.map((p) => ({ ...p })) }; return chain; } },
}));
vi.mock('../model/order.js', () => ({ default: { aggregate: (...a) => orderAggregate(...a) } }));
vi.mock('../model/productReview.js', () => ({
  default: {
    aggregate: (...a) => reviewAggregate(...a),
    find: (...a) => {
      const chain = { sort: () => chain, limit: () => chain, select: () => chain, lean: async () => reviewFind(...a) };
      return chain;
    },
    create: (...a) => reviewCreate(...a),
    countDocuments: (...a) => reviewCount(...a),
  },
}));

const { createApp } = await import('../app.js');
const { categorize, materialsOf, invalidateCatalog } = await import('../services/catalog.js');
const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
  invalidateCatalog();
  orderAggregate.mockResolvedValue([
    { _id: ID.rosaryWood, sold: 9 },
    { _id: ID.necklace, sold: 4 },
  ]);
  reviewAggregate.mockResolvedValue([{ _id: ID.necklace, avg: 4.666, count: 3 }]);
  reviewFind.mockResolvedValue([]);
  reviewCount.mockResolvedValue(0);
});

describe('categorize / materialsOf', () => {
  it.each([
    ['Bracelet with silver cross', 'bracelets'],
    ['Wood rosary with silver cross', 'rosaries'],
    ['Golden necklace with cross', 'necklaces'],
    ['Yellow vitrage glass cross with stand', 'stained-glass'],
    ['Decorated vitrage glass fish', 'stained-glass'],
    ['Blue cross with stand', 'crosses'],
    ['Silver mini bible with a frame', 'bibles'],
    ['cana red wine', 'holy-land'],
    ['Set of water, olive, soil and incense of Nazareth', 'holy-land'],
    ['Nazareth city puzzle', 'holy-land'],
  ])('%s -> %s', (name, category) => {
    expect(categorize({ name })).toBe(category);
  });

  it('prefers a category stored on the product', () => {
    expect(categorize({ name: 'Golden rosary', category: 'gifts' })).toBe('gifts');
  });

  it('reads materials from the name', () => {
    expect(materialsOf({ name: 'Golden necklace with silver cross' })).toEqual(['gold', 'silver']);
    expect(materialsOf({ name: 'Chrystalic rosary' })).toEqual(['glass']);
  });
});

describe('GET /product/catalog', () => {
  it('enriches every product with category, materials, sales and rating', async () => {
    const res = await request(app).get('/product/catalog');
    expect(res.status).toBe(200);
    const necklace = res.body.products.find((p) => p._id === ID.necklace);
    expect(necklace).toMatchObject({ category: 'necklaces', materials: ['gold'], sold: 4, rating: { avg: 4.7, count: 3 } });
    expect(res.body.categories).toContainEqual({ key: 'rosaries', count: 2 });
  });

  it('caches the catalog between calls', async () => {
    await request(app).get('/product/catalog');
    await request(app).get('/product/catalog');
    expect(orderAggregate).toHaveBeenCalledTimes(1);
  });
});

describe('GET /product/bestSellers', () => {
  it('ranks by units sold, then reviews, then the featuring weight', async () => {
    const res = await request(app).get('/product/bestSellers?limit=3');
    expect(res.body.map((p) => p._id)).toEqual([ID.rosaryWood, ID.necklace, ID.oil]);
  });

  it('caps the limit', async () => {
    const res = await request(app).get('/product/bestSellers?limit=999');
    expect(res.body.length).toBeLessThanOrEqual(24);
  });
});

describe('GET /product/:id/similar', () => {
  it('suggests the same category first and never the product itself', async () => {
    const res = await request(app).get(`/product/${ID.rosaryGold}/similar?limit=2`);
    expect(res.status).toBe(200);
    expect(res.body[0]._id).toBe(ID.rosaryWood);
    expect(res.body.map((p) => p._id)).not.toContain(ID.rosaryGold);
  });

  it('answers 404 for an unknown product and 400 for a malformed id', async () => {
    expect((await request(app).get('/product/64b0000000000000000000ff/similar')).status).toBe(404);
    expect((await request(app).get('/product/nope/similar')).status).toBe(400);
  });
});

describe('product reviews', () => {
  it('lists approved reviews with a rating summary', async () => {
    reviewFind.mockResolvedValue([
      { name: 'A', rating: 5, comment: 'Beautiful' },
      { name: 'B', rating: 4, comment: 'Nice' },
    ]);
    // The bars count ALL approved reviews (audit 2026-10-10, F07), not only the newest 50 in the list.
    reviewCount.mockImplementation(async ({ rating, approved }) => (approved === true ? { 5: 40, 4: 20, 1: 3 }[rating] ?? 0 : 0));
    const res = await request(app).get(`/product/${ID.necklace}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ avg: 4.7, count: 3, distribution: { 5: 40, 4: 20, 3: 0, 2: 0, 1: 3 } });
    expect(res.body.reviews).toHaveLength(2);
    expect(reviewCount).toHaveBeenCalledTimes(5);
  });

  it('stores a valid review and refreshes the catalog', async () => {
    reviewCreate.mockImplementation(async (doc) => ({ _id: 'r1', createdAt: '2026-10-05', ...doc }));
    const res = await request(app)
      .post(`/product/${ID.oil}/reviews`)
      .send({ name: 'Maria', country: 'Italy', rating: 5, title: 'Blessed', comment: 'Arrived quickly.' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Maria', rating: 5 });
    expect(res.body.ipHash).toBeUndefined();
    expect(reviewCreate.mock.calls[0][0].ipHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    [{ name: 'M', rating: 5, comment: 'ok ok' }, 'name'],
    [{ name: 'Maria', rating: 6, comment: 'ok ok' }, 'rating'],
    [{ name: 'Maria', rating: 4.5, comment: 'ok ok' }, 'rating'],
    [{ name: 'Maria', rating: 5, comment: '' }, 'comment'],
  ])('rejects %o (%s)', async (body, field) => {
    const res = await request(app).post(`/product/${ID.oil}/reviews`).send(body);
    expect(res.status).toBe(422);
    expect(res.body.error).toContain(field);
    expect(reviewCreate).not.toHaveBeenCalled();
  });

  it('silently drops bots that fill the honeypot', async () => {
    const res = await request(app)
      .post(`/product/${ID.oil}/reviews`)
      .send({ name: 'Bot', rating: 5, comment: 'spam spam', website: 'http://spam' });
    expect(res.status).toBe(201);
    expect(reviewCreate).not.toHaveBeenCalled();
  });
});
