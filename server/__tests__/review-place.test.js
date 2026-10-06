import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Where a reviewer is from. It used to travel in the review's `email` field; since the model checks that `email` is an
// address (2026-10-06), a review with a country in it was refused. It now has its own `place` field, older clients
// that still send it in `email` keep working, and the public list never shows an e-mail address or phone number.

const RealReview = (await vi.importActual('../model/review.js')).default;
vi.mock('../model/review.js', async () => (await import('./helpers/fakes.js')).fakeModule('Review'));

const { fakes } = await import('./helpers/fakes.js');
const { freshIp, startClient } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { placeOf } = await import('../route/reviewRoute.js');

const { http, close } = startClient(createApp());
afterAll(close);
beforeEach(() => fakes.Review.reset());

const add = (body) => http.post('/review/addReview').set('X-Forwarded-For', freshIp()).send(body);

describe('the review model', () => {
  it('accepts a country in place (and still checks a real e-mail address)', () => {
    expect(new RealReview({ fullName: 'Anna', place: 'Italy', msg: 'Beautiful place' }).validateSync()).toBeUndefined();
    expect(new RealReview({ fullName: 'Anna', email: 'Italy', msg: 'Beautiful place' }).validateSync()?.errors.email).toBeTruthy();
  });
});

describe('POST /review/addReview', () => {
  it('stores place from the new field', async () => {
    const res = await add({ fullName: 'Anna', place: 'Italy', msg: 'Beautiful place' });
    expect(res.status).toBe(201);
    expect(fakes.Review.docs[0]).toMatchObject({ place: 'Italy', email: '' });
    expect(res.body).toMatchObject({ fullName: 'Anna', place: 'Italy' });
  });

  it('moves a place sent in email (clients built before the field) into place', async () => {
    expect((await add({ fullName: 'Anna', email: 'Italy', msg: 'Beautiful place' })).status).toBe(201);
    expect(fakes.Review.docs[0]).toMatchObject({ place: 'Italy', email: '' });
  });

  it('keeps a real e-mail address as an e-mail address', async () => {
    await add({ fullName: 'Anna', email: 'anna@example.com', place: 'Italy', msg: 'Beautiful place' });
    expect(fakes.Review.docs[0]).toMatchObject({ place: 'Italy', email: 'anna@example.com' });
  });
});

describe('GET /review/getReviews', () => {
  it('shows the place, old or new, and never an e-mail address or a phone number', async () => {
    fakes.Review.seed([
      { fullName: 'Old', email: 'Germany', msg: 'Wonderful', approved: true, createdAt: new Date() },
      { fullName: 'New', place: 'Italy', email: '', msg: 'Wonderful', approved: true, createdAt: new Date() },
      { fullName: 'Mail', email: 'private@example.com', phone: '+972 50 000 0000', msg: 'Wonderful', approved: true, createdAt: new Date() },
    ]);
    const res = await http.get('/review/getReviews').set('X-Forwarded-For', freshIp());
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.map((r) => [r.fullName, r]));
    expect(byName.Old).toMatchObject({ place: 'Germany', email: 'Germany' });
    expect(byName.New).toMatchObject({ place: 'Italy', email: 'Italy' });
    expect(byName.Mail).toMatchObject({ place: '', email: '' });
    expect(JSON.stringify(res.body)).not.toContain('private@example.com');
    expect(JSON.stringify(res.body)).not.toContain('+972');
  });

  it('placeOf prefers place, else a non-address email', () => {
    expect(placeOf({ place: ' Italy ', email: 'x@y.com' })).toBe('Italy');
    expect(placeOf({ email: 'France' })).toBe('France');
    expect(placeOf({ email: 'a@b.co' })).toBe('');
    expect(placeOf({})).toBe('');
  });
});
