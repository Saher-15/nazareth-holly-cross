import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../../mock-api/csv.mjs';
import { base32Decode, base32Encode, totpCode, verifyTotp } from '../../mock-api/totp.mjs';
import { downloadUrl, isImageUrl, storagePath, UploadError, validateFile } from '@/lib/firebase-upload';
import { cleanText, formatCountdown, formatDate, formatDateTime, formatDay, formatMoney, formatNumber, fullName, initials, shortId, truncate } from '@/lib/format';
import { filterQuery, readLimitedText, BodyTooLarge } from '@/lib/http';
import { passwordProblem } from '@/lib/password';
import { EMPTY_PRODUCT, parseColors, toBody, validateProduct, valuesFrom, type ProductValues } from '@/lib/product-form';
import { MAX_PROXY_BODY_BYTES, resolveProxyPath } from '@/lib/proxy-allow';
import { can, isRole, navFor, pageNeeds } from '@/lib/roles';

describe('roles', () => {
  it('owner can do everything, editor writes, viewer only reads', () => {
    expect(can('owner', 'manageUsers')).toBe(true);
    expect(can('owner', 'viewAudit')).toBe(true);
    expect(can('owner', 'deleteOrders')).toBe(true);
    expect(can('editor', 'write')).toBe(true);
    expect(can('editor', 'manageUsers')).toBe(false);
    expect(can('editor', 'deleteOrders')).toBe(false);
    expect(can('viewer', 'write')).toBe(false);
    expect(can(null, 'write')).toBe(false);
    expect(can(undefined, 'viewAudit')).toBe(false);
  });
  it('navigation and page guards follow the role', () => {
    const ids = (role: 'owner' | 'editor' | 'viewer') => navFor(role).map((n) => n.id);
    expect(ids('owner')).toContain('users');
    expect(ids('owner')).toContain('audit');
    expect(ids('editor')).not.toContain('users');
    expect(ids('viewer')).not.toContain('audit');
    expect(ids('viewer')).toContain('orders');
    expect(pageNeeds('/users')).toBe('manageUsers');
    expect(pageNeeds('/audit')).toBe('viewAudit');
    expect(pageNeeds('/orders')).toBeUndefined();
    expect(pageNeeds('/')).toBeUndefined();
    expect(isRole('owner')).toBe(true);
    expect(isRole('root')).toBe(false);
    expect(isRole(3)).toBe(false);
  });
});

describe('proxy allow-list', () => {
  it('maps allowed calls to API paths', () => {
    expect(resolveProxyPath(['orders'], 'GET')).toBe('/admin/orders');
    expect(resolveProxyPath(['orders', 'abc123'], 'PATCH')).toBe('/admin/orders/abc123');
    expect(resolveProxyPath(['products'], 'POST')).toBe('/admin/products');
    expect(resolveProxyPath(['products', 'p1'], 'PUT')).toBe('/admin/products/p1');
    expect(resolveProxyPath(['auth', 'totp', 'enable'], 'POST')).toBe('/admin/auth/totp/enable');
    expect(resolveProxyPath(['export', 'orders.csv'], 'GET')).toBe('/admin/export/orders.csv');
    expect(resolveProxyPath(['site-reviews', 'r1'], 'DELETE')).toBe('/admin/site-reviews/r1');
    expect(resolveProxyPath(['users'], 'POST')).toBe('/admin/users');
  });
  it('refuses sign-in, unknown routes, wrong methods and path tricks', () => {
    for (const [segments, method] of [
      [['auth', 'login'], 'POST'],
      [['auth', 'logout'], 'POST'],
      [['auth', 'password'], 'GET'],
      [['orders'], 'POST'],
      [['orders', 'a'], 'PUT'],
      [['dashboard'], 'POST'],
      [['export', 'users.csv'], 'GET'],
      [['secrets'], 'GET'],
      [['orders', '..'], 'GET'],
      [['orders', 'a/b'], 'GET'],
      [['orders', 'a%2Fb'], 'GET'],
      [['orders', 'a?x=1'], 'GET'],
      [['orders', 'x'.repeat(65)], 'GET'],
      [['a', 'b', 'c', 'd'], 'GET'],
      [[], 'GET'],
      [undefined, 'GET'],
    ] as [string[] | undefined, string][]) {
      expect(resolveProxyPath(segments, method), `${segments?.join('/')} ${method}`).toBeNull();
    }
    expect(MAX_PROXY_BODY_BYTES).toBeGreaterThan(1024);
  });
  it('filterQuery keeps only the list parameters and drops long values', () => {
    expect(filterQuery(new URLSearchParams('page=2&size=10&q=abc&token=zzz&__proto__=1&status=pending&sort=-x&actor=a&action=b'))).toBe('?page=2&size=10&q=abc&status=pending&sort=-x&actor=a&action=b');
    expect(filterQuery(new URLSearchParams(`q=${'x'.repeat(101)}`))).toBe('');
    expect(filterQuery(new URLSearchParams(''))).toBe('');
  });
  it('readLimitedText refuses an oversized body, declared or actual', async () => {
    const small = new Request('http://x/', { method: 'POST', body: 'hello' });
    await expect(readLimitedText(small, 10)).resolves.toBe('hello');
    await expect(readLimitedText(new Request('http://x/', { method: 'POST', body: 'x'.repeat(50) }), 10)).rejects.toBeInstanceOf(BodyTooLarge);
    await expect(readLimitedText(new Request('http://x/', { method: 'POST', body: 'x', headers: { 'content-length': '999' } }), 10)).rejects.toBeInstanceOf(BodyTooLarge);
  });
});

