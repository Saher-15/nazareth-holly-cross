import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

const findById = vi.fn();
// What a Product query ends up resolving to; the chain is what the routes call (sort, limit, skip, lean).
const find = vi.fn();
const query = () => { const chain = { sort: () => chain, limit: () => chain, skip: () => chain, select: () => chain, lean: () => find() }; return chain; };
vi.mock('../model/product.js', () => ({
  default: { findById: (...a) => findById(...a), find: () => query(), countDocuments: vi.fn() },
}));

const { createApp } = await import('../app.js');
const app = createApp();

describe('central error handling', () => {
  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('maps a Mongoose CastError (bad id) to 400', async () => {
    findById.mockRejectedValueOnce(Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' }));
    const res = await request(app).get('/product/getProduct/not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid id');
  });

  it('answers 500 and logs when a handler throws unexpectedly', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    find.mockRejectedValueOnce(new Error('db exploded'));
    const res = await request(app).get('/product/getAllProducts');
    expect(res.status).toBe(500);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('answers 400 for malformed JSON', async () => {
    const res = await request(app).post('/review/addReview').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });

  it('keeps the unknown product at 404', async () => {
    findById.mockResolvedValueOnce(null);
    const res = await request(app).get('/product/getProduct/64b000000000000000000000');
    expect(res.status).toBe(404);
  });
});
