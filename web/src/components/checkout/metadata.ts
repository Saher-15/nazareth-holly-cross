import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';

type Flow = 'checkout' | 'candle' | 'donate';

// The social card of each flow (a page without an image gets a plain summary card, and QA-02 wants a picture).
const SHARE_IMAGES: Record<Flow, { src: string; width: number; height: number }> = {
  checkout: { src: '/images/nazareth/nazareth1.webp', width: 1024, height: 683 },
  candle: { src: '/images/candle.jpg', width: 640, height: 428 },
  donate: { src: '/images/nazareth/nazareth1.webp', width: 1024, height: 683 },
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
