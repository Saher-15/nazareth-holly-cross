import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp, makeNonce, parseOrigins } from '@/lib/csp';
import { checkSameOrigin } from '@/lib/csrf';
import { NO_STORE } from '@/lib/http';
import { isLocalHttp, looksValid, readSessionToken } from '@/lib/session';

// Runs before every page and route handler (not before built assets):
//   1. CSRF: state-changing requests must come from this site (Origin / Sec-Fetch-Site).
//   2. Sign-in gate: no valid-looking session cookie -> /login (or 401 for /api calls). The API verifies the token
//      itself; this only avoids rendering a page for someone who is obviously signed out.
//   3. Per-request nonce Content-Security-Policy, plus no-store and noindex on everything.

const PUBLIC_PATHS = new Set(['/login', '/robots.txt']);

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith('/api/session/');
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const csrf = checkSameOrigin(request.method, request.headers, request.url);
  if (!csrf.ok) {
    return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': NO_STORE, 'X-Robots-Tag': 'noindex' },
    });
  }

  const authed = looksValid(readSessionToken(request.cookies));
  const isApi = pathname.startsWith('/api/');

  if (!authed && !isPublic(pathname)) {
    if (isApi) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': NO_STORE, 'X-Robots-Tag': 'noindex' },
      });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    const next = `${pathname}${search}`;
    if (next !== '/') url.searchParams.set('next', next);
    const redirect = NextResponse.redirect(url, 307);
    redirect.headers.set('Cache-Control', NO_STORE);
    redirect.headers.set('X-Robots-Tag', 'noindex');
    return redirect;
  }

  if (authed && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    const redirect = NextResponse.redirect(url, 307);
    redirect.headers.set('Cache-Control', NO_STORE);
    return redirect;
  }

  const nonce = makeNonce();
  const csp = buildCsp({
    nonce,
    dev: process.env.NODE_ENV === 'development',
    upgradeInsecure: !isLocalHttp(request.url, request.headers),
    extraImgSrc: parseOrigins(process.env.ADMIN_IMG_SRC),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', NO_STORE);
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|mock/).*)'],
};
