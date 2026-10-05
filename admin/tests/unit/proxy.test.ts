import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from '@/proxy';

// The request gate (src/proxy.ts): CSRF, sign-in redirect, CSP, no-store, noindex.

function jwt(exp: number): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256' })}.${enc({ sub: 'u', exp })}.sig`;
}
const LIVE = jwt(Math.floor(Date.now() / 1000) + 3600);
const DEAD = jwt(Math.floor(Date.now() / 1000) - 3600);

function req(path: string, init: { method?: string; headers?: Record<string, string>; cookie?: string } = {}) {
  const headers = new Headers({ host: 'localhost:3901', ...init.headers });
  if (init.cookie) headers.set('cookie', init.cookie);
  return new NextRequest(`http://localhost:3901${path}`, { method: init.method ?? 'GET', headers });
}

describe('proxy.ts', () => {
  it('sends a signed-out visitor to /login and remembers where they were going', () => {
    const res = proxy(req('/orders?status=pending'));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/orders?status=pending');
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('answers 401 JSON (not a redirect) to an API call without a session', async () => {
    const res = proxy(req('/api/proxy/orders'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('treats an expired token like no token', () => {
    expect(proxy(req('/', { cookie: `nhc_admin=${DEAD}` })).status).toBe(307);
  });

  it('lets a signed-in visitor through with a nonce CSP, no-store and noindex', () => {
    const res = proxy(req('/orders', { cookie: `nhc_admin=${LIVE}` }));
    expect(res.status).toBe(200);
    const csp = res.headers.get('content-security-policy')!;
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).not.toContain('upgrade-insecure-requests'); // plain-http localhost
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
  });

  it('uses a different nonce on every request', () => {
    const nonce = () => /'nonce-([^']+)'/.exec(proxy(req('/login')).headers.get('content-security-policy')!)![1];
    expect(nonce()).not.toBe(nonce());
  });

  it('keeps the login page and session routes public, and bounces a signed-in visitor off /login', () => {
    expect(proxy(req('/login')).status).toBe(200);
    expect(proxy(req('/robots.txt')).status).toBe(200);
    expect(proxy(req('/api/session/expire')).status).toBe(200);
    const res = proxy(req('/login', { cookie: `nhc_admin=${LIVE}` }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/');
  });

  it('refuses a cross-site state-changing request before anything else', async () => {
    const attempts: Record<string, string>[] = [{ origin: 'https://evil.example' }, {}, { 'sec-fetch-site': 'cross-site' }];
    for (const headers of attempts) {
      const res = proxy(req('/api/proxy/orders/abc', { method: 'PATCH', headers, cookie: `nhc_admin=${LIVE}` }));
      expect(res.status, JSON.stringify(headers)).toBe(403);
    }
    const ok = proxy(req('/api/proxy/orders/abc', { method: 'PATCH', headers: { origin: 'http://localhost:3901' }, cookie: `nhc_admin=${LIVE}` }));
    expect(ok.status).toBe(200);
  });
});
