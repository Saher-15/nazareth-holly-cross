import { describe, it, expect, vi, afterAll, beforeEach } from 'vitest';

// The dashboard API as it runs on Render: production mode, ADMIN_ORIGINS, headers, limits, error answers, logs.
process.env.NODE_ENV = 'production';
process.env.ADMIN_ORIGINS = 'https://admin.example.com/, https://ops.example.org';

vi.mock('../model/admin.js', async () => (await import('./helpers/fakes.js')).fakeAdminModule());
vi.mock('../model/adminSession.js', async () => (await import('./helpers/fakes.js')).fakeModule('AdminSession'));
vi.mock('../model/auditLog.js', async () => (await import('./helpers/fakes.js')).fakeModule('AuditLog'));
vi.mock('../model/order.js', async () => (await import('./helpers/fakes.js')).fakeModule('Order'));
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(async () => true), SENDER: {} }));

const { fakes } = await import('./helpers/fakes.js');
const { PASSWORD, freshIp, seedAdmin, signedIn, startClient } = await import('./helpers/admin.js');
const { config } = await import('../config/env.js');
const { createApp } = await import('../app.js');
const { signSessionToken } = await import('../services/adminSessions.js');

const { http, close } = startClient(createApp());
afterAll(close);

beforeEach(() => {
  fakes.Admin.reset();
  fakes.AdminSession.reset();
  fakes.AuditLog.reset();
  fakes.Order.reset();
});

