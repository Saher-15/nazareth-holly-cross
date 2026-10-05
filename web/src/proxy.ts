import { NextRequest, type NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { defaultLocale, languageFallbacks, locales, routing } from './i18n/routing';
import { isCrawler, withLanguageFallbacks } from './lib/negotiate';

// Sends visitors without a language in the URL to the one they prefer, in this order:
//   1. the language they chose before (next-intl keeps it in the NEXT_LOCALE cookie),
//   2. their browser's Accept-Language (next-intl's matching, plus a few neighbours such as Belarusian → Russian),
//   3. English.
// A URL that already names a language is never redirected: /fr/shop stays /fr/shop whoever asks.
// Robots get English for a bare URL whatever their headers say, so the answer is stable for search engines.
const intl = createMiddleware(routing);

export default function proxy(request: NextRequest): NextResponse {
  const crawler = isCrawler(request.headers.get('user-agent'));

  // Rebuilding the request is only needed to change what next-intl sees, and only for GET/HEAD: a POST
  // (a server action) must reach the page with its body untouched.
  const safeMethod = request.method === 'GET' || request.method === 'HEAD';
  let seen = request;
  if (safeMethod) {
    const headers = new Headers(request.headers);
    let changed = false;
    if (crawler) {
      headers.delete('cookie');
      headers.set('accept-language', defaultLocale);
      changed = true;
    } else {
      const requested = headers.get('accept-language');
      const adjusted = requested ? withLanguageFallbacks(requested, locales, languageFallbacks) : requested;
      if (requested && adjusted !== requested) {
        headers.set('accept-language', adjusted ?? requested);
        changed = true;
      }
    }
    if (changed) seen = new NextRequest(request, { headers });
  }

  const response = intl(seen);

  // A crawler has no preference to remember.
  if (crawler) response.headers.delete('set-cookie');

  // The redirect from a bare URL depends on the request headers: say so, and keep shared caches from
  // handing one visitor's redirect to the next.
  if (response.status >= 300 && response.status < 400) {
    response.headers.append('Vary', 'Accept-Language');
    response.headers.append('Vary', 'Cookie');
    response.headers.set('Cache-Control', 'private, no-cache, no-store');
  }
  return response;
}

export const config = {
  // Everything except API routes, Next internals and files with an extension (images, sitemap.xml, robots.txt ...).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
