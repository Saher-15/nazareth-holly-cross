/** Dates and times of the site are Nazareth's, wherever the visitor is (broadcasts, the verse of the day). */
export const NAZARETH_TIME_ZONE = 'Asia/Jerusalem';

/**
 * The locale every date and time of a site language is formatted with. Arabic uses the Levantine month names that
 * Nazareth uses (`ar-PS`: "تشرين الأول", where plain `ar` gives the Egyptian "أكتوبر"); like every language it keeps
 * Western digits (`-u-nu-latn`, docs/GLOSSARY.md "Numbers"). The other languages are formatted as they are.
 */
export function dateLocale(locale: string): string {
  return locale === 'ar' ? 'ar-PS-u-nu-latn' : locale;
}

/** A date or time in the page language (see `dateLocale`), always with Western digits. */
export function formatDateTime(value: Date | number, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { numberingSystem: 'latn', ...options }).format(value);
}
