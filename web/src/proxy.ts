import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Sends visitors without a language in the URL to their preferred one (Accept-Language, cookie).
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals and files with an extension. The dot is escaped twice:
  // once for the string, once for the regular expression. With a single backslash the string swallows
  // it and the pattern excludes every path, so /shop or /latin would never reach the proxy
  // (tests/unit/proxy.test.ts guards this).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
