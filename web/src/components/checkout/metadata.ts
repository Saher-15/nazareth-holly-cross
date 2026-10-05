import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';

type Flow = 'checkout' | 'candle' | 'donate';

// Localized <title>/<description> for a flow page, with its own canonical URL and language alternates.
export async function flowMetadata(locale: string, flow: Flow, { index = true } = {}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'checkoutPage.meta' });
  return pageMetadata({
    locale,
    path: `/${flow}`,
    title: t(`${flow}Title`),
    description: t(`${flow}Description`),
    noindex: !index,
  });
}
