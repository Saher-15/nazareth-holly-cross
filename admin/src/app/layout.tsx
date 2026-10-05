import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/i18n/client';
import { getI18n } from '@/i18n/server';
import { messagesFor } from '@/i18n/translate';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: { default: 'NHC Admin', template: '%s | NHC Admin' },
  description: 'Private administration of the Nazareth Holy Cross website.',
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true },
  referrer: 'no-referrer',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0e1a',
  colorScheme: 'dark',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, dir, t } = await getI18n();
  return (
    <html lang={locale} dir={dir}>
      <body>
        <a className="skip-link" href="#main">{t('shell.skip')}</a>
        <I18nProvider locale={locale} messages={messagesFor(locale)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
