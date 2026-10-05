import type { MetadataRoute } from 'next';
import { PLACE_SLUGS, placeHref } from '@/data/places/places';
import { locales } from '@/i18n/routing';
import { SITE_URL } from '@/lib/config';
import { loadCatalog } from '@/lib/shop/load';
import { footerNav, legalNav, pilgrimNav } from '@/lib/site';

type Entry = { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' };

const urlFor = (locale: string, path: string) => `${SITE_URL}/${locale}${path === '/' ? '' : path}`;

// One entry for every language version of every page. Each entry lists all of its alternates, itself
// included, plus x-default (English): Google expects the hreflang annotations to be reciprocal.
function sitemapEntries(entries: Entry[]): MetadataRoute.Sitemap {
  return entries.flatMap(({ path, priority, changeFrequency }) => {
    const languages = {
      ...Object.fromEntries(locales.map((l) => [l, urlFor(l, path)])),
      'x-default': urlFor('en', path),
    };
    return locales.map((locale) => ({
      url: urlFor(locale, path),
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  });
}

// Every page, the holy places and every product in the shop. The cart and the checkout are personal and
// carry noindex, so they are left out. If the API cannot be reached, the sitemap still lists every other page.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: Entry[] = ['/', ...footerNav.map((item) => item.href), ...pilgrimNav.map((item) => item.href)].map((path) => ({
    path,
    priority: path === '/' ? 1 : 0.7,
    changeFrequency: 'weekly',
  }));
  // Help and legal pages: indexed, but they change rarely and matter less than the content.
  const legal: Entry[] = legalNav.map((item) => ({ path: item.href, priority: 0.4, changeFrequency: 'monthly' }));
  const places: Entry[] = PLACE_SLUGS.map((slug) => ({ path: placeHref(slug), priority: 0.6, changeFrequency: 'monthly' }));
  const catalog = await loadCatalog().catch(() => null);
  const products: Entry[] = (catalog?.products ?? []).map((p) => ({
    path: `/shop/${p._id}`,
    priority: 0.5,
    changeFrequency: 'weekly',
  }));
  return sitemapEntries([...pages, ...places, ...legal, ...products]);
}
