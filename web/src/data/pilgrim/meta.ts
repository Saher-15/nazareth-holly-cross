import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { Photo } from '@/data/places/places';
import { pageMetadata } from '@/lib/seo';

/** Localized title, description, canonical URL, hreflang list and social card of a pilgrim page:
 *  the texts are the `pilgrim.<page>.meta.title|description` messages. `noindex` keeps a page made of the
 *  visitor's own query (search) out of search results. */
export async function pilgrimMetadata(
  locale: string,
  page: string,
  path: string,
  image?: Photo,
  { noindex = false }: { noindex?: boolean } = {},
): Promise<Metadata> {
  const t = await getTranslations({ locale });
  return pageMetadata({ locale, path, title: t(`pilgrim.${page}.meta.title`), description: t(`pilgrim.${page}.meta.description`), image, noindex });
}
