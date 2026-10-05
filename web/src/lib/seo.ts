import { locales } from '@/i18n/routing';

// Canonical URL + hreflang list for one page in every language. Each page sets its own;
// the layout deliberately sets none, otherwise every page would claim the home page as canonical.
export function pageAlternates(locale: string, path = '') {
  return {
    canonical: `/${locale}${path}`,
    languages: { ...Object.fromEntries(locales.map((l) => [l, `/${l}${path}`])), 'x-default': `/en${path}` },
  };
}