describe('CORS for the admin dashboard (ADMIN_ORIGINS)', () => {
  it('reads exact origins from the comma list and drops a trailing slash', () => {
    expect(config.isProd).toBe(true);
    expect(config.adminOrigins).toEqual(['https://admin.example.com', 'https://ops.example.org']);
  });

  it.each(['https://admin.example.com', 'https://ops.example.org'])('answers the preflight for %s', async (origin) => {
    const res = await http.options('/admin/orders/64b000000000000000000001')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-methods']).toMatch(/PATCH/);
    expect(res.headers['access-control-allow-methods']).toMatch(/DELETE/);
    expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
  });

  it('serves a request from the admin origin with the CORS header', async () => {
    const res = await http.post('/admin/auth/login').set('Origin', 'https://admin.example.com').set('X-Forwarded-For', freshIp()).send({});
    expect(res.status).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBe('https://admin.example.com');
  });

  it.each([
    'https://admin.example.com.evil.com', 'https://evil-admin.example.com', 'http://admin.example.com', 'https://example.com',
    'https://sub.admin.example.com', 'http://localhost:3000', 'null',
  ])('refuses %s', async (origin) => {
    const res = await http.post('/admin/auth/login').set('Origin', origin).set('X-Forwarded-For', freshIp()).send({});
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('the existing sites are still allowed', async () => {
    const res = await http.get('/health').set('Origin', 'https://nazarethholycross.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://nazarethholycross.com');
  });
});

describe('headers and caching', () => {
  it('every admin answer, success or failure, is no-store with the API security headers', async () => {
    const a = await signedIn(signSessionToken);
    const answers = [
      await http.get('/admin/auth/me').set(a.auth).set('X-Forwarded-For', freshIp()),
      await http.get('/admin/orders').set('X-Forwarded-For', freshIp()), // 401
      await http.get('/admin/orders/not-an-id').set(a.auth).set('X-Forwarded-For', freshIp()), // 400
      await http.get('/admin/does-not-exist').set(a.auth).set('X-Forwarded-For', freshIp()), // 404
      await http.post('/admin/auth/login').set('X-Forwarded-For', freshIp()).send({}), // 401
    ];
    for (const res of answers) {
      expect(res.headers['cache-control'], String(res.status)).toBe('no-store');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['strict-transport-security']).toMatch(/max-age=63072000/);
      expect(res.headers['x-powered-by']).toBeUndefined();
    }
  });

  it('a CSV download is no-store and cannot be sniffed', async () => {
    const a = await signedIn(signSessionToken, { role: 'editor' });
    const res = await http.get('/admin/export/orders.csv').set(a.auth).set('X-Forwarded-For', freshIp());
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('request limits and bad input', () => {
  it('answers 413 JSON for a body over 10 KB, before anything is looked up', async () => {
    const res = await http.post('/admin/auth/login').set('X-Forwarded-For', freshIp()).send({ username: 'a', password: 'x'.repeat(20_000) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'Request body too large' });
    expect(fakes.Admin.calls).toHaveLength(0);
  });

  it('answers 400 JSON for malformed JSON', async () => {
    const res = await http.post('/admin/auth/login').set('Content-Type', 'application/json').set('X-Forwarded-For', freshIp()).send('{bad');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Malformed JSON body' });
  });

  it('treats a form-encoded or text body like an empty one', async () => {
    const form = await http.post('/admin/auth/login').type('form').set('X-Forwarded-For', freshIp()).send('username=a&password=b');
    expect(form.status).toBe(401);
    const text = await http.post('/admin/auth/login').set('Content-Type', 'text/plain').set('X-Forwarded-For', freshIp()).send('hello');
    expect(text.status).toBe(401);
  });

  it('never shows a stack trace or a database message, in production', async () => {
    const a = await signedIn(signSessionToken);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = fakes.Order.find;
    fakes.Order.find = () => { throw new Error('connect ECONNREFUSED 10.0.0.5:27017 at Object.<anonymous> (/srv/app.js:1:1)'); };
    const res = await http.get('/admin/orders').set(a.auth).set('X-Forwarded-For', freshIp());
    fakes.Order.find = original;
    log.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(res.text).not.toMatch(/ECONNREFUSED|stack|\.js:/);
  });

  it('answers a bad id as 400, not 500', async () => {
    const a = await signedIn(signSessionToken, { role: 'owner' });
    expect((await http.delete('/admin/users/zzz').set(a.auth).set('X-Forwarded-For', freshIp())).status).toBe(400);
  });
});

describe('rate limits', () => {
  it('a signed-in admin gets 300 requests per 15 minutes, counted per account, then 429', async () => {
    const a = await signedIn(signSessionToken, { role: 'viewer' });
    const b = await signedIn(signSessionToken, { role: 'viewer' });
    let first;
    for (let i = 0; i < 300; i += 1) {
      const res = await http.get('/admin/auth/me').set(a.auth).set('X-Forwarded-For', freshIp()); // a new address every time
      first ??= res;
      expect(res.status, `request ${i + 1}`).toBe(200);
    }
    expect(first.headers['ratelimit-policy'] ?? first.headers.ratelimit).toBeDefined();
    const blocked = await http.get('/admin/auth/me').set(a.auth).set('X-Forwarded-For', freshIp());
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many requests/);
    expect((await http.get('/admin/auth/me').set(b.auth).set('X-Forwarded-For', freshIp())).status).toBe(200); // another account
  });

  it('there is a per-address ceiling in front of everything (1000), separate from the 200 of the public routes', async () => {
    const admin = await http.get('/admin/auth/me').set('X-Forwarded-For', freshIp());
    const other = await http.get('/order/newOrder').set('X-Forwarded-For', freshIp()); // a public route that is not a read
    const limit = (res) => Number((res.headers.ratelimit ?? '').match(/limit=(\d+)/)?.[1] ?? (res.headers['ratelimit-policy'] ?? '').match(/^(\d+)/)?.[1]);
    expect(limit(admin)).toBe(1000);
    expect(limit(other)).toBe(200);
  });
});

describe('secrets stay out of the logs', () => {
  it('sign-in, failure, lockout and password change write no password, token or code to the console', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    seedAdmin({ username: 'logcheck' });
    const wrong = 'wrong-password-do-not-log';
    const ip = freshIp();
    for (let i = 0; i < 3; i += 1) await http.post('/admin/auth/login').set('X-Forwarded-For', ip).send({ username: 'logcheck', password: wrong });
    const ok = await http.post('/admin/auth/login').set('X-Forwarded-For', ip).send({ username: 'logcheck', password: PASSWORD });
    await http.post('/admin/auth/password').set('Authorization', `Bearer ${ok.body.token}`).set('X-Forwarded-For', freshIp())
      .send({ currentPassword: PASSWORD, newPassword: 'new password do not log' });
    await http.post('/admin/auth/totp/enable').set('Authorization', `Bearer ${ok.body.token}`).set('X-Forwarded-For', freshIp()).send({ code: '123456' });
    const logged = spies.flatMap((s) => s.mock.calls).flat().map(String).join('\n');
    spies.forEach((s) => s.mockRestore());
    for (const secret of [wrong, PASSWORD, 'new password do not log', ok.body.token, '123456']) expect(logged).not.toContain(secret);
  });
});
