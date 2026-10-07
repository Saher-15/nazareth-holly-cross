import { describe, expect, it } from 'vitest';
import { checkSameOrigin, isStateChanging } from '@/lib/csrf';
import { buildCsp, parseOrigins } from '@/lib/csp';
import {
  cookieSpecFor,
  decodeClaims,
  isLocalHttp,
  LOCAL_COOKIE,
  looksValid,
  normalizeExpiresIn,
  readSessionToken,
  safeNextPath,
  SECURE_COOKIE,
  sessionCookieOptions,
} from '@/lib/session';

const headers = (init: Record<string, string> = {}) => new Headers(init);

function jwt(payload: object): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.signature`;
}

describe('session cookie', () => {
  it('uses the __Host- prefix and Secure on any https origin', () => {
    const spec = cookieSpecFor('https://admin.example.com/api/session/login', headers({ host: 'admin.example.com' }));
    expect(spec).toEqual({ name: SECURE_COOKIE, secure: true });
    expect(SECURE_COOKIE.startsWith('__Host-')).toBe(true);
    const options = sessionCookieOptions(spec, 3600);
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 3600 });
    expect(options).not.toHaveProperty('domain'); // __Host- forbids a Domain attribute
  });

  it('drops Secure only for plain http on localhost', () => {
    expect(cookieSpecFor('http://localhost:3901/x', headers({ host: 'localhost:3901' }))).toEqual({ name: LOCAL_COOKIE, secure: false });
    expect(isLocalHttp('http://127.0.0.1:3901/x', headers({ host: '127.0.0.1:3901' }))).toBe(true);
    expect(isLocalHttp('http://[::1]:3901/x', headers({ host: '[::1]:3901' }))).toBe(true);
    expect(sessionCookieOptions({ name: LOCAL_COOKIE, secure: false }, 60)).toMatchObject({ httpOnly: true, secure: false, sameSite: 'strict' });
  });

  it('never trusts localhost when the request really came over https or for another host', () => {
    expect(isLocalHttp('http://localhost:3901/', headers({ host: 'localhost:3901', 'x-forwarded-proto': 'https' }))).toBe(false);
    expect(isLocalHttp('http://localhost:3901/', headers({ host: 'localhost:3901', 'x-forwarded-host': 'admin.example.com' }))).toBe(false);
    expect(isLocalHttp('http://admin.example.com/', headers({ host: 'admin.example.com' }))).toBe(false);
    expect(isLocalHttp('http://localhost.evil.example/', headers({ host: 'localhost.evil.example' }))).toBe(false);
    expect(isLocalHttp('not a url', headers())).toBe(false);
  });

  it('reads the token from either cookie name, secure one first', () => {
    const jar = (values: Record<string, string>) => ({ get: (n: string) => (n in values ? { value: values[n] } : undefined) });
    expect(readSessionToken(jar({ [SECURE_COOKIE]: 'a', [LOCAL_COOKIE]: 'b' }))).toBe('a');
    expect(readSessionToken(jar({ [LOCAL_COOKIE]: 'b' }))).toBe('b');
    expect(readSessionToken(jar({}))).toBeUndefined();
  });

  it('normalises the token lifetime (seconds, tolerates milliseconds, clamps)', () => {
    expect(normalizeExpiresIn(3600)).toBe(3600);
    expect(normalizeExpiresIn(3_600_000)).toBe(3600);
    expect(normalizeExpiresIn(undefined)).toBe(3600);
    expect(normalizeExpiresIn(-5)).toBe(3600);
    expect(normalizeExpiresIn(5)).toBe(60);
    expect(normalizeExpiresIn(10_000_000)).toBe(10_000);
  });
});

describe('token claims', () => {
  it('decodes claims without verifying and recognises an expired or malformed token', () => {
    const now = Date.now();
    const live = jwt({ sub: 'u1', role: 'owner', sid: 's', exp: Math.floor(now / 1000) + 600 });
    const dead = jwt({ sub: 'u1', exp: Math.floor(now / 1000) - 600 });
    expect(decodeClaims(live)).toMatchObject({ sub: 'u1', role: 'owner', sid: 's' });
    expect(looksValid(live, now)).toBe(true);
    expect(looksValid(dead, now)).toBe(false);
    expect(looksValid(jwt({ sub: 'u1', exp: Math.floor(now / 1000) - 10 }), now)).toBe(true); // 30 s skew
    for (const bad of [undefined, '', 'abc', 'a.b', 'a.!!!.c', 'a.bm90LWpzb24.c']) expect(looksValid(bad, now)).toBe(false);
  });
});

describe('safeNextPath', () => {
  it('keeps same-site paths and refuses everything that could leave the site', () => {
    expect(safeNextPath('/orders?status=pending')).toBe('/orders?status=pending');
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'javascript:alert(1)', '/login', '/api/session/expire', '/a\r\nb', '', undefined, null]) {
      expect(safeNextPath(bad as string | null | undefined)).toBe('/');
    }
  });

  // Security review 06, finding 4: browsers drop TAB, CR and LF while parsing a URL, so "/\t/evil.example" reached
  // location.assign as "//evil.example" (another site). Every one of these must give '/'.
  const NASTY: [string, string][] = [
    ['a tab after the slash', '/\t/evil.example'],
    ['a tab, percent-encoded', '/%09/evil.example'],
    ['a tab first', '\t//evil.example'],
    ['a newline after the slash', '/\n/evil.example'],
    ['a carriage return after the slash', '/\r/evil.example'],
    ['CR LF encoded', '/%0d%0a/evil.example'],
    ['a NUL', '/\u0000/evil.example'],
    ['a vertical tab', '/\u000b/evil.example'],
    ['a form feed', '/\u000c/evil.example'],
    ['DEL', '/\u007f/evil.example'],
    ['a C1 control', '/\u0085/evil.example'],
    ['a space', '/ /evil.example'],
    ['a leading space', ' //evil.example'],
    ['a space, encoded', '/%20/evil.example'],
    ['a no-break space', '/\u00a0/evil.example'],
    ['an ideographic space', '/\u3000/evil.example'],
    ['a zero-width space', '/\u200b/evil.example'],
    ['a right-to-left override', '/\u202e/evil.example'],
    ['a line separator', '/\u2028/evil.example'],
    ['a byte-order mark', '/\ufeff/evil.example'],
    ['a backslash', '/\\evil.example'],
    ['a backslash, encoded', '/%5Cevil.example'],
    ['a backslash, encoded twice', '/%255Cevil.example'],
    ['a backslash later in the path', '/orders\\..\\..\\evil'],
    ['two slashes', '//evil.example'],
    ['three slashes', '///evil.example'],
    ['two slashes, encoded', '/%2Fevil.example'],
    ['two slashes, encoded twice', '/%252Fevil.example'],
    ['dot segments that end in two slashes', '/a/..//evil.example'],
    ['a dot segment that ends in two slashes', '/.//evil.example'],
    ['an encoded dot segment', '/%2e%2e//evil.example'],
    ['a scheme', 'http://evil.example'],
    ['a scheme without slashes', 'http:evil.example'],
    ['a javascript: URL', 'javascript:alert(document.cookie)'],
    ['a data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['credentials', '//user:pass@evil.example'],
    ['a relative path', 'orders'],
    ['a dot path', './orders'],
    ['a malformed escape', '/orders%'],
    ['a malformed escape later', '/orders?q=%E0%A4%A'],
    ['the sign-in page', '/login'],
    ['the sign-in page with a query', '/login?next=/orders'],
    ['the sign-in page via dot segments', '/orders/../login'],
    ['an API route', '/api/session/logout'],
    ['an API route via dot segments', '/orders/../api/session/logout'],
    ['an API route, encoded', '/%61pi/session/logout'],
    ['too long', `/${'a'.repeat(3000)}`],
  ];
  it.each(NASTY)('refuses %s', (_label, value) => {
    expect(safeNextPath(value)).toBe('/');
  });

  it.each([
    ['/', '/'],
    ['/orders', '/orders'],
    ['/orders?status=pending&page=2', '/orders?status=pending&page=2'],
    ['/orders/64b000000000000000000001', '/orders/64b000000000000000000001'],
    ['/settings#totp', '/settings'], // the fragment is dropped, it never reaches the server anyway
    ['/products/./new', '/products/new'], // the normalised form is returned
    ['/orders?q=caf%C3%A9', '/orders?q=caf%C3%A9'],
    ['/loginx', '/loginx'], // only /login itself is excluded
  ])('keeps %s as %s', (value, expected) => {
    expect(safeNextPath(value)).toBe(expected);
  });

  it('what it returns always resolves to this site', () => {
    for (const [, value] of NASTY) {
      const target = safeNextPath(value);
      expect(new URL(target, 'https://admin.nazarethholycross.com').origin).toBe('https://admin.nazarethholycross.com');
    }
  });
});

describe('CSRF check', () => {
  const url = 'http://localhost:3901/api/session/login';
  it('lets safe methods through', () => {
    for (const m of ['GET', 'HEAD', 'OPTIONS']) expect(checkSameOrigin(m, headers(), url, [])).toEqual({ ok: true });
    expect(isStateChanging('post')).toBe(true);
    expect(isStateChanging('get')).toBe(false);
  });
  it('accepts a same-origin Origin, or Sec-Fetch-Site: same-origin without Origin', () => {
    expect(checkSameOrigin('POST', headers({ origin: 'http://localhost:3901', host: 'localhost:3901' }), url, []).ok).toBe(true);
    expect(checkSameOrigin('POST', headers({ 'sec-fetch-site': 'same-origin', host: 'localhost:3901' }), url, []).ok).toBe(true);
    expect(checkSameOrigin('DELETE', headers({ origin: 'https://admin.example.com', 'x-forwarded-host': 'admin.example.com', host: 'internal:3000' }), url, []).ok).toBe(true);
  });
  it('refuses cross-site, mismatching, opaque, malformed and missing origins', () => {
    const base = { host: 'localhost:3901' };
    expect(checkSameOrigin('POST', headers({ ...base, origin: 'https://evil.example' }), url, []).ok).toBe(false);
    expect(checkSameOrigin('POST', headers({ ...base, origin: 'null' }), url, []).ok).toBe(false);
    expect(checkSameOrigin('POST', headers({ ...base, origin: 'not a url' }), url, []).ok).toBe(false);
    expect(checkSameOrigin('POST', headers({ ...base }), url, []).ok).toBe(false);
    expect(checkSameOrigin('POST', headers({ ...base, origin: 'http://localhost:3901', 'sec-fetch-site': 'cross-site' }), url, []).ok).toBe(false);
    expect(checkSameOrigin('POST', headers({ ...base, origin: 'http://localhost:3901', 'sec-fetch-site': 'same-site' }), url, []).ok).toBe(false);
    expect(checkSameOrigin('POST', headers({ ...base, origin: 'http://localhost:3902' }), url, []).ok).toBe(false); // other port
  });
  it('honours the configured extra origins and nothing else', () => {
    const h = headers({ host: 'localhost:3901', origin: 'https://staging.example.com' });
    expect(checkSameOrigin('POST', h, url, ['https://staging.example.com']).ok).toBe(true);
    expect(checkSameOrigin('POST', h, url, ['https://other.example.com']).ok).toBe(false);
  });
});

describe('Content-Security-Policy', () => {
  it('has the nonce, no inline allowance and no framing in production', () => {
    const csp = buildCsp({ nonce: 'abc123' });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc123'");
    expect(csp).toContain("style-src-attr 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).not.toMatch(/unsafe-(inline|eval)/);
  });
  it('allows eval and inline styles only in development, and no upgrade on plain localhost', () => {
    const dev = buildCsp({ nonce: 'n', dev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain('upgrade-insecure-requests');
    expect(buildCsp({ nonce: 'n', upgradeInsecure: false })).not.toContain('upgrade-insecure-requests');
  });
  it('allows Firebase Storage images and connections, plus only well-formed extra https origins', () => {
    const csp = buildCsp({ nonce: 'n', extraImgSrc: parseOrigins('https://cdn.example.com, http://insecure.example.com, javascript:alert(1), https://a.b:8443') });
    expect(csp).toMatch(/img-src [^;]*https:\/\/firebasestorage\.googleapis\.com/);
    expect(csp).toMatch(/connect-src [^;]*https:\/\/firebasestorage\.googleapis\.com/);
    expect(csp).toContain('https://cdn.example.com');
    expect(csp).toContain('https://a.b:8443');
    expect(csp).not.toContain('insecure.example.com');
    expect(csp).not.toContain('javascript:');
  });
});
