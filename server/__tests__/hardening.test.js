import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

const prayerFind = vi.fn();

vi.mock('../model/prayer.js', () => ({
  default: {
    find: (...a) => prayerFind(...a),
    countDocuments: vi.fn(async () => 0),
  },
}));
vi.mock('../model/order.js', () => ({ default: { create: vi.fn() } }));
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(async () => true), SENDER: {} }));

const { createApp } = await import('../app.js');
const app = createApp();

describe('POST /auth/login (the removed shared-password sign-in)', () => {
  it('answers 404 to every body, the right old password included, and issues no token', async () => {
    for (const password of ['test-admin-password', 'nope', undefined, { $ne: 'x' }, ['a']]) {
      const res = await request(app).post('/auth/login').send({ password });
      expect(res.status, JSON.stringify(password)).toBe(404);
      expect(res.body.token).toBeUndefined();
    }
  });
});

describe('GET /prayer/getPrayers', () => {
  it('never asks the database for a zero or negative page size', async () => {
    const limit = vi.fn(() => ({ skip: () => Promise.resolve([]) }));
    prayerFind.mockReturnValue({ sort: () => ({ limit }) });
    for (const size of ['-5', '0', 'abc']) {
      limit.mockClear();
      const res = await request(app).get(`/prayer/getPrayers?size=${size}`);
      expect(res.status, size).toBe(200);
      expect(limit.mock.calls[0][0], size).toBeGreaterThanOrEqual(1);
    }
    limit.mockClear();
    await request(app).get('/prayer/getPrayers?size=500');
    expect(limit.mock.calls[0][0]).toBe(50);
  });
});

describe('GET /health', () => {
  it('stays 200 and says whether the database is connected', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'down' }); // no database in tests
  });
});

describe('order endpoints are rate limited', () => {
  it('stops the 21st order within an hour from one address', async () => {
    let last;
    for (let i = 0; i < 21; i += 1) last = await request(app).post('/order/newOrder').send({});
    expect(last.status).toBe(429);
  });
});
