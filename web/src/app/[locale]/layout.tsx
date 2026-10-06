import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import PendingFulfilmentRunner from '@/components/checkout/PendingFulfilmentRunner';
import BackToTop from '@/components/layout/BackToTop';
import PageTransitions from '@/components/layout/PageTransitions';
import ReadingProgress from '@/components/layout/ReadingProgress';
import RouteFocus from '@/components/layout/RouteFocus';
import SiteFooter from '@/components/layout/SiteFooter';
import SiteHeader from '@/components/layout/SiteHeader';
import { ToastProvider } from '@/components/ui/Toast';
import { CartProvider } from '@/lib/cart';
import { CspNonceProvider } from '@/lib/cspNonce';
import { isRtl, locales, routing } from '@/i18n/routing';
import { SITE_NAME, SITE_URL } from '@/lib/config';
import { fontVariables } from '@/lib/fonts';
import { peekLiveStatus } from '@/lib/liveStatusPeek';
import { openGraphLocale } from '@/lib/seo';
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
    title: { default: t('title'), template: `%s · ${SITE_NAME}` },
    description: t('description'),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: t('title'),
      description: t('description'),
      ...openGraphLocale(locale),
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

  // Every page is rendered per request: the Content-Security-Policy nonce (src/proxy.ts) is different
  // for each response, and only a request-time render can put it on the page's scripts and styles.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const { pilgrim, ...messages } = (await getMessages()) as Record<string, Record<string, unknown>>;
  const clientMessages = {
    ...messages,
    pilgrim: Object.fromEntries(CLIENT_PILGRIM_NAMESPACES.map((key) => [key, pilgrim?.[key]])),
  } as unknown as AbstractIntlMessages;

  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} className={fontVariables}>
      <body>
        <NextIntlClientProvider messages={clientMessages}>
          <CspNonceProvider nonce={nonce}>
            <CartProvider>
              <ToastProvider>
                <ReadingProgress />
                {/* "live now" on the Live link while a broadcast is on (never waits for the API: lib/liveStatusPeek.ts) */}
                <SiteHeader liveNow={peekLiveStatus().live} />
                <main id="main" tabIndex={-1}>
                  {children}
                </main>
                <SiteFooter />
                {search}
                <BackToTop />
                <RouteFocus />
                <PageTransitions />
                <PendingFulfilmentRunner />
              </ToastProvider>
            </CartProvider>
          </CspNonceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
