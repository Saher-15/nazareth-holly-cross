// The API stores visitor text HTML-escaped: its sanitizer turns & < > (and quotes) into entities before saving
// (docs/ADMIN.md 4.2). React escapes on output, so the dashboard decodes what it receives once, here; an edit form
// then holds the characters the person typed and the API escapes them once more when they are sent back.
// Only these five entities are decoded, in one pass: "&amp;lt;" becomes "&lt;", never "<".

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

export function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (_match, name: string) => ENTITIES[name]);
}

/** Decodes every string inside a parsed JSON value (objects and arrays are copied, other values are kept). */
export function decodeDeep<T>(value: T): T {
  if (typeof value === 'string') return decodeEntities(value) as T;
  if (Array.isArray(value)) return value.map((item) => decodeDeep(item)) as T;
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeDeep(item)])) as T;
  }
  return value;
}
