import rateLimit from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const limiter = (limit, message = 'Too many requests, please try again later.', extra = {}) =>
  rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
    ...extra,
  });

// Every request, per IP.
export const globalLimiter = limiter(200);

// Public forms that send mail or store text (contact, candle, prayer, review): shared counter per IP.
export const strictLimiter = limiter(10);

// Authentication endpoints (brute-force protection); only failed attempts count.
export const loginLimiter = limiter(5, 'Too many login attempts, please try again in 15 minutes.', {
  skipSuccessfulRequests: true,
});

// Payments. Starting a PayPal order and capturing it are cheap for a shopper (a few tries when a card is
// declined or a popup is closed) but each one is a call to PayPal for us, so they are capped per IP.
export const paymentLimiter = limiter(30, 'Too many payment attempts, please try again later.');

// Saving a paid order: a shopper does this once per purchase.
export const newOrderLimiter = limiter(10, 'Too many orders, please try again later.');

// A "like" on a prayer: anonymous and cheap, so it is the easiest thing to inflate with a script.
export const likeLimiter = limiter(30, 'Too many likes, please slow down.');

// ---- Public read-only data (catalogue, product pages, reviews, prayers) ----
//
// The website's own server reads these while it builds and refreshes pages, and from a host such as Netlify it
// shares an IP address with other sites, so the general 200-per-15-minutes allowance is used up by the build
// alone. Reads of public data get their own, much larger counter (it also protects the database from a script);
// every other request keeps the strict one. The answers carry Cache-Control so a CDN or the browser absorbs the
// repeat traffic instead of the API, and may keep serving the last good copy while the API is down or waking up.
export const READ_LIMIT = 1000;
export const readLimiter = limiter(READ_LIMIT);

const SLOW = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600, stale-if-error=86400';
const FRESH = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300, stale-if-error=3600';

// The catalogue changes a few times a week: five minutes at the edge. Visitor text (reviews, prayers) can appear
// in seconds, so it is cached for one.
const PUBLIC_READS = [
  { pattern: /^\/product\/(getAllProducts|getNProducts|getProduct\/[^/]+|catalog|bestSellers|[^/]+\/similar)\/?$/, cache: SLOW },
  { pattern: /^\/product\/[^/]+\/reviews\/?$/, cache: FRESH },
  { pattern: /^\/review\/getReviews\/?$/, cache: FRESH },
  { pattern: /^\/prayer\/getPrayers\/?$/, cache: FRESH },
];

/** The Cache-Control value of a public read (GET/HEAD of one of the listed addresses), or null for anything else. */
export function publicReadCacheControl(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  return PUBLIC_READS.find(({ pattern }) => pattern.test(req.path))?.cache ?? null;
}

/** Marks public reads as cacheable. Errors (4xx/5xx) are never cached: a missing product must appear once added. */
export function publicReadCache(req, res, next) {
  const cache = publicReadCacheControl(req);
  if (!cache) return next();
  res.setHeader('Cache-Control', cache);
  const writeHead = res.writeHead;
  res.writeHead = function guardedWriteHead(status, ...rest) {
    if (status >= 400) res.setHeader('Cache-Control', 'no-store');
    return writeHead.call(this, status, ...rest);
  };
  return next();
}

/** The per-IP limit for every request: the large read allowance for public reads, the strict one for the rest. */
export function apiLimiter(req, res, next) {
  return (publicReadCacheControl(req) ? readLimiter : globalLimiter)(req, res, next);
}
