import { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { API_URL } from './lib/config';
import { buildCsp, generateNonce, isLocalHost, originOf } from './lib/csp';

// 1. Sends visitors without a language in the URL to their preferred one (Accept-Language, cookie).
// 2. Gives every page response its own Content-Security-Policy nonce (see lib/csp.ts). The nonce travels
//    to the renderer in the request headers (Next.js reads it from the CSP header and tags its scripts),
//    and `x-nonce` lets server components hand it to third-party scripts.
const intl = createMiddleware(routing);

const isDev = process.env.NODE_ENV === 'development';
const apiOrigin = originOf(API_URL);

export default function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    isDev,
    apiOrigin,
    // https:// only: plain-http localhost (development, the end-to-end tests) must keep working.
    upgradeInsecure: !isDev && !isLocalHost(request.headers.get('host')),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = intl(new NextRequest(request, { headers: requestHeaders }));
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Everything except API routes, Next internals and static files served as they are (public/ and the
  // metadata routes: no language prefix, no nonce). Any other address, even one with a dot in it
  // (/en/x.y), is a page request: it gets a language and the Content-Security-Policy.
  // The matcher must be one literal (Next reads it at build time). Backslashes are doubled on purpose: in a
  // plain string a single one is dropped, and the previous pattern then excluded every path except "/",
  // so /shop answered 404 instead of redirecting to /en/shop.
  matcher: [
    '/((?!api|_next|_vercel|.*\\.(?:ico|png|jpe?g|gif|webp|avif|svg|mp3|mp4|webm|woff2?|ttf|otf|css|js|mjs|map|json|webmanifest|txt|xml|pdf)$).*)',
  ],
};
