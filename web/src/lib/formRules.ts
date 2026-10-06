// Checks every public form shares with the API, so the browser refuses exactly what the API would refuse
// (docs/FORM-CONTRACTS.md). The order and candle forms are checked BEFORE PayPal takes the money: a value the API
// refuses afterwards would leave a paid order unsaved.

// The API's own e-mail check (server/utils/validate.js, isEmail): one mailbox, ASCII only, a dotted domain.
// Stricter than the usual /^[^\s@]+@[^\s@]+\.[^\s@]+$/: "anna@exa_mple.com", "josé@mail.com" and
// "a,b@x.com" pass that one but are refused by the API.
const API_EMAIL =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export const EMAIL_MAX = 254;

/**
 * A text as the API receives it. Its input sanitiser (express-xss-sanitizer) runs before every route and writes "&",
 * "<" and ">" as "&amp;", "&lt;" and "&gt;" (an entity already written out, like "&amp;", is kept as it is). The
 * route's own checks and the model's lengths then apply to THAT text.
 */
export function asSanitised(value: string): string {
  return value
    .replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * True when the API accepts `value` as an e-mail address (after trimming, as the forms send it). It is checked as the
 * API sees it: "a&b@example.com" arrives as "a&amp;b@example.com", which the API refuses (";" is not allowed).
 */
export function isApiEmail(value: string): boolean {
  const v = asSanitised(value.trim());
  return v.length <= EMAIL_MAX && API_EMAIL.test(v);
}

/**
 * The length a text has once the API stored it ("Tom & Jerry" counts 15, not 11). Counting it here keeps a long text
 * with a few "&" or "<3" from being refused by the API after the form said it was fine.
 */
export function storedLength(value: string): number {
  return asSanitised(value).length;
}
