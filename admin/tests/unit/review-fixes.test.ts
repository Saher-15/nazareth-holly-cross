// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { auditPage, dashboardSchema, productWriteSchema, userSchema } from '@/lib/api';
import { clearAllDrafts, clearDraft, DRAFT_MAX_AGE_MS, loadDraft, saveDraft } from '@/lib/drafts';
import { isImageUrl, isShopImageUrl } from '@/lib/firebase-upload';
import { internalHref } from '@/lib/links';
import { EMPTY_PRODUCT, parseColors, parsePrice, priceJump, toBody, validateProduct, type ProductValues } from '@/lib/product-form';

// The dashboard review (review 04): prices typed with a comma, photo hosts the website can show, drafts that survive an
// ended sign-in, the links the unsaved-changes and live guards hold back, and the new API fields.

const FIREBASE = 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media&token=t';

describe('parsePrice: what people type', () => {
  it.each([
    ['24.50', 24.5], ['24,50', 24.5], ['24,5', 24.5], ['24', 24], [' 24 ', 24], ['0,07', 0.07], ['10000', 10000], ['9 999,99', 9999.99],
  ])('%s is %d (a decimal comma is never a thousands separator)', (text, value) => {
    expect(parsePrice(text)).toEqual({ value });
  });

  it.each([['1.234,50'], ['1,234'], ['24.505'], ['$24'], ['24,'], ['-3'], ['2e3'], ['24.5.0'], ['abc']])('%s is refused, never guessed', (text) => {
    expect(parsePrice(text)).toEqual({ error: 'format' });
  });

  it('an empty or out-of-range price is "enter a price between 0.01 and 10,000"', () => {
    expect(parsePrice('')).toEqual({ error: 'price' });
    expect(parsePrice('0')).toEqual({ error: 'price' });
    expect(parsePrice('10000,01')).toEqual({ error: 'price' });
  });

  it('the form sends 24.5 for "24,50" (it used to send 2450) and says which error', () => {
    const v: ProductValues = { ...EMPTY_PRODUCT, name: 'Olive cross', price: '24,50', img: FIREBASE };
    expect(validateProduct(v)).toEqual({});
    expect(toBody(v, 'u').price).toBe(24.5);
    expect(validateProduct({ ...v, price: '1.234,50' }).price).toBe('priceFormat');
    expect(validateProduct({ ...v, price: '' }).price).toBe('price');
  });

  it('asks before a price three times higher or lower, or a new one of 1,000 or more', () => {
    expect(priceJump(24.5, 2450)).toBe(true);
    expect(priceJump(24.5, 7)).toBe(true);
    expect(priceJump(24.5, 30)).toBe(false);
    expect(priceJump(null, 2450)).toBe(true);
    expect(priceJump(null, 245)).toBe(false);
  });
});

describe('photos: only the hosts the website can show', () => {
  it('Firebase Storage over https, and local addresses for development', () => {
    expect(isShopImageUrl(FIREBASE)).toBe(true);
    expect(isShopImageUrl('http://localhost:3901/mock/a.svg')).toBe(true);
    expect(isShopImageUrl('https://upload.wikimedia.org/a.jpg')).toBe(false);
    expect(isShopImageUrl(FIREBASE.replace('https:', 'http:'))).toBe(false);
    expect(isImageUrl('https://upload.wikimedia.org/a.jpg')).toBe(true); // a valid address, just not one the site shows
  });

  it('a new photo on another host is refused with its own message; an already saved one stays editable', () => {
    const saved = { img: 'https://example.com/old.jpg', additional: ['https://example.com/old2.jpg'] };
    const v: ProductValues = { ...EMPTY_PRODUCT, name: 'Olive cross', price: '10', ...saved };
    expect(validateProduct(v)).toMatchObject({ img: 'imgHost', additional: 'imgHost' });
    expect(validateProduct(v, saved)).toEqual({});
    expect(validateProduct({ ...v, img: 'https://example.com/new.jpg' }, saved).img).toBe('imgHost');
  });

  it('colours are kept once: "natural, dark brown, Natural" is two', () => {
    expect(parseColors('natural, dark brown, Natural')).toEqual(['natural', 'dark brown']);
  });
});

