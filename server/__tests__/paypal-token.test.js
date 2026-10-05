import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../model/product.js', () => ({ default: { find: vi.fn(), countDocuments: vi.fn() } }));

const { createApp } = await import('../app.js');
const { clearAccessTokenCache } = await import('../services/paypalService.js');
const app = createApp();

const tokenCalls = () => global.fetch.mock.calls.filter(([url]) => String(url).includes('/oauth2/token')).length;

function mockPayPal({ expiresIn } = {}) {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/oauth2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: expiresIn }) };
    }
    return { ok: true, status: 201, json: async () => ({ id: 'ORDER123456789012', status: 'CREATED' }) };
  });
}

beforeEach(() => clearAccessTokenCache());

describe('PayPal access token', () => {
  it('is reused between checkouts while it is valid', async () => {
    mockPayPal({ expiresIn: 32400 });
    await request(app).post('/order/create_order').send({ type: 'candle' });
    await request(app).post('/order/create_order').send({ type: 'candle' });
    expect(tokenCalls()).toBe(1);
  });

  it('is asked for again when PayPal does not say how long it lasts', async () => {
    mockPayPal();
    await request(app).post('/order/create_order').send({ type: 'candle' });
    await request(app).post('/order/create_order').send({ type: 'candle' });
    expect(tokenCalls()).toBe(2);
  });

  it('is asked for again once it has expired', async () => {
    mockPayPal({ expiresIn: 32400 });
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    await request(app).post('/order/create_order').send({ type: 'candle' });
    now.mockReturnValue(1_000_000 + 32400 * 1000);
    await request(app).post('/order/create_order').send({ type: 'candle' });
    now.mockRestore();
    expect(tokenCalls()).toBe(2);
  });

  it('never makes the checkout wait for PayPal for ever: every call carries a timeout', async () => {
    mockPayPal({ expiresIn: 32400 });
    await request(app).post('/order/create_order').send({ type: 'candle' });
    for (const [, init] of global.fetch.mock.calls) expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
