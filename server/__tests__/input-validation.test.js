import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Untrusted input on the public routes: types, NoSQL operators, mass assignment, mail recipients.

const mocks = vi.hoisted(() => ({
  prayerFind: vi.fn(),
  prayerCount: vi.fn(),
  prayerLike: vi.fn(),
  prayerSaved: [],
  reviewSaved: [],
  candleSaved: [],
  contactSaved: [],
  sendMail: vi.fn(),
}));

// Minimal stand-ins for the Mongoose models: they record what the routes hand to them.
vi.mock('../model/prayer.js', () => {
  class Prayer {
    constructor(data) { Object.assign(this, data); }
    async save() { mocks.prayerSaved.push({ ...this }); return this; }
    static find(...a) { return mocks.prayerFind(...a); }
    static countDocuments(...a) { return mocks.prayerCount(...a); }
    static findByIdAndUpdate(...a) { return mocks.prayerLike(...a); }
  }
  return { default: Prayer, PRAYER_CATEGORIES: ['Peace'] };
});
vi.mock('../model/review.js', () => {
  class Review {
    constructor(data) { Object.assign(this, data); }
    async save() { mocks.reviewSaved.push({ ...this }); return this; }
    static find() { return { sort: () => ({ limit: () => ({ lean: async () => [] }) }) }; }
  }
  return { default: Review };
});
vi.mock('../model/candle.js', () => {
  class Candle {
    constructor(data) { Object.assign(this, data); }
    async save() { mocks.candleSaved.push({ ...this }); return this; }
  }
  return { default: Candle };
});
vi.mock('../model/contact.js', () => {
  class Contact {
    constructor(data) { Object.assign(this, data); }
    async save() { mocks.contactSaved.push({ ...this }); return this; }
  }
  return { default: Contact };
});
vi.mock('../services/emailService.js', () => ({ sendMail: (...a) => mocks.sendMail(...a), SENDER: {} }));

const { createApp } = await import('../app.js');
const app = createApp();

let ipCounter = 0;
const as = (req) => req.set('X-Forwarded-For', `10.3.0.${++ipCounter}`);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prayerSaved.length = 0;
  mocks.reviewSaved.length = 0;
  mocks.candleSaved.length = 0;
  mocks.contactSaved.length = 0;
  mocks.sendMail.mockResolvedValue(true);
  const chain = { sort: () => chain, limit: () => chain, skip: async () => [] };
  mocks.prayerFind.mockReturnValue(chain);
  mocks.prayerCount.mockResolvedValue(0);
});

describe('express-mongo-sanitize really protects body and query', () => {
  it('strips operators from the query string before a route sees them', async () => {
    await request(app).get('/prayer/getPrayers?category[$ne]=Peace&category[$where]=1');
    const filter = mocks.prayerFind.mock.calls[0][0];
    // The operator keys are gone: nothing starting with "$" can reach Mongo.
    expect(JSON.stringify(filter)).not.toContain('$');
    expect(typeof filter.category).not.toBe('object');
  });

  it('only filters by a category that is plain text', async () => {
    await request(app).get('/prayer/getPrayers?category=Peace');
    expect(mocks.prayerFind.mock.calls[0][0]).toEqual({ category: 'Peace' });
    await request(app).get('/prayer/getPrayers?category=All');
    expect(mocks.prayerFind.mock.calls[1][0]).toEqual({});
    await request(app).get('/prayer/getPrayers?category[]=Peace&category[]=Health');
    expect(mocks.prayerFind.mock.calls[2][0]).toEqual({});
  });

  it('strips operators and dotted keys from JSON bodies', async () => {
    const res = await as(request(app).post('/review/addReview')).send({
      fullName: 'Maria',
      msg: 'Beautiful',
      email: { $gt: '' },
      'a.b': 'x',
      $where: 'sleep(1000)',
    });
    expect(res.status).toBe(201);
    const saved = mocks.reviewSaved[0];
    expect(JSON.stringify(saved)).not.toContain('$');
    expect(saved).not.toHaveProperty('a.b');
  });

  it('turns operator objects into empty objects (so a "text" field never holds an operator)', async () => {
    const res = await as(request(app).post('/review/addReview')).send({ fullName: { $ne: null }, msg: 'Beautiful' });
    expect(res.status).toBe(400); // not text any more
    expect(mocks.reviewSaved).toHaveLength(0);
  });
});

