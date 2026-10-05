import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { mediaPhoto } from '@/data/places/places';
import { pageMetadata } from '@/lib/seo';

type Flow = 'checkout' | 'candle' | 'donate';

// The social card of each flow (a page without an image gets a plain summary card, and QA-02 wants a picture).
const SHARE_IMAGES: Record<Flow, { src: string; width: number; height: number }> = {
  checkout: mediaPhoto('old-city-arched-passage'),
  candle: mediaPhoto('basilica-night-view'),
  donate: mediaPhoto('city-hills-galilee'),
};

// Localized <title>/<description> for a flow page, with its own canonical URL and language alternates.
export async function flowMetadata(locale: string, flow: Flow, { index = true } = {}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'checkoutPage.meta' });
  return pageMetadata({
    locale,
    path: `/${flow}`,
    title: t(`${flow}Title`),
    description: t(`${flow}Description`),
    image: SHARE_IMAGES[flow],
    noindex: !index,
  });
}
