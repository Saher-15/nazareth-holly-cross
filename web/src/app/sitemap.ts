import type { MetadataRoute } from 'next';
import { PLACE_SLUGS, placeHref } from '@/data/places/places';
import { locales } from '@/i18n/routing';
import { SITE_URL } from '@/lib/config';
import { loadCatalog } from '@/lib/shop/load';
import { footerNav } from '@/lib/site';

type Entry = { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' };

/** One entry per page, listing all its language versions (hreflang). */
function sitemapEntries(entries: Entry[]): MetadataRoute.Sitemap {
  return entries.map(({ path, priority, changeFrequency }) => {
    const suffix = path === '/' ? '' : path;
    return {
      url: `${SITE_URL}/en${suffix}`,
      changeFrequency,
      priority,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}${suffix}`])),
      },
    };
  });
}

// Every page, the holy places and every product in the shop. If the API cannot be
// reached, the sitemap still lists every other page.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: Entry[] = ['/', ...footerNav.map((item) => item.href)].map((path) => ({
    path,
    priority: path === '/' ? 1 : 0.7,
    changeFrequency: 'weekly',
  }));
  const places: Entry[] = PLACE_SLUGS.map((slug) => ({ path: placeHref(slug), priority: 0.6, changeFrequency: 'monthly' }));
  const catalog = await loadCatalog().catch(() => null);
  const products: Entry[] = (catalog?.products ?? []).map((p) => ({
    path: `/shop/${p._id}`,
    priority: 0.5,
    changeFrequency: 'weekly',
  }));
  return sitemapEntries([...pages, ...places, ...products]);
}