describe('prayers', () => {
  it('keeps page and size to whole numbers within bounds', async () => {
    for (const q of ['page=-3&size=-5', 'page=abc&size=abc', 'page=1e9&size=99999', 'page[]=2&size[]=3', 'page=0&size=0']) {
      const chain = { sort: () => chain, limit: vi.fn(() => chain), skip: vi.fn(async () => []) };
      mocks.prayerFind.mockReturnValueOnce(chain);
      const res = await request(app).get(`/prayer/getPrayers?${q}`);
      expect(res.status, q).toBe(200);
      const limit = chain.limit.mock.calls[0][0];
      const skip = chain.skip.mock.calls[0][0];
      expect(limit, q).toBeGreaterThanOrEqual(1);
      expect(limit, q).toBeLessThanOrEqual(50);
      expect(skip, q).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(skip), q).toBe(true);
    }
  });

  it('takes only name, country, prayer and category from the body', async () => {
    const res = await as(request(app).post('/prayer/create')).send({
      name: 'Anna',
      country: 'PL',
      prayer: 'Peace for all',
      category: 'Peace',
      likes: 99999,
      createdAt: '1999-01-01',
      _id: '64b000000000000000000001',
      isAdmin: true,
    });
    expect(res.status).toBe(201);
    expect(Object.keys(mocks.prayerSaved[0]).sort()).toEqual(['category', 'country', 'name', 'prayer']);
  });

  it.each([[{ name: ['x'], prayer: 'p' }], [{ name: 'n', prayer: { a: 1 } }], [{ name: '  ', prayer: 'p' }], [{}], [null]])(
    'refuses a body that is not text (%j)',
    async (body) => {
      const res = await as(request(app).post('/prayer/create')).send(body ?? {});
      expect(res.status).toBe(400);
      expect(mocks.prayerSaved).toHaveLength(0);
    },
  );

  it('checks the id of a like before querying', async () => {
    expect((await as(request(app).post('/prayer/like/not-an-id'))).status).toBe(400);
    expect((await as(request(app).post('/prayer/like/abcdefghijkl'))).status).toBe(400); // 12 characters
    expect(mocks.prayerLike).not.toHaveBeenCalled();
    mocks.prayerLike.mockResolvedValueOnce({ likes: 5 });
    const ok = await as(request(app).post('/prayer/like/64b000000000000000000001'));
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ likes: 5 });
    expect(mocks.prayerLike.mock.calls[0][1]).toEqual({ $inc: { likes: 1 } }); // always exactly one
  });
});

describe('reviews', () => {
  it('can never publish itself differently from what the model decides (no "approved" from the body)', async () => {
    await as(request(app).post('/review/addReview')).send({ fullName: 'Maria', msg: 'Lovely place', approved: false, createdAt: '2001-01-01' });
    expect(Object.keys(mocks.reviewSaved[0]).sort()).toEqual(['email', 'fullName', 'msg', 'phone', 'place']);
  });

  it('strips markup from what visitors write', async () => {
    await as(request(app).post('/review/addReview')).send({ fullName: 'Maria<script>alert(1)</script>', msg: 'Nice <img src=x onerror=alert(1)> place' });
    const saved = mocks.reviewSaved[0];
    expect(saved.fullName).not.toMatch(/[<>]|script/i);
    expect(saved.msg).not.toMatch(/<|onerror/i);
  });
});

describe('mail recipients', () => {
  const candle = { firstName: 'A', lastName: 'B', prayer: 'For my family' };

  it.each([
    ['a list of addresses', 'a@b.co,victim@example.com'],
    ['a semicolon list', 'a@b.co;victim@example.com'],
    ['a display name', 'Boss <a@b.co>'],
    ['a quoted local part', '"a b"@b.co'],
    ['a line break', 'a@b.co\r\nBcc: x@y.zz'],
    ['a comment', 'a@b.co(victim@example.com)'],
    ['two @', 'a@b@c.co'],
    ['no dot in the domain', 'a@localhost'],
    ['an object', { $ne: null }],
    ['an array', ['a@b.co']],
  ])('the candle form refuses %s and sends nothing', async (_n, email) => {
    const res = await as(request(app).post('/candle/lightACandle')).send({ ...candle, email });
    expect(res.status).toBe(422);
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.candleSaved).toHaveLength(0);
  });

  it('an unpaid candle request with a valid address is saved, but mails nobody (payment-ledger.test.js has the paid case)', async () => {
    const res = await as(request(app).post('/candle/lightACandle')).send({ ...candle, email: ' maria.h+nhc@mail.example.co.il ' });
    expect(res.status).toBe(200);
    expect(mocks.candleSaved).toHaveLength(1);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it('the contact form uses the same strict check', async () => {
    const body = { fullName: 'Maria', phone: '1', msg: 'Hello there' };
    expect((await as(request(app).post('/contact/contact_us_request')).send({ ...body, email: 'a@b.co,x@y.zz' })).status).toBe(422);
    expect((await as(request(app).post('/contact/contact_us_request')).send({ ...body, email: 'a@b.co' })).status).toBe(201);
  });
});
