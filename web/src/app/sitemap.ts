import type { MetadataRoute } from 'next';
import { PLACES, placeHref } from '@/data/places/places';
import { locales } from '@/i18n/routing';
import { SITE_URL } from '@/lib/config';
import { footerNav } from '@/lib/site';

// One entry per page, each listing all its language versions (hreflang).
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', ...footerNav.map((item) => item.href), ...PLACES.map((p) => placeHref(p.slug))];
  return paths.map((path) => {
    const suffix = path === '/' ? '' : path;
    return {
      url: `${SITE_URL}/en${suffix}`,
      changeFrequency: 'weekly',
      priority: path === '/' ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}${suffix}`])),
      },
    };
  });
}
