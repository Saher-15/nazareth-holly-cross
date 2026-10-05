import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import SiteFooter from '@/components/layout/SiteFooter';
import SiteHeader from '@/components/layout/SiteHeader';
import { CartProvider } from '@/lib/cart';
import { CspNonceProvider } from '@/lib/cspNonce';
import { isRtl, locales, routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/config';
import { fontVariables } from '@/lib/fonts';
import { ogLocale } from '@/lib/seo';
import '@/styles/globals.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: '#0a0e1a',
  colorScheme: 'dark',
};

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site.meta' });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('title'), template: `%s · Nazareth Holy Cross` },
    description: t('description'),
    openGraph: {
      type: 'website',
      siteName: 'Nazareth Holy Cross',
      title: t('title'),
      description: t('description'),
      locale: ogLocale(locale),
    },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Every page is rendered per request: the Content-Security-Policy nonce (src/proxy.ts) is different
  // for each response, and only a request-time render can put it on the page's scripts and styles.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} className={fontVariables}>
      <body>
        <NextIntlClientProvider>
          <CspNonceProvider nonce={nonce}>
            <CartProvider>
              <SiteHeader />
              <main id="main" tabIndex={-1}>
                {children}
              </main>
              <SiteFooter />
            </CartProvider>
          </CspNonceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