describe('format helpers', () => {
  it('money and numbers', () => {
    expect(formatMoney(1234.5, 'en')).toBe('$1,234.50');
    expect(formatMoney(1234.5, 'en', true)).toBe('$1,235');
    expect(formatMoney(null)).toBe('-');
    expect(formatMoney(Number.NaN)).toBe('-');
    expect(formatNumber(1234567, 'en')).toBe('1,234,567');
    expect(formatNumber(undefined)).toBe('-');
    expect(formatMoney(1234.5, 'ar')).toContain('1,234.50'); // Latin digits in Arabic too
  });
  it('dates use the configured zone and survive bad input', () => {
    expect(formatDate('2026-03-04T23:30:00Z', 'en', 'UTC')).toBe('4 Mar 2026');
    expect(formatDate('2026-03-04T23:30:00Z', 'en', 'Asia/Jerusalem')).toBe('5 Mar 2026');
    expect(formatDateTime('2026-03-04T10:05:00Z', 'en', 'UTC')).toContain('10:05');
    expect(formatDate('not a date')).toBe('-');
    expect(formatDate(null)).toBe('-');
    expect(formatDay('2026-03-04', 'en')).toBe('4 Mar');
    expect(formatDay('garbage', 'en')).toBe('garbage');
  });
  it('small text helpers', () => {
    expect(truncate('  a   b   c ', 80)).toBe('a b c');
    expect(truncate('x'.repeat(100), 10)).toHaveLength(10);
    expect(truncate(null)).toBe('');
    expect(shortId('0123456789abcdef')).toBe('89abcdef');
    expect(shortId('abc')).toBe('abc');
    expect(fullName('Ada', 'Lovelace')).toBe('Ada Lovelace');
    expect(fullName('Ada', null)).toBe('Ada');
    expect(initials('owner')).toBe('O');
    expect(initials('Ada King Lovelace')).toBe('AL');
    expect(formatCountdown(125)).toBe('2:05');
    expect(formatCountdown(-3)).toBe('0:00');
    expect(cleanText(5)).toBe('');
    expect(cleanText('x')).toBe('x');
  });
});

describe('CSV cells (export is formula-injection safe)', () => {
  it('prefixes cells that start with = + - @ tab or CR, quotes everything, doubles quotes', () => {
    for (const evil of ['=SUM(A1)', '+1+1', '-2+3', '@cmd', '\tx', '\rx']) expect(csvCell(evil)).toBe(`"'${evil}"`);
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(12.5)).toBe('"12.5"');
    expect(csvCell('safe = text')).toBe('"safe = text"');
  });
  it('writes a header, CRLF rows and a BOM for Excel', () => {
    const csv = toCsv([{ header: 'Name', value: (r: { n: string }) => r.n }], [{ n: '=1+1' }, { n: 'ok' }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('"Name"\r\n"\'=1+1"\r\n"ok"\r\n');
  });
});

describe('TOTP (RFC 6238, SHA-1, 6 digits)', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  it('matches the RFC test vectors', () => {
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(totpCode(secret, 59_000)).toBe('287082');
    expect(totpCode(secret, 1_111_111_109_000)).toBe('081804');
    expect(totpCode(secret, 1_111_111_111_000)).toBe('050471');
    expect(totpCode(secret, 1_234_567_890_000)).toBe('005924');
    expect(totpCode(secret, 2_000_000_000_000)).toBe('279037');
  });
  it('base32 round-trips; verification allows one step of drift only', () => {
    const bytes = Buffer.from([1, 2, 3, 250, 255, 0, 9]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    const t = 1_700_000_000_000;
    expect(verifyTotp(secret, totpCode(secret, t), t)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, t - 30_000), t)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, t + 30_000), t)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, t - 120_000), t)).toBe(false);
    expect(verifyTotp(secret, '12345', t)).toBe(false);
    expect(verifyTotp(secret, 'abcdef', t)).toBe(false);
  });
});

