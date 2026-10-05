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
