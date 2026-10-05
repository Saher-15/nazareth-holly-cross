import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Sends visitors without a language in the URL to their preferred one (Accept-Language, cookie).
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  // The dot is escaped twice on purpose: inside a JS string `\.` is just `.`, which would
  // exclude every path and leave /shop, /latin... without a language redirect.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
