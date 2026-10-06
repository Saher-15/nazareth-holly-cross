// Formatting helpers. Dates are printed on the server in one configured time zone so the server render and the
// browser can never disagree (no hydration mismatch), and so the audit log reads the same for every admin.

import type { Locale } from '@/i18n/locales';

const TAGS: Record<Locale, string> = {
  en: 'en-GB',
  he: 'he-IL',
  ar: 'ar-u-nu-latn', // Latin digits: prices, order numbers and dates are read as numbers in every language
};

export function localeTag(locale: Locale): string {
  return TAGS[locale] ?? TAGS.en;
}

export function defaultTimeZone(): string {
  return process.env.ADMIN_TIMEZONE || 'Asia/Jerusalem';
}

export function formatMoney(value: number | null | undefined, locale: Locale = 'en', whole = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat(localeTag(locale), {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, locale: Locale = 'en'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat(localeTag(locale)).format(value);
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(iso: string | null | undefined, locale: Locale = 'en', timeZone = defaultTimeZone()): string {
  const date = parse(iso);
  if (!date) return '-';
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'medium', timeZone }).format(date);
}

export function formatDateTime(iso: string | null | undefined, locale: Locale = 'en', timeZone = defaultTimeZone()): string {
  const date = parse(iso);
  if (!date) return '-';
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date);
}

/** "Mar 4" style label for a chart axis from a YYYY-MM-DD string (no time zone shifting: the day is the day). */
export function formatDay(day: string, locale: Locale = 'en'): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Intl.DateTimeFormat(localeTag(locale), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function truncate(text: string | null | undefined, max = 80): string {
  const value = (text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

export function shortId(id: string): string {
  return id.length > 8 ? id.slice(-8) : id;
}

export function fullName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last].filter(Boolean).join(' ').trim();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase();
}

/** Minutes and seconds as m:ss for the idle-timeout countdown. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * A mailto: link for an address a visitor typed, or null when it does not look like one. The address is encoded, so
 * characters the public forms allow in the local part (? and &) cannot add Cc, Bcc or body parameters to the mail
 * the admin is about to write.
 */
export function mailtoHref(email: string | null | undefined): string | null {
  const value = (email ?? '').trim();
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${encodeURIComponent(value)}` : null;
}

/**
 * Where a site reviewer is from. Reviews have a `place` since 2026-10-06; the old site sent the reviewer's country in
 * `email`, so an `email` that is not an address is the place (the same rule as the API's placeOf, route/reviewRoute.js).
 */
export function reviewerPlace(review: { place?: string | null; email?: string | null }): string {
  const place = (review.place ?? '').trim();
  if (place) return place;
  const email = (review.email ?? '').trim();
  return email.includes('@') ? '' : email;
}

/** A site reviewer's e-mail address, only when the `email` field really holds one (see reviewerPlace). */
export function reviewerEmail(review: { email?: string | null }): string {
  const email = (review.email ?? '').trim();
  return email.includes('@') ? email : '';
}

/** A mailto/tel-safe plain string for display only; never used to build HTML. */
export function cleanText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
