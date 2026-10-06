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

// Every request, per IP - except the health check: Render probes /health from a shared address, and a 429
// there made Render report "server failure" and restart the service (alert of 2026-10-06 02:37).
export const globalLimiter = limiter(200, undefined, { skip: (req) => req.path === '/health' });

// GET /health and /health/deep: uptime monitors and the keep-alive job call them all day. They get a counter of
// their own (answered before the general one) so a busy or abusive neighbour on the same address can never make
// the monitor see "429 Too Many Requests" and raise a false alarm. Both are cheap; /health/deep caches its answer.
export const healthLimiter = limiter(300);

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

// ---- Admin dashboard (route/admin/*, docs/ADMIN.md) ----
//
// Three layers. (1) apiLimiter: a generous per-IP ceiling on every /admin request, before anything is looked up.
// (2) The sign-in limiters below. (3) adminLimiter: 300 requests per 15 minutes per signed-in admin, counted after
// the token is checked, so several staff behind one office address do not share a budget.

export const ADMIN_IP_LIMIT = 1000;
export const adminIpLimiter = limiter(ADMIN_IP_LIMIT);

const loginName = (req) => String(typeof req.body?.username === 'string' ? req.body.username : '').toLowerCase().slice(0, 100);
const succeeded = (req, res) => res.statusCode < 400 || res.statusCode === 428; // 428 = "now send the TOTP code"

// POST /admin/auth/login: 5 failures per 15 minutes per address AND username (successful sign-ins do not count).
export const adminLoginLimiter = limiter(5, 'Too many login attempts, please try again in 15 minutes.', {
  skipSuccessfulRequests: true,
  requestWasSuccessful: succeeded,
  keyGenerator: (req) => `${req.ip}|${loginName(req)}`,
});

// ... and 30 failures per address across all usernames, so rotating names does not reset the allowance.
export const adminLoginIpLimiter = limiter(30, 'Too many login attempts, please try again in 15 minutes.', {
  skipSuccessfulRequests: true,
  requestWasSuccessful: succeeded,
});

const adminKey = (req) => `admin:${req.adminUser?.id}`;

// Every authenticated admin request.
export const adminLimiter = limiter(300, 'Too many requests, please slow down.', {
  keyGenerator: adminKey,
  skip: (req) => !req.adminUser, // legacy tokens are handled by the legacy routes (and the per-IP layer)
});

// Password and second-factor changes: a stolen token must not be able to guess the current password.
export const adminSensitiveLimiter = limiter(5, 'Too many attempts, please try again in 15 minutes.', {
  keyGenerator: adminKey,
  skipSuccessfulRequests: true,
});

/** The per-IP limit for every request: the large read allowance for public reads, the strict one for the rest. */
export function apiLimiter(req, res, next) {
  if (req.path.startsWith('/admin/')) return adminIpLimiter(req, res, next);
  return (publicReadCacheControl(req) ? readLimiter : globalLimiter)(req, res, next);
}
