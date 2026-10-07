// Visitor text in the shop's e-mails (security review 06, finding 5).
//
// Every mail the API sends goes out from the church's Gmail account, DKIM-signed and trusted by the recipient's mail
// provider. A field a stranger typed must therefore never put a sentence, a link or markup of their choosing into it:
// "Dear Your PayPal refund is ready, claim it at https://evil.example/claim" was possible through the candle form.
//
// The rule: mails are plain text, they echo no free text except a greeting name, and the greeting name is used only
// when, after cleaning, it still looks like a name (letters, at most three words, short). Anything else becomes the
// neutral fallback ("friend"). The order number, the payment reference and the candle number are made by the API or
// PayPal (validated), never typed by the visitor.

export const GREETING_MAX = 30;
const GREETING_WORDS = 3;

const TAG = /<[^>]*>?/g; // an HTML tag, also an unclosed one at the end
const ENTITY = /&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);?/gi; // the API stores visitor text HTML-escaped (&amp; ...)
const URL_LIKE = /(?:[a-z][a-z\d+.-]*:\/*\S*|www\.\S*|\S+\.[a-z]{2,}(?:[/:?#]\S*)?)/giu; // scheme:..., www...., host.tld/...
const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Zl}\p{Zp}]/gu; // control, bidi/zero-width, private use, unassigned, line breaks
const HAS_CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Zl}\p{Zp}]/u; // the same, without /g (test() keeps no state)
const NAME_SHAPE = /^[\p{L}\p{M}]+(?:[ '’-][\p{L}\p{M}]+)*$/u;

/**
 * Free text made safe to sit inside a plain-text mail: no markup, no links, no control or invisible characters, one
 * line, at most `max` characters. Returns '' when nothing is left.
 */
export function plainMailText(value, max = 200) {
  if (typeof value !== 'string') return '';
  const text = value
    .normalize('NFKC')
    .replace(CONTROL_OR_FORMAT, ' ')
    .replace(TAG, ' ')
    .replace(ENTITY, ' ')
    .replace(URL_LIKE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...text].slice(0, Math.max(0, max)).join('').trim();
}

/**
 * The name to greet someone with, or null when the typed value does not look like a name (then the mail says
 * "Dear friend"). Only the cleaned text is ever used, and only if it is letters in at most three words, nothing else.
 */
export function greetingName(value) {
  if (typeof value !== 'string' || HAS_CONTROL_OR_FORMAT.test(value)) return null; // a tab, a line break, a bidi trick
  const text = plainMailText(value, 200);
  if (!text || [...text].length > GREETING_MAX) return null;
  if (!NAME_SHAPE.test(text)) return null; // digits, punctuation, symbols, emoji: not a greeting
  if (text.split(' ').length > GREETING_WORDS) return null; // a sentence, not a name
  // The cleaned text must be what was typed (apart from spacing): a value that needed cleaning is not echoed at all.
  const typed = value.normalize('NFKC').replace(/ +/g, ' ').trim();
  return typed === text ? text : null;
}

/** "Dear Maria," or "Dear friend," for the first line of a mail. */
export const greeting = (firstName) => `Dear ${greetingName(firstName) ?? 'friend'},`;
