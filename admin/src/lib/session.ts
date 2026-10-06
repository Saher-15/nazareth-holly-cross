// The browser never sees the API token. It lives in one httpOnly cookie that only the Next.js server reads.
//
//   production / any https origin : __Host-nhc_admin   Secure, Path=/, no Domain, HttpOnly, SameSite=Strict
//   plain http on localhost       : nhc_admin          HttpOnly, SameSite=Strict (the __Host- prefix requires
//                                                     Secure, which http://localhost cannot always honour)
//
// This file is pure (no next/headers import) so route handlers, the proxy and unit tests share it.

export const SECURE_COOKIE = '__Host-nhc_admin';
export const LOCAL_COOKIE = 'nhc_admin';

export type CookieSpec = { name: string; secure: boolean };

type HeaderBag = { get(name: string): string | null };

function first(value: string | null | undefined): string {
  return (value ?? '').split(',')[0].trim();
}

/** True for http://localhost, http://127.0.0.1 and http://[::1] - the only places a Secure-less cookie is acceptable. */
export function isLocalHttp(url: string, headers: HeaderBag): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const proto = (first(headers.get('x-forwarded-proto')) || parsed.protocol.replace(':', '')).toLowerCase();
  const host = (first(headers.get('x-forwarded-host')) || first(headers.get('host')) || parsed.host).toLowerCase();
  const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.replace(/:\d+$/, '');
  return proto === 'http' && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]');
}

export function cookieSpecFor(url: string, headers: HeaderBag): CookieSpec {
  return isLocalHttp(url, headers) ? { name: LOCAL_COOKIE, secure: false } : { name: SECURE_COOKIE, secure: true };
}

export function sessionCookieOptions(spec: CookieSpec, maxAgeSeconds: number) {
  return {
    name: spec.name,
    httpOnly: true,
    secure: spec.secure,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/** Token lifetime in seconds. The contract says 60 minutes; tolerate an API that answers in milliseconds. */
export function normalizeExpiresIn(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 3600;
  const seconds = n > 86_400 ? Math.round(n / 1000) : Math.round(n);
  return Math.min(Math.max(seconds, 60), 86_400);
}

type CookieReader = { get(name: string): { value: string } | undefined };

export function readSessionToken(cookies: CookieReader): string | undefined {
  return cookies.get(SECURE_COOKIE)?.value || cookies.get(LOCAL_COOKIE)?.value || undefined;
}

export type TokenClaims = { sub?: string; role?: string; sid?: string; exp?: number; iat?: number };

/** Reads the claims of a JWT WITHOUT verifying it. Only for UI decisions (is it obviously expired?); the API verifies. */
export function decodeClaims(token: string | undefined): TokenClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '='));
    const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0))));
    return claims && typeof claims === 'object' ? (claims as TokenClaims) : null;
  } catch {
    return null;
  }
}

/** A token that looks usable: three parts, and not past its exp claim (30 s of clock skew allowed). */
export function looksValid(token: string | undefined, nowMs = Date.now()): boolean {
  const claims = decodeClaims(token);
  if (!claims) return false;
  if (typeof claims.exp === 'number' && claims.exp * 1000 < nowMs - 30_000) return false;
  return true;
}

/** Only same-site relative paths are valid redirect targets after sign-in. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || /[\r\n]/.test(value)) return '/';
  if (value.startsWith('/api/') || value.startsWith('/login')) return '/';
  return value;
}
