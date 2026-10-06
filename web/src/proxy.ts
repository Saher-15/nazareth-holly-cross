import { NextRequest, type NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { defaultLocale, languageFallbacks, locales, routing } from './i18n/routing';
import { API_URL } from './lib/config';
import { buildCsp, generateNonce, isLocalHost, originOf } from './lib/csp';
import { HSTS_VALUE } from './lib/hsts';
import { isCrawler, withLanguageFallbacks } from './lib/negotiate';

// 1. Sends visitors without a language in the URL to the one they prefer, in this order:
//      a. the language they chose before (next-intl keeps it in the NEXT_LOCALE cookie),
//      b. their browser's Accept-Language (next-intl's matching, plus a few neighbours such as Belarusian → Russian),
//      c. English.
//    A URL that already names a language is never redirected: /fr/shop stays /fr/shop whoever asks.
//    Robots get English for a bare URL whatever their headers say, so the answer is stable for search engines.
// 2. Gives every page response its own Content-Security-Policy nonce (see lib/csp.ts). The nonce travels
//    to the renderer in the request headers (Next.js reads it from the CSP header and tags its scripts),
//    and `x-nonce` lets server components hand it to third-party scripts.
const intl = createMiddleware(routing);

const isDev = process.env.NODE_ENV === 'development';
const apiOrigin = originOf(API_URL);

export default function proxy(request: NextRequest): NextResponse {
  const crawler = isCrawler(request.headers.get('user-agent'));

  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    isDev,
    apiOrigin,
    // https:// only: plain-http localhost (development, the end-to-end tests) must keep working.
    upgradeInsecure: !isDev && !isLocalHost(request.headers.get('host')),
  });

  // Rebuilding the request is needed to hand the nonce to the renderer and to change what next-intl sees,
  // and only for GET/HEAD: a POST (a server action) must reach the page with its body untouched.
  const safeMethod = request.method === 'GET' || request.method === 'HEAD';
  let seen = request;
  if (safeMethod) {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('content-security-policy', csp);
    if (crawler) {
      headers.delete('cookie');
      headers.set('accept-language', defaultLocale);
    } else {
      const requested = headers.get('accept-language');
      const adjusted = requested ? withLanguageFallbacks(requested, locales, languageFallbacks) : requested;
      if (requested && adjusted !== requested) headers.set('accept-language', adjusted ?? requested);
    }
    seen = new NextRequest(request, { headers });
  }

  const response = intl(seen);
  response.headers.set('Content-Security-Policy', csp);

  // A crawler has no preference to remember. Neither has a client that sent no Accept-Language and no language
  // cookie (an uptime probe, a CDN health check, curl): next-intl would set NEXT_LOCALE on its answer, and a
  // shared cache does not store a response that sets a cookie. A real browser whose language matches the URL
  // already gets no cookie from next-intl; one that opens another language does, so a later visit to "/" opens it.
  if (crawler || (!request.headers.get('accept-language') && !request.cookies.has('NEXT_LOCALE'))) {
    response.headers.delete('set-cookie');
  }

  // The redirect from a bare URL depends on the request headers: say so, and keep shared caches from
  // handing one visitor's redirect to the next.
  if (response.status >= 300 && response.status < 400) {
    response.headers.append('Vary', 'Accept-Language');
    response.headers.append('Vary', 'Cookie');
    response.headers.set('Cache-Control', 'private, no-cache, no-store');
    // The security headers of next.config.ts are not applied to an answer this proxy produces itself, and a
    // redirect is the very first thing a visitor of "/" gets: without this, Netlify fills in a weaker HSTS.
    response.headers.set('Strict-Transport-Security', HSTS_VALUE);
  }
  return response;
}

export const config = {
  // Everything except API routes, Next internals and static files served as they are (public/ and the
  // metadata routes: no language prefix, no nonce). Any other address, even one with a dot in it
  // (/en/x.y), is a page request: it gets a language and the Content-Security-Policy.
  // /admin is left out: next.config.ts forwards it to the dashboard's own domain in one hop (with the language
  // proxy first, /admin/orders became /en/admin/orders and was lost).
  // The matcher must be one literal (Next reads it at build time). Backslashes are doubled on purpose: in a
  // plain string a single one is dropped, and the previous pattern then excluded every path except "/",
  // so /shop answered 404 instead of redirecting to /en/shop.
  matcher: [
    '/((?!api|admin|_next|_vercel|.*\\.(?:ico|png|jpe?g|gif|webp|avif|svg|mp3|mp4|webm|woff2?|ttf|otf|css|js|mjs|map|json|webmanifest|txt|xml|pdf)$).*)',
  ],
};
