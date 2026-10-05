import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageAlternates } from '@/lib/seo';

type Flow = 'checkout' | 'candle' | 'donate';

const SHARE_IMAGES: Record<Flow, { url: string; width: number; height: number }> = {
  checkout: { url: '/images/nazareth/nazareth1.webp', width: 1024, height: 683 },
  candle: { url: '/images/candle.jpg', width: 640, height: 428 },
  donate: { url: '/images/nazareth/nazareth1.webp', width: 1024, height: 683 },
};

// Localized <title>/<description> for a flow page, with its own canonical URL and language
// alternates (the layout's canonical points at the home page, so each page must set its own).
export async function flowMetadata(locale: string, flow: Flow, { index = true } = {}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'checkoutPage.meta' });
  const site = await getTranslations({ locale, namespace: 'site' });
  const path = `/${flow}`;
  const title = t(`${flow}Title`);
  const description = t(`${flow}Description`);
  return {
    title,
    description,
    alternates: pageAlternates(locale, path),
    openGraph: {
      type: 'website',
      siteName: site('name'),
      title,
      description,
      locale,
      url: `/${locale}${path}`,
      // A page-level openGraph replaces the layout's, so the social card image is set here too.
      images: [SHARE_IMAGES[flow]],
    },
    robots: index ? undefined : { index: false, follow: true },
  };
}
