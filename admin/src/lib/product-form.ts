// Product form values <-> API body, with the same limits the server enforces (so errors show before the request).
import { isImageUrl } from './firebase-upload';
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

export function parseColors(text: string): string[] {
  return text
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/** Returns error codes (translated by the form); an empty object means the values are valid. */
export function validateProduct(v: ProductValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = v.name.trim();
  if (name.length < 2 || name.length > 200) errors.name = 'name';
  const price = Number(v.price);
  if (!v.price.trim() || !Number.isFinite(price) || price < 0.01 || price > 10_000) errors.price = 'price';
  if (v.description.length > 2000) errors.description = 'description';
  if (v.category !== '' && !(CATEGORIES as readonly string[]).includes(v.category)) errors.category = 'category';
  if (v.stock.trim() !== '' && (!/^\d+$/.test(v.stock.trim()) || Number(v.stock) > 1_000_000)) errors.stock = 'stock';
  const rate = Number(v.rate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 5) errors.rate = 'rate';
  if (parseColors(v.colors).some((c) => c.length > 40)) errors.colors = 'colors';
  if (!isImageUrl(v.img.trim())) errors.img = 'img';
  const extra = v.additional.map((u) => u.trim()).filter(Boolean);
  if (extra.length > 5 || extra.some((u) => !isImageUrl(u))) errors.additional = 'additional';
  return errors;
}

export function toBody(v: ProductValues, uuid: string) {
  return {
    name: v.name.trim(),
    price: Math.round(Number(v.price) * 100) / 100,
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
