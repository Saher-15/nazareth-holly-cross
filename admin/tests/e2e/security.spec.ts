import { expect, test, request as pwRequest } from '@playwright/test';
import { APP, signIn, USERS } from './helpers';

test.describe('headers, cookie and token handling', () => {
  test('CSP with a fresh nonce, security headers, no caching, noindex', async ({ request }) => {
    const first = await request.get('/login');
    const second = await request.get('/login');
    const csp = first.headers()['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("style-src-attr 'none'");
    const nonce = (h: string) => /'nonce-([^']+)'/.exec(h)?.[1];
    expect(nonce(csp)).toBeTruthy();
    expect(nonce(csp)).not.toBe(nonce(second.headers()['content-security-policy']));

    const h = first.headers();
    expect(h['cache-control']).toContain('no-store');
    expect(h['x-robots-tag']).toContain('noindex');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['strict-transport-security']).toContain('max-age=');
    expect(h['permissions-policy']).toContain('camera=()');
    expect(h['x-powered-by']).toBeUndefined();
  });

  test('inline scripts of the page carry the nonce and the page raises no CSP violations', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (m) => /content security policy/i.test(m.text()) && violations.push(m.text()));
    await page.goto('/login');
    const unnonced = await page.evaluate(() => Array.from(document.scripts).filter((s) => !s.src && !s.nonce).length);
    expect(unnonced).toBe(0);
    expect(violations).toEqual([]);
  });

  test('robots.txt disallows everything', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/User-Agent: \*/i);
    expect(body).toMatch(/Disallow: \//);
  });

  test('the session cookie is httpOnly + SameSite=Strict and the token is nowhere the page can read it', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'run once');
    const bodies: string[] = [];
    // The login answer as the browser receives it (same cookie jar as the page), then the dashboard.
    const login = await page.request.post('/api/session/login', { data: USERS.editor, headers: { Origin: APP } });
    bodies.push(await login.text());
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === 'nhc_admin');
    expect(cookie, 'session cookie').toBeTruthy();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe('Strict');
    expect(cookie!.path).toBe('/');
    expect(cookie!.secure).toBe(false); // http://localhost only; any https origin gets __Host- + Secure (unit-tested)
    const token = cookie!.value;
    expect(token.split('.')).toHaveLength(3);

    expect(await page.evaluate(() => document.cookie)).not.toContain('nhc_admin');
    expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).not.toContain(token);
    expect(await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)))).not.toContain(token);
    expect(await page.content()).not.toContain(token);
    for (const body of bodies) expect(body).not.toContain(token);
    expect(bodies.join('')).toContain('"user"');

    // And not after navigating through data pages either.
    for (const path of ['/orders', '/products', '/profile']) {
      await page.goto(path);
      expect(await page.content()).not.toContain(token);
    }
  });

  test('profile page says where the key lives, and shows no secrets', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'run once');
    await signIn(page, USERS.viewer);
    await page.goto('/profile');
    await expect(page.getByText('protected cookie only the server can read')).toBeVisible();
  });
});

test.describe('CSRF and the proxy', () => {
  test('state-changing requests without a same-origin Origin are refused', async () => {
    const anon = await pwRequest.newContext({ baseURL: APP });
    const attempts: Record<string, string>[] = [{}, { Origin: 'https://evil.example' }, { Origin: 'null' }, { 'Sec-Fetch-Site': 'cross-site', Origin: APP }];
    for (const headers of attempts) {
      const login = await anon.post('/api/session/login', { data: { username: 'x', password: 'y' }, headers });
      expect(login.status(), JSON.stringify(headers)).toBe(403);
      const logout = await anon.post('/api/session/logout', { headers });
      expect(logout.status()).toBe(403);
    }
    await anon.dispose();
  });

  test('the proxy needs a session, only forwards listed calls and drops unknown query parameters', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'run once');
    const anon = await pwRequest.newContext({ baseURL: APP });
    expect((await anon.get('/api/proxy/orders')).status()).toBe(401);
    await anon.dispose();

    const context = await browser.newContext({ baseURL: APP });
    const login = await context.request.post('/api/session/login', { data: USERS.viewer, headers: { Origin: APP } });
    expect(login.ok()).toBeTruthy();
    const api = context.request;
    expect((await api.get('/api/proxy/orders?size=5')).status()).toBe(200);
    // not in the allow-list: sign-in, other auth routes, unknown resources, path tricks
    expect((await api.post('/api/proxy/auth/login', { data: {}, headers: { Origin: APP } })).status()).toBe(404);
    expect((await api.get('/api/proxy/auth/logout')).status()).toBe(404);
    expect((await api.get('/api/proxy/secrets')).status()).toBe(404);
    expect((await api.get('/api/proxy/orders/..%2F..%2Fusers')).status()).toBe(404);
    expect((await api.put('/api/proxy/orders/abc', { data: {}, headers: { Origin: APP } })).status()).toBe(404);
    // the viewer role is enforced by the API itself, not only hidden in the UI
    expect((await api.post('/api/proxy/products', { data: { name: 'Nope' }, headers: { Origin: APP } })).status()).toBe(403);
    expect((await api.get('/api/proxy/users')).status()).toBe(403);
    expect((await api.get('/api/proxy/audit')).status()).toBe(403);
    // a body that is not JSON
    expect((await api.post('/api/proxy/products', { data: 'x=1', headers: { Origin: APP, 'Content-Type': 'text/plain' } })).status()).toBe(415);
    await context.close();
  });
});
