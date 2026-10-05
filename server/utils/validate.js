// Small input checks shared by the routes. Request bodies are untrusted: a field that should be text can
// arrive as a number, an array or an object, so every check starts with the type.

export const isText = (value) => typeof value === 'string' && value.trim() !== '';

// An address that is safe to hand to the mailer: one mailbox, no list separators, no quotes, comments,
// angle brackets or control characters (the usual ways to turn one address into several recipients or to
// inject headers). Deliberately stricter than RFC 5322: every real-world address a visitor types passes.
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function isEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL.test(value.trim());
}

// A MongoDB ObjectId written as 24 hex digits (mongoose.isValidObjectId also accepts any 12-character string).
export const isObjectId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

// A PayPal order id, as the PayPal API issues them.
export const isPayPalOrderId = (value) => typeof value === 'string' && /^[A-Z0-9]{17}$/.test(value);

// `value` as a trimmed string capped at `max` characters, or undefined when it is not a string.
export const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : undefined);
