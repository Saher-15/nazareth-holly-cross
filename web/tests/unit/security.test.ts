import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { prayerSchema, reviewSchema } from '@/lib/api';
import { serializeJsonLd } from '@/lib/jsonLd';
import { decodeEntities } from '@/lib/plainText';

describe('serializeJsonLd', () => {
  it('cannot close the script element or open HTML', () => {
    const out = serializeJsonLd({ reviewBody: '</script><script>alert(1)</script><!-- & -->' });
    expect(out).not.toMatch(/[<>&]/);
    expect(out).toContain('\\u003c/script\\u003e');
  });

  it('escapes the JavaScript line terminators U+2028 and U+2029', () => {
    const out = serializeJsonLd({ text: 'a\u2028b\u2029c' });
    expect(out).not.toContain('\u2028');
    expect(out).not.toContain('\u2029');
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
  });

  it('round-trips: JSON.parse gives back exactly the data', () => {
    const data = { a: '</script> & <b>"x"</b>', n: [1, 2, { deep: 'a\u2028b' }], he: 'שלום', ar: 'مرحبا' };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it('handles values JSON cannot represent without throwing', () => {
    expect(serializeJsonLd(undefined)).toBe('null');
    expect(serializeJsonLd(null)).toBe('null');
  });
});

describe('visitor text from the API', () => {
  it('decodes the entities the API stores, exactly once', () => {
    expect(decodeEntities('Peace &amp; love &lt;3 &quot;hi&quot; it&#39;s')).toBe('Peace & love <3 "hi" it\'s');
    expect(decodeEntities('&amp;lt;script&amp;gt;')).toBe('&lt;script&gt;'); // never a second decode into markup
    expect(decodeEntities('plain text שלום')).toBe('plain text שלום');
  });

  it('reviews and prayers are decoded when parsed (they are rendered as text by React)', () => {
    const review = reviewSchema.parse({ _id: '1', fullName: 'Tom &amp; Jerry', email: 'Haifa &amp; Nazareth', msg: 'a &lt; b' });
    expect(review).toMatchObject({ fullName: 'Tom & Jerry', email: 'Haifa & Nazareth', msg: 'a < b' });
    const prayer = prayerSchema.parse({ _id: '1', name: 'A &amp; B', country: null, prayer: 'x &gt; y' });
    expect(prayer).toMatchObject({ name: 'A & B', country: '', prayer: 'x > y' });
  });
});

// Source-level guards: the rules below were true when this test was written and must stay true.
const SRC = path.resolve(__dirname, '../../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}
const files = sourceFiles(SRC).map((file) => ({ file: path.relative(SRC, file).replaceAll('\\', '/'), text: readFileSync(file, 'utf8') }));

describe('source guards', () => {
  it('dangerouslySetInnerHTML is only used for JSON-LD that went through the escaping serializer', () => {
    const offenders = files
      .filter(({ text }) => text.includes('dangerouslySetInnerHTML'))
      .filter(({ text }) => {
        const tags = [...text.matchAll(/<script[\s\S]*?\/>/g)].map((m) => m[0]).filter((t) => t.includes('dangerouslySetInnerHTML'));
        const everyUseIsJsonLd = tags.length === (text.match(/dangerouslySetInnerHTML/g) ?? []).length;
        const escaped = tags.every((t) => /(serializeJsonLd|jsonLdHtml)\(/.test(t));
        return !(everyUseIsJsonLd && tags.every((t) => t.includes('application/ld+json')) && escaped);
      })
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('no eval, document.write or innerHTML assignment in the app', () => {
    const bad = files.filter(({ text }) => /\beval\(|new Function\(|document\.write\(|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML/.test(text));
    expect(bad.map((f) => f.file)).toEqual([]);
  });

  it('every link that opens a new tab says noopener noreferrer', () => {
    const offenders = files.flatMap(({ file, text }) =>
      [...text.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)]
        .filter((m) => !/rel="noopener noreferrer"/.test(m[0]))
        .map(() => file),
    );
    expect(offenders).toEqual([]);
  });

  it('only NEXT_PUBLIC_* variables (public by design) and NODE_ENV are read from the environment', () => {
    const used = new Set<string>();
    // The one exception: REVALIDATE_SECRET, read only by the server route handler src/app/api/revalidate/route.ts (never
    // bundled for the browser: a route handler runs on the server only). docs/SECURITY.md 3.2.
    const serverOnly = (file: string) => file === 'app/api/revalidate/route.ts';
    for (const { file, text } of files) for (const m of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) if (!(serverOnly(file) && m[1] === 'REVALIDATE_SECRET')) used.add(m[1]);
    const secretsLookingOnes = [...used].filter((name) => !name.startsWith('NEXT_PUBLIC_') && name !== 'NODE_ENV' && name !== 'NEXT_PHASE'); // NEXT_PHASE: Next's own build-phase flag
    expect(secretsLookingOnes).toEqual([]);
  });

  it('nothing in the app stores credentials or tokens in cookies/localStorage', () => {
    const bad = files.filter(({ text }) => /document\.cookie/.test(text) || /localStorage\.setItem\(\s*['"`][^'"`]*(token|password|secret|jwt)/i.test(text));
    expect(bad.map((f) => f.file)).toEqual([]);
  });
});
