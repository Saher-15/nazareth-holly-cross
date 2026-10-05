import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/data/places/seo';
import type { Photo } from '@/data/places/places';

/** Localized title, description, canonical URL, hreflang list and social card of a pilgrim page:
 *  the texts are the `pilgrim.<page>.meta.title|description` messages. */
export async function pilgrimMetadata(
  locale: string,
  page: string,
  path: string,
  image?: Photo,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `pilgrim.${page}.meta` });
  return pageMetadata({ locale, path, title: t('title'), description: t('description'), image });
}
