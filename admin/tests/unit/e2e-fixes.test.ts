import { describe, expect, it } from 'vitest';
import { auditSchema, auditPage } from '@/lib/api';
import { clientHintsFrom, forwardedAddress } from '@/lib/client-hints';
import { decodeDeep, decodeEntities } from '@/lib/entities';
import { sniffImageType } from '@/lib/firebase-upload';
import { mailtoHref } from '@/lib/format';
import { CATEGORIES, isCategory, toBody, validateProduct, EMPTY_PRODUCT } from '@/lib/product-form';
import { can } from '@/lib/roles';

// Regression tests for what running the dashboard against the REAL API (server/test-harness) and the security
// review found. Each block names the mismatch or hole it guards.

describe('stored text arrives HTML-escaped (docs/ADMIN.md 4.2): the dashboard decodes it once', () => {
  it('decodes the five entities in one pass', () => {
    expect(decodeEntities('Fish &amp; Loaves &lt;3 &gt; &quot;x&quot; &#39;y&#39;')).toBe('Fish & Loaves <3 > "x" \'y\'');
    expect(decodeEntities('&amp;lt;')).toBe('&lt;'); // never double-decoded
    expect(decodeEntities('plain')).toBe('plain');
  });
  it('decodes every string in a parsed answer and leaves numbers, nulls and dates alone', () => {
    const when = new Date(0);
    expect(decodeDeep({ a: 'Tom &amp; Jerry', n: 3, z: null, list: ['&lt;b&gt;', { deep: 'a &amp; b' }], when })).toEqual({
      a: 'Tom & Jerry', n: 3, z: null, list: ['<b>', { deep: 'a & b' }], when,
    });
  });
});

describe('the audit entry the API really sends: { at, actorName, role, action, target: { type, id }, ua }', () => {
  const entry = { _id: 'a1', at: '2026-10-05T10:00:00.000Z', actorId: 'u1', actorName: 'owner', role: 'owner', action: 'order.update', target: { type: 'order', id: 'abc' }, meta: { done: true }, ipHash: 'h', ua: 'Edge 154 / Windows' };
  it('shows who, what, on what and from which device', () => {
    const parsed = auditSchema.parse(entry);
    expect(parsed).toMatchObject({ id: 'a1', when: entry.at, actorName: 'owner', targetText: 'order:abc', userAgent: 'Edge 154 / Windows' });
  });
  it('still reads the older mock shape, and a failed sign-in with no target', () => {
    expect(auditSchema.parse({ _id: 'a2', createdAt: 'x', actor: 'bob', action: 'auth.login', target: 'bob', userAgent: 'Chrome' })).toMatchObject({ actorName: 'bob', targetText: 'bob', userAgent: 'Chrome' });
    expect(auditSchema.parse({ ...entry, actorName: 'typed-name', target: { type: '', id: '' } })).toMatchObject({ actorName: 'typed-name', targetText: '' });
    expect(auditPage.safeParse({ items: [entry], total: 1, page: 1, size: 50 }).success).toBe(true);
  });
});

describe('CSV export is a bulk copy of personal data: editor and owner only (viewer gets 403 from the API)', () => {
  it('hides the export button from a viewer', () => {
    expect(can('viewer', 'export')).toBe(false);
    expect(can('editor', 'export')).toBe(true);
    expect(can('owner', 'export')).toBe(true);
  });
});

describe('product category: the API accepts one of eight keys or null, not free text', () => {
  it('has the same eight keys as server/services/catalog.js', () => {
    expect([...CATEGORIES]).toEqual(['stained-glass', 'rosaries', 'necklaces', 'bracelets', 'bibles', 'crosses', 'holy-land', 'gifts']);
    expect(isCategory('gifts')).toBe(true);
    expect(isCategory('Candles')).toBe(false);
  });
  it('refuses a made-up category before sending, sends null for "automatic"', () => {
    const base = { ...EMPTY_PRODUCT, name: 'Olive cross', price: '10', img: 'https://example.com/a.jpg' };
    expect(validateProduct({ ...base, category: 'Candles' }).category).toBe('category');
    expect(validateProduct({ ...base, category: 'crosses' })).toEqual({});
    expect(toBody({ ...base, category: '' }, 'u').category).toBeNull();
    expect(toBody({ ...base, category: 'crosses' }, 'u').category).toBe('crosses');
  });
});

describe('the visitor address passed to the API cannot be forged by the visitor', () => {
  const headers = (h: Record<string, string>) => ({ get: (name: string) => h[name.toLowerCase()] ?? null });
  it('trusts Netlify\'s header, and X-Forwarded-For only when told to', () => {
    expect(forwardedAddress(headers({ 'x-nf-client-connection-ip': '203.0.113.9', 'x-forwarded-for': '6.6.6.6' }), false)).toBe('203.0.113.9');
    expect(forwardedAddress(headers({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1' }), false)).toBe('');
    expect(forwardedAddress(headers({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1' }), true)).toBe('6.6.6.6');
    expect(forwardedAddress(headers({ 'x-forwarded-for': '2001:db8::1' }), true)).toBe('2001:db8::1');
  });
  it('drops anything that is not an address, and clips and cleans the user agent', () => {
    expect(forwardedAddress(headers({ 'x-nf-client-connection-ip': 'evil\r\nX: 1' }), false)).toBe('');
    expect(forwardedAddress(headers({ 'x-forwarded-for': '<script>' }), true)).toBe('');
    const hints = clientHintsFrom(headers({ 'user-agent': `Mozilla\r\nX-Evil: 1${'a'.repeat(400)}` }), false);
    expect(hints['User-Agent']).not.toMatch(/[\r\n]/);
    expect(hints['User-Agent'].length).toBeLessThanOrEqual(300);
    expect(hints['X-Forwarded-For']).toBeUndefined();
  });
});

describe('mailto links for addresses visitors typed', () => {
  it('encodes the address so ? and & cannot add Cc/Bcc/body parameters', () => {
    expect(mailtoHref('anna@example.com')).toBe('mailto:anna%40example.com');
    expect(mailtoHref('a?cc=x&bcc=y@example.com')).not.toMatch(/\?cc=|&body=/);
    expect(mailtoHref('not an address')).toBeNull();
    expect(mailtoHref('')).toBeNull();
    expect(mailtoHref(null)).toBeNull();
  });
});

describe('product photo upload: the bytes decide, not the file name', () => {
  const blob = (bytes: number[]) => new Blob([new Uint8Array(bytes)]);
  const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
  it('recognises JPEG, PNG, GIF, WebP and AVIF', async () => {
    expect(await sniffImageType(blob([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(await sniffImageType(blob([0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe('image/png');
    expect(await sniffImageType(blob(ascii('GIF89a...')))).toBe('image/gif');
    expect(await sniffImageType(blob([...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBPVP8 ')]))).toBe('image/webp');
    expect(await sniffImageType(blob([0, 0, 0, 0x20, ...ascii('ftypavif')]))).toBe('image/avif');
  });
  it('refuses HTML, SVG and scripts renamed to .png, and an empty file', async () => {
    expect(await sniffImageType(blob(ascii('<html><script>alert(1)</script>')))).toBeNull();
    expect(await sniffImageType(blob(ascii('<svg xmlns="http://www.w3.org/2000/svg" onload="x()">')))).toBeNull();
    expect(await sniffImageType(blob(ascii('MZ\u0090\u0000 an executable')))).toBeNull();
    expect(await sniffImageType(blob([]))).toBeNull();
  });
});
