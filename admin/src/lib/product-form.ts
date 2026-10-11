// Product form values <-> API body, with the same limits the server enforces (so errors show before the request).
import { storedLength } from './entities';
import { isImageUrl, isShopImageUrl } from './firebase-upload';
import type { Product } from './api';

/** The categories the API accepts (services/catalog.js CATEGORIES); empty = the site works it out from the name. */
export const CATEGORIES = ['stained-glass', 'rosaries', 'necklaces', 'bracelets', 'bibles', 'crosses', 'holy-land', 'gifts'] as const;

export const isCategory = (value: string | null | undefined): value is (typeof CATEGORIES)[number] => (CATEGORIES as readonly string[]).includes(value ?? '');

export type ProductValues = {
  name: string;
  price: string;
  description: string;
  category: string;
  stock: string; // '' means unlimited
  rate: string;
  colors: string; // comma separated
  img: string;
  additional: string[];
};

export type FieldErrors = Partial<Record<'name' | 'price' | 'description' | 'category' | 'stock' | 'rate' | 'colors' | 'img' | 'additional', string>>;

export const MAX_PRICE = 10_000;

/**
 * A price as people type it: digits, then a point OR a comma and one or two decimals ("24.50", "24,50", "24,5", "24").
 * A comma is a decimal comma, never a thousands separator: "24,50" is 24.50 (the browser's number field used to drop
 * the comma and read 2450). Anything else ("1.234,50", "1,234", "24.505", "$24") is refused, never guessed.
 * Returns the number, or the reason: 'format' (not a price as written) or 'price' (outside 0.01 to 10,000).
 */
export function parsePrice(text: string): { value: number } | { error: 'format' | 'price' } {
  const clean = text.trim().replace(/\s+/g, '');
  if (!clean) return { error: 'price' };
  const match = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(clean);
  if (!match) return { error: 'format' };
  const value = Number(`${match[1]}.${(match[2] ?? '0').padEnd(2, '0')}`);
  if (!Number.isFinite(value) || value < 0.01 || value > MAX_PRICE) return { error: 'price' };
  return { value: Math.round(value * 100) / 100 };
}

/** Whether a price change is big enough to ask first (a slip of a decimal mark or of a zero): 3 times or more. */
export function priceJump(before: number | null, after: number): boolean {
  if (before === null || !Number.isFinite(before) || before <= 0) return after >= 1000;
  return after / before >= 3 || before / after >= 3;
}

export const EMPTY_PRODUCT: ProductValues = { name: '', price: '', description: '', category: '', stock: '', rate: '1', colors: '', img: '', additional: [] };

export function valuesFrom(product: Product): ProductValues {
  return {
    name: product.name,
    price: String(product.price),
    description: product.description ?? '',
    category: product.category ?? '',
    stock: product.stock === null || product.stock === undefined ? '' : String(product.stock),
    rate: String(product.rate ?? 1),
    colors: (product.color ?? []).join(', '),
    img: product.img,
    additional: [...(product.additionalImageUrls ?? [])],
  };
}

/** The API's limits (route/admin/products.js PRODUCT_FIELDS): at most 20 colours of 1 to 50 characters each. */
export const MAX_COLORS = 20;
export const MAX_COLOR_LENGTH = 50;

/**
 * Every colour typed, in order, once: "natural, dark brown, Natural" is two colours (the shop showed three designs).
 * The first spelling is kept. Nothing else is dropped silently: more than MAX_COLORS is a validation error.
 */
export function parseColors(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(',')
    .map((c) => c.trim())
    .filter((c) => {
      const key = c.toLocaleLowerCase();
      if (!c || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Returns error codes (translated by the form); an empty object means the values are valid. Text lengths are counted
 * as the API counts them (lib/entities.ts storedLength: "&" is 5 characters once sanitised).
 */
/**
 * `saved`: the product as it is stored (when editing). A photo address that is already saved stays accepted even when it
 * is not on a host the website can show (an older product); a NEW address must be (lib/firebase-upload.ts isShopImageUrl,
 * the API's rule too).
 */
export function validateProduct(v: ProductValues, saved?: Pick<ProductValues, 'img' | 'additional'>): FieldErrors {
  const errors: FieldErrors = {};
  const name = v.name.trim();
  if (name.length < 2 || storedLength(name) > 200) errors.name = 'name';
  const price = parsePrice(v.price);
  if ('error' in price) errors.price = price.error === 'format' ? 'priceFormat' : 'price';
  if (storedLength(v.description.trim()) > 2000) errors.description = 'description';
  if (v.category !== '' && !(CATEGORIES as readonly string[]).includes(v.category)) errors.category = 'category';
  if (v.stock.trim() !== '' && (!/^\d+$/.test(v.stock.trim()) || Number(v.stock) > 1_000_000)) errors.stock = 'stock';
  const rate = Number(v.rate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 5) errors.rate = 'rate';
  const colors = parseColors(v.colors);
  if (colors.length > MAX_COLORS || colors.some((c) => storedLength(c) > MAX_COLOR_LENGTH)) errors.colors = 'colors';
  const img = v.img.trim();
  if (!isImageUrl(img)) errors.img = 'img';
  else if (img !== saved?.img?.trim() && !isShopImageUrl(img)) errors.img = 'imgHost';
  const extra = v.additional.map((u) => u.trim()).filter(Boolean);
  const known = new Set((saved?.additional ?? []).map((u) => u.trim()));
  if (extra.length > 5 || extra.some((u) => !isImageUrl(u))) errors.additional = 'additional';
  else if (extra.some((u) => !known.has(u) && !isShopImageUrl(u))) errors.additional = 'imgHost';
  return errors;
}

export function toBody(v: ProductValues, uuid: string) {
  return {
    name: v.name.trim(),
    price: (() => { const p = parsePrice(v.price); return 'value' in p ? p.value : NaN; })(),
    img: v.img.trim(),
    additionalImageUrls: v.additional.map((u) => u.trim()).filter(Boolean).slice(0, 5),
    description: v.description.trim(),
    uuidv4_: uuid,
    rate: Number(v.rate),
    color: parseColors(v.colors),
    stock: v.stock.trim() === '' ? null : Number(v.stock),
    category: v.category || null,
  };
}