describe('password policy', () => {
  it('requires 12 characters, not the username, not a common password', () => {
    expect(passwordProblem('short', 'owner')).toBe('short');
    expect(passwordProblem('a'.repeat(201), 'owner')).toBe('long');
    expect(passwordProblem('OwnerOwnerOwner', 'ownerownerowner')).toBe('username');
    expect(passwordProblem('Password1234', 'x')).toBe('common');
    expect(passwordProblem('A-Fine-Passphrase-1', 'owner')).toBeNull();
  });
});

describe('product form', () => {
  const ok: ProductValues = { ...EMPTY_PRODUCT, name: 'Candle', price: '19.5', img: 'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media', stock: '4', rate: '2.5', colors: ' white , gold,,' };
  it('accepts valid values and builds the API body', () => {
    expect(validateProduct(ok)).toEqual({});
    expect(toBody({ ...ok, additional: ['https://a.example/1.png', ' '], category: ' Candles ' }, 'uuid-1')).toEqual({
      name: 'Candle',
      price: 19.5,
      img: ok.img,
      additionalImageUrls: ['https://a.example/1.png'],
      description: '',
      uuidv4_: 'uuid-1',
      rate: 2.5,
      color: ['white', 'gold'],
      stock: 4,
      category: 'Candles',
    });
    expect(toBody({ ...ok, stock: '', category: '' }, 'u')).toMatchObject({ stock: null, category: null });
  });
  it('reports every problem', () => {
    const errors = validateProduct({ ...EMPTY_PRODUCT, name: 'x', price: '0', stock: '-1', rate: '9', img: 'javascript:alert(1)', additional: ['http://insecure.example/a.png'], description: 'x'.repeat(2001), colors: 'y'.repeat(41), category: 'z'.repeat(61) });
    expect(Object.keys(errors).sort()).toEqual(['additional', 'category', 'colors', 'description', 'img', 'name', 'price', 'rate', 'stock']);
    expect(validateProduct({ ...ok, price: '10001' }).price).toBe('price');
    expect(validateProduct({ ...ok, stock: '1.5' }).stock).toBe('stock');
    expect(validateProduct({ ...ok, additional: Array(6).fill('https://a.example/1.png') }).additional).toBe('additional');
  });
  it('round-trips an API product into form values', () => {
    const values = valuesFrom({ id: 'p', name: 'N', price: 3, img: 'https://x/y.png', stock: null, rate: 4, color: ['red'], additionalImageUrls: ['https://x/z.png'], category: null } as never);
    expect(values).toMatchObject({ name: 'N', price: '3', stock: '', rate: '4', colors: 'red', additional: ['https://x/z.png'], category: '' });
    expect(parseColors('a,b,c,d,e,f,g,h,i,j,k,l,m,n')).toHaveLength(12);
  });
});

describe('photo upload helpers', () => {
  it('accepts https anywhere and http only for localhost', () => {
    expect(isImageUrl('https://firebasestorage.googleapis.com/x')).toBe(true);
    expect(isImageUrl('http://localhost:3901/mock/a.svg')).toBe(true);
    expect(isImageUrl('http://127.0.0.1/a.png')).toBe(true);
    for (const bad of ['http://example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//example.com/a.png', 'a.png', '', 'https://' + 'x'.repeat(1000)]) expect(isImageUrl(bad)).toBe(false);
  });
  it('validates type and size, and builds the same paths and addresses as the old admin', () => {
    expect(() => validateFile({ type: 'image/png', size: 1000 })).not.toThrow();
    expect(() => validateFile({ type: 'application/pdf', size: 1000 })).toThrowError(UploadError);
    expect(() => validateFile({ type: 'image/png', size: 9 * 1024 * 1024 })).toThrowError(UploadError);
    expect(storagePath('u1', 'f1')).toBe('images/u1/f1');
    expect(downloadUrl('bucket.appspot.com', 'images/u1/f1', 'tok')).toBe('https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/images%2Fu1%2Ff1?alt=media&token=tok');
  });
});