describe('drafts (sessionStorage)', () => {
  afterEach(() => clearAllDrafts());
  const isText = (value: unknown): value is { text: string } => typeof (value as { text?: unknown } | null)?.text === 'string';

  it('keeps, returns and forgets a draft; a stale or malformed one is dropped', () => {
    saveDraft('product:new', { text: 'half typed' });
    expect(loadDraft('product:new', isText)).toEqual({ text: 'half typed' });
    clearDraft('product:new');
    expect(loadDraft('product:new', isText)).toBeNull();
    saveDraft('product:old', { text: 'old' }, Date.now() - DRAFT_MAX_AGE_MS - 1);
    expect(loadDraft('product:old', isText)).toBeNull();
    saveDraft('product:bad', { other: 1 });
    expect(loadDraft('product:bad', isText)).toBeNull();
  });

  it('a manual sign-out forgets every draft of the tab, and nothing else in sessionStorage', () => {
    sessionStorage.setItem('unrelated', 'x');
    saveDraft('a', { text: '1' });
    saveDraft('b', { text: '2' });
    clearAllDrafts();
    expect(loadDraft('a', isText)).toBeNull();
    expect(loadDraft('b', isText)).toBeNull();
    expect(sessionStorage.getItem('unrelated')).toBe('x');
    sessionStorage.removeItem('unrelated');
  });
});

describe('internalHref: the links the guards hold back', () => {
  const click = (html: string, init: MouseEventInit = {}) => {
    document.body.innerHTML = html;
    const target = document.querySelector('[data-hit]')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    Object.defineProperty(event, 'target', { value: target });
    return internalHref(event, window.location.origin);
  };

  it('a plain click on a link inside the dashboard', () => {
    expect(click('<a href="/orders?q=a"><span data-hit>Orders</span></a>')).toBe('/orders?q=a');
  });

  it.each([
    ['a new tab', '<a href="/orders" target="_blank" data-hit>x</a>', {}],
    ['a download', '<a href="/api/proxy/export/orders.csv" download data-hit>x</a>', {}],
    ['an /api/ address', '<a href="/api/session/logout" data-hit>x</a>', {}],
    ['another site', '<a href="https://example.com/" data-hit>x</a>', {}],
    ['a ctrl-click', '<a href="/orders" data-hit>x</a>', { ctrlKey: true }],
    ['not a link', '<button data-hit>x</button>', {}],
  ])('ignores %s', (_name, html, init) => {
    expect(click(html, init as MouseEventInit)).toBeNull();
  });
});

describe('the new API fields', () => {
  it('users carry their e-mail and lock; older answers without them still parse', () => {
    expect(userSchema.parse({ _id: 'u1', username: 'a', role: 'editor', email: 'a@example.com', lockedUntil: '2026-10-07T08:06:00.000Z' })).toMatchObject({ email: 'a@example.com', lockedUntil: '2026-10-07T08:06:00.000Z' });
    expect(userSchema.parse({ _id: 'u1', username: 'a', role: 'editor' }).email).toBe('');
  });

  it('the audit entry keeps the target type, id and name apart', () => {
    const page = auditPage.parse({ items: [{ _id: 'x', at: '2026-10-07T08:00:00Z', action: 'order.update', target: { type: 'order', id: 'c0000000000000000000003f' }, targetName: '#0000003f' }], total: 1, page: 1, size: 25 });
    expect(page.items[0]).toMatchObject({ targetType: 'order', targetId: 'c0000000000000000000003f', targetName: '#0000003f' });
  });

  it('revenue split and the website refresh answer (an unknown value counts as "off")', () => {
    const totals = { orders: 1, ordersPending: 0, revenue: 10, candles: 0, candlesPending: 0, contacts: 0, contactsOpen: 0, products: 0, productReviews: 0, prayers: 0, reviews: 0 };
    const base = { totals, last30Days: [], topProducts: [], lowStock: [], recent: { orders: [], candles: [], contacts: [] } };
    expect(dashboardSchema.parse(base).totals.revenueUnverified).toBeUndefined();
    expect(dashboardSchema.parse({ ...base, totals: { ...totals, revenueUnverified: 5, ordersUnverified: 1 } }).totals).toMatchObject({ revenueUnverified: 5, ordersUnverified: 1 });
    expect(productWriteSchema.parse({ siteRefresh: 'done' }).siteRefresh).toBe('done');
    expect(productWriteSchema.parse({ siteRefresh: 'weird' }).siteRefresh).toBe('off');
    expect(productWriteSchema.parse({}).siteRefresh).toBeUndefined();
  });
});
