// The one way structured data (schema.org JSON-LD) is turned into the text of a
// <script type="application/ld+json">. Every JSON-LD block of the site is written as raw HTML text and
// must go through here (tests/unit/security.test.ts enforces it); see node_modules/next/dist/docs/01-app/02-guides/json-ld.md.
//
// Text that visitors wrote (review bodies, names) can end up in the data, so the output must never be
// able to close the script element or start HTML: "<", ">" and "&" are written as unicode escapes,
// which JSON.parse reads back as the same characters. The line and paragraph separators (code points
// 0x2028 and 0x2029) are escaped too: they are valid in JSON but were line terminators in JavaScript
// string literals, and some parsers still trip over them. (Built from code points on purpose, so the
// source file itself never contains those invisible characters.)
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

const unicodeEscape = (char: string) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');

const UNSAFE = new RegExp(`[<>&${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}]`, 'g');

export function serializeJsonLd(data: unknown): string {
  const json = JSON.stringify(data) ?? 'null';
  return json.replace(UNSAFE, unicodeEscape);
}
