import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import BackToTop from '@/components/layout/BackToTop';
import ReadingProgress from '@/components/layout/ReadingProgress';
import RouteFocus from '@/components/layout/RouteFocus';
import SiteFooter from '@/components/layout/SiteFooter';
import SiteHeader from '@/components/layout/SiteHeader';
import { ToastProvider } from '@/components/ui/Toast';
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

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} className={fontVariables}>
      <body>
        <NextIntlClientProvider>
          <CartProvider>
            <ToastProvider>
              <ReadingProgress />
              <SiteHeader />
              <main id="main" tabIndex={-1}>
                {children}
              </main>
              <SiteFooter />
              <BackToTop />
              <RouteFocus />
            </ToastProvider>
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
