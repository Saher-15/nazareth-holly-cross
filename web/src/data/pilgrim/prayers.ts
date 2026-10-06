// Rules of the prayer wall (/prayers), free of React so they can be unit tested.

import { COUNTRY_CODES, countryName } from '@/components/checkout/countries';

/** The categories the API accepts (server/model/prayer.js). The value is what is sent; labels are messages. */
export const PRAYER_CATEGORIES = ['Peace', 'Health', 'Gratitude', 'Family', 'Personal', 'World Peace'] as const;
export type PrayerCategory = (typeof PRAYER_CATEGORIES)[number];

/** Message key suffix of a category: "World Peace" -> "worldPeace". */
export const categoryKey = (category: string) => category.replace(/\s+(\w)/g, (_, c: string) => c.toUpperCase()).replace(/^\w/, (c) => c.toLowerCase());

export const isCategory = (value: unknown): value is PrayerCategory =>
  typeof value === 'string' && (PRAYER_CATEGORIES as readonly string[]).includes(value);

export const PRAYERS_PER_PAGE = 12;

export const PRAYER_RULES = {
  name: { min: 2, max: 100 },
  country: { min: 2, max: 100 },
  prayer: { min: 5, max: 1000 },
} as const;

export type PrayerField = 'name' | 'country' | 'prayer';
export type PrayerValues = Record<PrayerField, string> & { category: PrayerCategory };
export type PrayerErrorKey = 'required' | 'tooShort' | 'tooLong' | 'noLinks';
export type PrayerFieldError = { key: PrayerErrorKey; values?: { min?: number; max?: number } };
export type PrayerErrors = Partial<Record<PrayerField, PrayerFieldError>>;

export const emptyPrayer: PrayerValues = { name: '', country: '', prayer: '', category: 'Personal' };

// Web addresses, e-mail addresses and HTML tags are not wanted on a public wall of prayers: they are how spam and
// personal contact details get posted.
const LINK = /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|info|ru|biz|xyz|io|co|il)\b)\S*/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const HTML = /<\/?[a-z][^>]*>/i;

export const containsLinkOrMarkup = (text: string) => LINK.test(text) || EMAIL.test(text) || HTML.test(text);

export function validatePrayerField(field: PrayerField, raw: string): PrayerFieldError | undefined {
  const value = raw.trim();
  // The country is chosen from the list (an ISO 3166-1 code), never typed.
  if (field === 'country') return COUNTRY_CODES.includes(value) ? undefined : { key: 'required' };
  const rule = PRAYER_RULES[field];
  if (!value) return { key: 'required' };
  if (value.length < rule.min) return { key: 'tooShort', values: { min: rule.min } };
  if (value.length > rule.max) return { key: 'tooLong', values: { max: rule.max } };
  if (containsLinkOrMarkup(value)) return { key: 'noLinks' };
  return undefined;
}

export const PRAYER_FIELDS: readonly PrayerField[] = ['name', 'country', 'prayer'];

export function validatePrayer(values: PrayerValues): PrayerErrors {
  const errors: PrayerErrors = {};
  for (const field of PRAYER_FIELDS) {
    const error = validatePrayerField(field, values[field]);
    if (error) errors[field] = error;
  }
  return errors;
}

export const firstInvalidPrayerField = (errors: PrayerErrors) => PRAYER_FIELDS.find((f) => errors[f]);

/**
 * The body POST /prayer/create expects. The country is sent by its English name (like the orders), so the admin list
 * and the prayers saved before the list existed read the same; the wall shows it in the visitor's language.
 */
export const toPrayerPayload = (values: PrayerValues) => ({
  name: values.name.trim(),
  country: COUNTRY_CODES.includes(values.country) ? countryName(values.country, 'en') : values.country.trim(),
  prayer: values.prayer.trim(),
  category: values.category,
});

export type PrayerSubmitError = 'rateLimited' | 'invalid' | 'network' | 'server';

export function prayerSubmitError(status: number): PrayerSubmitError {
  if (status === 429) return 'rateLimited';
  if (status === 0) return 'network';
  if (status >= 400 && status < 500) return 'invalid';
  return 'server';
}

/**
 * Text from the wall as it is shown. The API stores whatever visitors sent, so everything displayed passes here:
 * control characters go, blank-line runs shrink, web and e-mail addresses are masked (never turned into links),
 * and a very long text is cut.
 */
export function displayText(raw: string, maxLength: number = PRAYER_RULES.prayer.max, mask = '…'): string {
  const cleaned = raw
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‎‏‪-‮⁦-⁩]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(new RegExp(EMAIL.source, 'g'), mask)
    .replace(new RegExp(LINK.source, 'gi'), mask)
    .trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength).trimEnd()}…` : cleaned;
}

// English country name -> ISO code, built once (the English names are what the form sends and the API stores).
let englishToCode: Map<string, string> | null = null;
function codeOfEnglishName(name: string): string | undefined {
  englishToCode ??= new Map(COUNTRY_CODES.map((code) => [countryName(code, 'en').toLowerCase(), code]));
  return englishToCode.get(name.trim().toLowerCase());
}

/**
 * The country of a prayer as the wall shows it: a known country in the visitor's language; any other text (prayers
 * saved before the list existed) cleaned like the rest of the wall.
 */
export function wallCountry(stored: string, locale: string): string {
  const code = codeOfEnglishName(stored);
  return code ? countryName(code, locale) : displayText(stored, 100);
}
