import { defineRouting } from 'next-intl/routing';

// Every language the site is published in. English is the default and the
// fallback for any message a translation is still missing.
export const locales = ['en', 'fr', 'es', 'de', 'it', 'pt', 'pl', 'ru', 'uk', 'ro', 'nl', 'el', 'he', 'ar'] as const;
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
  uk: 'Українська',
  ro: 'Română',
  nl: 'Nederlands',
  el: 'Ελληνικά',
  he: 'עברית',
  ar: 'العربية',
};

// The language_TERRITORY form Open Graph (Facebook, WhatsApp, LinkedIn) expects for og:locale.
// Portuguese is the Brazilian text (see docs/GLOSSARY.md); Arabic uses the one code Facebook knows.
export const openGraphLocales: Record<Locale, string> = {
  en: 'en_US',
  fr: 'fr_FR',
  es: 'es_ES',
  de: 'de_DE',
  it: 'it_IT',
  pt: 'pt_BR',
  pl: 'pl_PL',
  ru: 'ru_RU',
  uk: 'uk_UA',
  ro: 'ro_RO',
  nl: 'nl_NL',
  el: 'el_GR',
  he: 'he_IL',
  ar: 'ar_AR',
};

// Accept-Language values with no site in that language but a clearly better choice than English
// (people who read Russian, Spanish or German as a second language). Everything else falls back to
// English through next-intl's own matching.
export const languageFallbacks: Record<string, Locale> = {
  be: 'ru',
  kk: 'ru',
  ky: 'ru',
  ca: 'es',
  gl: 'es',
  eu: 'es',
  gsw: 'de',
  lb: 'de',
  fy: 'nl',
  mo: 'ro',
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always', // every URL carries its language: /en/shop, /he/shop
  // The language a visitor picked is remembered for a year, so a later visit to "/" opens it directly.
  localeCookie: { name: 'NEXT_LOCALE', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' },
  // hreflang is declared once, in each page's <link rel="alternate"> tags and in the sitemap. next-intl's own
  // Link header is built from the request host and could disagree with them (previews, www / non-www).
  alternateLinks: false,
});
