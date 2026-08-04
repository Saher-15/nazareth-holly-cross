import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import ThemeRegistry from '@/components/ThemeRegistry';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ScrollProgress from '@/components/ScrollProgress';
import BackToTop from '@/components/BackToTop';
import WhatsAppButton from '@/components/WhatsAppButton';
import CookieConsent from '@/components/CookieConsent';
import { ShopProvider } from '@/context/ShopContext';
import '@/styles/globals.css';

const locales = ['en', 'fr', 'es', 'de', 'ru', 'pt', 'it', 'pl', 'el'];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata = {
  title: {
    default: 'Nazareth Holy Cross — Sacred Ministry',
    template: '%s | Nazareth Holy Cross',
  },
  description:
    'Connect with the holy city of Nazareth. Shop sacred goods, light a candle, watch live streams, and explore the holy sites.',
  keywords: ['Nazareth', 'Holy Cross', 'candle', 'sacred', 'ministry', 'Israel', 'Christian'],
  openGraph: {
    siteName: 'Nazareth Holy Cross',
    type: 'website',
    locale: 'en_US',
  },
};

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();

  const messages = await getMessages();

  const isAdmin =
    typeof window === 'undefined' ? false : window.location.pathname.includes('/admin');

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Lato:wght@300;400;700;900&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#F7F2E8" />
      </head>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeRegistry>
            <ShopProvider>
              <ScrollProgress />
              <Navbar />
              <main>{children}</main>
              <Footer />
              <BackToTop />
              <WhatsAppButton />
              <CookieConsent />
            </ShopProvider>
          </ThemeRegistry>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
