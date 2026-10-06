import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// The server as it runs on Render (NODE_ENV=production): CORS, error answers, headers. The setup file
// sets NODE_ENV=test; config/env.js reads it once on import, so it is switched before anything is loaded.
process.env.NODE_ENV = 'production';

const mocks = vi.hoisted(() => ({ productFind: vi.fn(), productFindById: vi.fn() }));
const query = () => { const chain = { sort: () => chain, limit: () => chain, skip: () => chain, select: () => chain, lean: () => mocks.productFind() }; return chain; };
vi.mock('../model/product.js', () => ({
  default: {
    find: () => query(),
    findById: (...a) => mocks.productFindById(...a),
    countDocuments: vi.fn(),
  },
}));
vi.mock('../model/order.js', () => ({ default: { create: vi.fn(), exists: vi.fn() } }));

const { createApp } = await import('../app.js');
const { config } = await import('../config/env.js');
const app = createApp();

describe('production mode', () => {
  it('is really production', () => {
    expect(config.isProd).toBe(true);
  });

  describe('CORS', () => {
    const origin = (o) => request(app).get('/health').set('Origin', o);

    it.each(['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3601'])(
      'does not trust %s with the live API',
      async (o) => {
        const res = await origin(o);
        expect(res.status).toBe(403);
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
      },
    );

    it('still serves the real sites', async () => {
      for (const o of ['https://nazarethholycross.com', 'https://www.nazarethholycross.com', 'https://nazaretholycrossadmin.netlify.app']) {
        const res = await origin(o);
        expect(res.status).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBe(o);
      }
    });

    it('answers a preflight for the real site and lets the browser cache it', async () => {
      const res = await request(app)
        .options('/order/create_order')
        .set('Origin', 'https://nazarethholycross.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,authorization');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-max-age']).toBe('600');
      expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
    });
  });

  describe('errors do not leak', () => {
    it('hides the reason of a server error and its stack', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      mocks.productFind.mockRejectedValueOnce(new Error('connect ECONNREFUSED mongodb+srv://user:secret@cluster0.example.net'));
      const res = await request(app).get('/product/getAllProducts');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
      expect(JSON.stringify(res.body)).not.toMatch(/mongodb|secret|ECONNREFUSED/);
      expect(res.text).not.toMatch(/\bat\s.+\(.+:\d+:\d+\)/); // no stack trace
      // ...but it is logged for us, without the stack in production.
      expect(log).toHaveBeenCalled();
      log.mockRestore();
    });

    it('hides PayPal details behind a 502', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ name: 'INVALID_CLIENT', message: 'Client Authentication failed' }) }));
      const res = await request(app).post('/order/create_order').set('X-Forwarded-For', '10.5.0.1').send({ type: 'candle' });
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: 'Internal server error' });
      log.mockRestore();
    });

    it('answers a bad id with a short, fixed message', async () => {
      mocks.productFindById.mockRejectedValueOnce(Object.assign(new Error('Cast to ObjectId failed for value "x" (type string) at path "_id" for model "Product"'), { name: 'CastError' }));
      const res = await request(app).get('/product/getProduct/x');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid id' });
    });

    it('does not reveal route internals for unknown paths or methods', async () => {
      const res = await request(app).get('/.env');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
      expect((await request(app).put('/health')).status).toBe(404);
    });
  });

  describe('headers', () => {
    it('sends the hardening headers on every answer', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['strict-transport-security']).toMatch(/max-age=63072000; includeSubDomains; preload/);
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('answers JSON with a JSON content type (so nothing is sniffed as HTML)', async () => {
      const res = await request(app).get('/nope');
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('request limits', () => {
    it('refuses a body above 10 KB', async () => {
      const res = await request(app).post('/review/addReview').set('X-Forwarded-For', '10.5.0.2').send({ fullName: 'A', msg: 'x'.repeat(20_000) });
      expect(res.status).toBe(413);
      expect(res.body).toEqual({ error: 'Request body too large' });
    });

    it('refuses malformed JSON without echoing it', async () => {
      const res = await request(app).post('/review/addReview').set('X-Forwarded-For', '10.5.0.3').set('Content-Type', 'application/json').send('{"fullName":');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Malformed JSON body' });
    });
  });
});
