import { describe, expect, it } from 'vitest';
import { buildCsp, generateNonce, isLocalHost, originOf } from '@/lib/csp';

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.split(' ')
    .slice(1) ?? [];

describe('generateNonce', () => {
  it('is base64, 128 bits, and different every time', () => {
    const nonces = new Set(Array.from({ length: 50 }, generateNonce));
    expect(nonces.size).toBe(50);
    for (const n of nonces) {
      expect(n).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    }
  });
});

describe('buildCsp (production)', () => {
  const csp = buildCsp({ nonce: 'abc123', apiOrigin: 'https://api.example.com' });

  it('allows scripts only by nonce (strict-dynamic), never inline or eval', () => {
    const script = directive(csp, 'script-src');
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it('allows style elements only by nonce; style attributes are allowed separately', () => {
    expect(directive(csp, 'style-src')).toEqual(["'self'", "'nonce-abc123'"]);
    expect(directive(csp, 'style-src-attr')).toEqual(["'unsafe-inline'"]);
  });

  it('locks down framing, plugins, base URI and form targets', () => {
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'form-action')).toEqual(["'self'"]);
    expect(directive(csp, 'default-src')).toEqual(["'self'"]);
  });

  it('allows the API, PayPal and Firebase Storage, and no other third party', () => {
    expect(directive(csp, 'connect-src')).toContain('https://api.example.com');
    expect(directive(csp, 'connect-src')).toContain('https://*.paypal.com');
    expect(directive(csp, 'frame-src')).toContain('https://*.paypal.com');
    expect(directive(csp, 'img-src')).toContain('https://firebasestorage.googleapis.com');
    expect(directive(csp, 'media-src')).toContain('https://firebasestorage.googleapis.com');
    expect(directive(csp, 'font-src')).toEqual(["'self'"]); // next/font self-hosts: no Google Fonts
    expect(csp).not.toMatch(/googleapis\.com\/css|fonts\.gstatic|\*(?!\.)/);
    expect(csp).not.toContain('ws:'); // the dev websocket is dev only
  });

  it('adds upgrade-insecure-requests only when asked', () => {
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(buildCsp({ nonce: 'x', upgradeInsecure: true })).toContain('upgrade-insecure-requests');
  });
});

describe('buildCsp (development)', () => {
  const csp = buildCsp({ nonce: 'abc123', isDev: true });

  it('adds what React and Fast Refresh need', () => {
    expect(directive(csp, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(csp, 'style-src')).toContain("'unsafe-inline'");
    expect(directive(csp, 'connect-src')).toContain('ws://localhost:*');
  });
});

describe('helpers', () => {
  it('originOf keeps only the origin of http(s) URLs', () => {
    expect(originOf('https://api.example.com/v1?x=1')).toBe('https://api.example.com');
    expect(originOf('http://localhost:5000')).toBe('http://localhost:5000');
    expect(originOf('javascript:alert(1)')).toBeUndefined();
    expect(originOf('not a url')).toBeUndefined();
    expect(originOf(undefined)).toBeUndefined();
  });

  it('isLocalHost recognises local development hosts only', () => {
    for (const h of ['localhost', 'localhost:3000', '127.0.0.1:3601', '[::1]:3000', 'shop.localhost']) {
      expect(isLocalHost(h)).toBe(true);
    }
    for (const h of ['nazarethholycross.com', 'localhost.evil.com', '10.0.0.5', '', null, undefined]) {
      expect(isLocalHost(h)).toBe(false);
    }
  });
});
