import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Product queries are mocked so no database is needed.
vi.mock('../model/product.js', () => {
  const chain = { sort: () => chain, limit: () => chain, skip: () => chain, lean: () => Promise.resolve([{ name: 'Olive oil' }]) };
  return {
    default: {
      find: vi.fn(() => chain),
      countDocuments: vi.fn(() => Promise.resolve(1)),
    },
  };
});

const { createApp } = await import('../app.js');
const app = createApp();

describe('health', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('requireAdmin', () => {
  it('rejects a missing token', async () => {
    const res = await request(app).get('/order/getAllOrders');
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with another secret', async () => {
    const token = jwt.sign({ role: 'admin' }, 'wrong-secret');
    const res = await request(app).get('/order/getAllOrders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(app).get('/order/getAllOrders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('products', () => {
  it('GET /product/getNProducts caps the page size at 100', async () => {
    const res = await request(app).get('/product/getNProducts?page=1&size=5000');
    expect(res.status).toBe(200);
    expect(res.body.size).toBe(100);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /product/getNProducts defaults page and size', async () => {
    const res = await request(app).get('/product/getNProducts');
    expect(res.body.page).toBe(1);
    expect(res.body.size).toBe(10);
  });
});

describe('validation (current behaviour, pinned before refactoring)', () => {
  it('contact request without a valid email returns 422', async () => {
    const res = await request(app)
      .post('/contact/contact_us_request')
      .send({ fullName: 'A', email: 'Israel', phone: '1', msg: 'hi' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/email/i);
  });

  it('contact request without a name returns 422', async () => {
    const res = await request(app)
      .post('/contact/contact_us_request')
      .send({ email: 'a@b.co', phone: '1', msg: 'hi' });
    expect(res.status).toBe(422);
  });

  it('review without a message returns 400', async () => {
    const res = await request(app).post('/review/addReview').send({ fullName: 'Test' });
    expect(res.status).toBe(400);
  });

  it('review that is too short fails model validation with 400', async () => {
    const res = await request(app).post('/review/addReview').send({ fullName: 'x', msg: 'ab' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too short/i);
  });

  it('prayer without a name or text returns 400', async () => {
    const res = await request(app).post('/prayer/create').send({});
    expect(res.status).toBe(400);
  });
});

describe('PayPal order creation', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('rejects a non-positive amount', async () => {
    const res = await request(app).post('/order/create_order').send({ amount: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid amount');
  });

  it('rejects a non-numeric amount', async () => {
    const res = await request(app).post('/order/create_order').send({ amount: 'abc' });
    expect(res.status).toBe(400);
  });
});
