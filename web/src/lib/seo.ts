import { locales, openGraphLocales, type Locale } from '@/i18n/routing';

const isLocale = (value: string): value is Locale => (locales as readonly string[]).includes(value);

// Canonical URL + hreflang list for one page in every language. Each page sets its own;
// the layout deliberately sets none, otherwise every page would claim the home page as canonical.
// Every language lists all the others and itself, plus x-default (English) for visitors of any other language.
export function pageAlternates(locale: string, path = '') {
  return {
    canonical: `/${locale}${path}`,
    languages: { ...Object.fromEntries(locales.map((l) => [l, `/${l}${path}`])), 'x-default': `/en${path}` },
  };
}

/**
 * Open Graph language of a page: og:locale in the language_TERRITORY form social networks expect
 * (he_IL, not "he") and every other language as og:locale:alternate.
 */
export function openGraphLocale(locale: string) {
  const current = isLocale(locale) ? locale : 'en';
  return {
    locale: openGraphLocales[current],
    alternateLocale: locales.filter((l) => l !== current).map((l) => openGraphLocales[l]),
  };
}
