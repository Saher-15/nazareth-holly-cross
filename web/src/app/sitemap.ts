import type { MetadataRoute } from 'next';
import { PLACE_SLUGS, placeHref } from '@/data/places/places';
import { locales } from '@/i18n/routing';
import { SITE_URL } from '@/lib/config';
import { footerNav } from '@/lib/site';

// Pages worth indexing: the home page, the sections of the site and the five holy places. The cart and the
// checkout are personal and carry noindex, so they are left out.
const paths = ['/', ...footerNav.map((item) => item.href), ...PLACE_SLUGS.map((slug) => placeHref(slug))];

const urlFor = (locale: string, path: string) => `${SITE_URL}/${locale}${path === '/' ? '' : path}`;

// One entry for every language version of every page. Each entry lists all of its alternates, itself
// included, plus x-default (English): Google expects the hreflang annotations to be reciprocal.
export default function sitemap(): MetadataRoute.Sitemap {
  return paths.flatMap((path) => {
    const languages = {
      ...Object.fromEntries(locales.map((l) => [l, urlFor(l, path)])),
      'x-default': urlFor('en', path),
    };
    return locales.map((locale) => ({
      url: urlFor(locale, path),
      changeFrequency: 'weekly' as const,
      priority: path === '/' ? 1 : 0.7,
      alternates: { languages },
    }));
  });
}
