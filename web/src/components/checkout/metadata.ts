import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { openGraphLocale, pageAlternates } from '@/lib/seo';

type Flow = 'checkout' | 'candle' | 'donate';

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
      ...openGraphLocale(locale),
      url: `/${locale}${path}`,
    },
    robots: index ? undefined : { index: false, follow: true },
  };
}
