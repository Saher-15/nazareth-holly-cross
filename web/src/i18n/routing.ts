import { defineRouting } from 'next-intl/routing';

// Every language the site is published in. English is the default and the
// fallback for any message a translation is still missing.
export const locales = ['en', 'fr', 'es', 'de', 'it', 'pt', 'pl', 'ru', 'el', 'he', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

// Written right-to-left.
export const rtlLocales: readonly Locale[] = ['he', 'ar'];
export const isRtl = (locale: string) => (rtlLocales as readonly string[]).includes(locale);

// Each language named in itself, for the language switcher.
export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  pl: 'Polski',
  ru: 'Русский',
  el: 'Ελληνικά',
  he: 'עברית',
  ar: 'العربية',
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always', // every URL carries its language: /en/shop, /he/shop
});
