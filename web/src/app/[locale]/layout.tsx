import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import SiteFooter from '@/components/layout/SiteFooter';
import SiteHeader from '@/components/layout/SiteHeader';
import { CartProvider } from '@/lib/cart';
import { isRtl, locales, routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/config';
import { fontVariables } from '@/lib/fonts';
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
      locale,
    },
  };
}

// Only these parts of the pilgrim texts are used by client components. The rest (legal pages, guides, FAQ) is
// rendered on the server, so it is kept out of the messages sent to every browser.
const CLIENT_PILGRIM_NAMESPACES = ['plan', 'prayers', 'contact', 'gallery', 'search'] as const;

export default async function LocaleLayout({ children, search, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { pilgrim, ...messages } = (await getMessages()) as Record<string, Record<string, unknown>>;
  const clientMessages = {
    ...messages,
    pilgrim: Object.fromEntries(CLIENT_PILGRIM_NAMESPACES.map((key) => [key, pilgrim?.[key]])),
  } as unknown as AbstractIntlMessages;

  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} className={fontVariables}>
      <body>
        <NextIntlClientProvider messages={clientMessages}>
          <CartProvider>
            <SiteHeader />
            <main id="main" tabIndex={-1}>
              {children}
            </main>
            <SiteFooter />
            {search}
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
