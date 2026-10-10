import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import PendingFulfilmentRunner from '@/components/checkout/PendingFulfilmentRunner';
import { CampaignCapture } from '@/components/analytics/Track';
import A11yPanel from '@/components/layout/A11yPanel';
import BackToTop from '@/components/layout/BackToTop';
import SideCart from '@/components/shop/SideCart';
import LiveAlert from '@/components/layout/LiveAlert';
import PageTransitions from '@/components/layout/PageTransitions';
import ReadingProgress from '@/components/layout/ReadingProgress';
import RouteFocus from '@/components/layout/RouteFocus';
import SiteFooter from '@/components/layout/SiteFooter';
import SiteHeader from '@/components/layout/SiteHeader';
import { ToastProvider } from '@/components/ui/Toast';
import { A11Y_PREPAINT } from '@/lib/a11y';
import { INTRO_PREPAINT } from '@/lib/intro';
import { CartProvider } from '@/lib/cart';
import { CspNonceProvider } from '@/lib/cspNonce';
import { isRtl, locales, routing } from '@/i18n/routing';
import { SITE_NAME, SITE_URL } from '@/lib/config';
import { fontVariables } from '@/lib/fonts';
import { livePeekCheckedAt, peekLiveStatus } from '@/lib/liveStatusPeek';
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

  // What the server last knew about a live broadcast (never waits for the API: lib/liveStatusPeek.ts). It seeds the
  // tab's live-status poller (lib/liveStatusStore.ts) behind the header's dot and the "we are live" window.
  const live = { initial: peekLiveStatus(), checkedAt: livePeekCheckedAt() };

  const { pilgrim, ...messages } = (await getMessages()) as Record<string, Record<string, unknown>>;
  const clientMessages = {
    ...messages,
    pilgrim: Object.fromEntries(CLIENT_PILGRIM_NAMESPACES.map((key) => [key, pilgrim?.[key]])),
  } as unknown as AbstractIntlMessages;

  return (
    // suppressHydrationWarning: the pre-paint script below may add data-a11y-* attributes to <html> before React
    // hydrates it (only this element's own attributes are exempt, nothing inside it).
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} className={fontVariables} suppressHydrationWarning>
      <head>
        {/* The visitor's accessibility settings (lib/a11y.ts), applied before the first paint so large text or high
            contrast never flashes in after the page appears, then whether this visit opens with the door (lib/intro.ts,
            home page only, once per tab). Inline, so it carries this response's CSP nonce; it only reads
            localStorage and sessionStorage and sets attributes on <html>. */}
        <script nonce={nonce} suppressHydrationWarning>
          {A11Y_PREPAINT + INTRO_PREPAINT}
        </script>
      </head>
      <body>
        <NextIntlClientProvider messages={clientMessages}>
          <CspNonceProvider nonce={nonce}>
            <CartProvider>
              <ToastProvider>
                <ReadingProgress />
                {/* "live now" on the Live link while a broadcast is on */}
                <SiteHeader live={live} />
                {/* The accessibility settings: a floating button in the bottom corner, early in the tab order. */}
                <A11yPanel />
                <main id="main" tabIndex={-1}>
                  {children}
                </main>
                <SiteFooter />
                {search}
                <BackToTop />
                {/* The cart on every page: a tab on the side that opens it in a panel (not on /cart and /checkout). */}
                <SideCart />
                <RouteFocus />
                <PageTransitions />
                <PendingFulfilmentRunner />
                {/* Notes the campaign link of the visit, in memory only: no cookie, no storage (lib/track.ts) */}
                <CampaignCapture />
                {/* "We are live now": the one pop-up the owner approved (docs/DESIGN-GUIDE.md 1.5) */}
                <LiveAlert seed={live} />
              </ToastProvider>
            </CartProvider>
          </CspNonceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
