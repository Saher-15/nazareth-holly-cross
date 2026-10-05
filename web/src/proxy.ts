import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Sends visitors without a language in the URL to their preferred one (Accept-Language, cookie).
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\..*).*)'],
};
