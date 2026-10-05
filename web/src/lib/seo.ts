import { locales } from '@/i18n/routing';

// Canonical URL + hreflang list for one page in every language. Each page sets its own;
// the layout deliberately sets none, otherwise every page would claim the home page as canonical.
export function pageAlternates(locale: string, path = '') {
  return {
    canonical: `/${locale}${path}`,
    languages: { ...Object.fromEntries(locales.map((l) => [l, `/${l}${path}`])), 'x-default': `/en${path}` },
  };
}

// Open Graph wants language_TERRITORY ("he_IL"), not the bare language the URLs use.
const OG_LOCALES: Record<string, string> = {
  en: 'en_US',
  fr: 'fr_FR',
  es: 'es_ES',
  de: 'de_DE',
  it: 'it_IT',
  pt: 'pt_PT',
  pl: 'pl_PL',
  ru: 'ru_RU',
  el: 'el_GR',
  he: 'he_IL',
  ar: 'ar_AR',
};
export const ogLocale = (locale: string) => OG_LOCALES[locale] ?? 'en_US';
