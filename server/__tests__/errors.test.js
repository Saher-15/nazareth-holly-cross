import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

const findById = vi.fn();
const find = vi.fn();
vi.mock('../model/product.js', () => ({
  default: { findById: (...a) => findById(...a), find: (...a) => find(...a), countDocuments: vi.fn() },
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

describe('health check is never rate limited', () => {
  it('answers 200 on the 300th request from one address, while other routes are limited', async () => {
    let last;
    for (let i = 0; i < 300; i += 1) last = await request(app).get('/health');
    expect(last.status).toBe(200);
    const other = await request(app).get('/anything-else');
    expect(other.status).toBe(429);
  });
});
