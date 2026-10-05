import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

const findOne = vi.fn();
vi.mock('../model/admin.js', () => ({ default: { findOne: (...a) => findOne(...a) } }));

const { createApp } = await import('../app.js');
const app = createApp();

// The login limiter allows 5 failed attempts per 15 minutes per address, so this file spends four.
describe('POST /admin/login', () => {
  it('answers 401, not 500, when the credentials are not strings, and never queries with them', async () => {
    for (const body of [{}, { username: 'a' }, { username: { $gt: '' }, password: 'x' }]) {
      const res = await request(app).post('/admin/login').send(body);
      expect(res.status, JSON.stringify(body)).toBe(401);
    }
    expect(findOne).not.toHaveBeenCalled();
  });

  it('keeps the login log line free of control characters from the username', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    findOne.mockResolvedValueOnce(null);
    await request(app).post('/admin/login').send({ username: 'a\nFAKE LOG LINE', password: 'x' });
    const line = String(warn.mock.calls[0][0]);
    expect(line).not.toContain('\n');
    expect(line).toContain('Failed admin/login attempt');
    warn.mockRestore();
  });
});
