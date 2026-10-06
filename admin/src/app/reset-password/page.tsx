import type { Metadata } from 'next';
import { BrandMark } from '@/components/shell/Brand';
import { LanguageSwitcher } from '@/components/shell/LanguageSwitcher';
import { Icon } from '@/components/ui/Icon';
import { getI18n } from '@/i18n/server';
import { tokenFromParam } from '@/lib/password-reset';
import { ResetForm } from './ResetForm';

// The page the e-mail links to: /reset-password?token=<43 characters>. The token is read here, handed to the form,
// and the form drops it from the address bar at once. No Referer leaves this page (Referrer-Policy: no-referrer from
// next.config.ts and src/proxy.ts, and the root layout's <meta name="referrer">), there are no third-party scripts,
// and the page is no-store.

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('reset.title'), referrer: 'no-referrer' };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getI18n();
  const token = tokenFromParam((await searchParams).token);

  return (
    <main id="main" className="login" tabIndex={-1}>
      <div className="login__lang"><LanguageSwitcher /></div>
      <div className="login__card">
        <div className="login__brand">
          <BrandMark size={52} />
          <p className="eyebrow">{t('shell.brand')}</p>
          <h1 className="login__title">{t('reset.title')}</h1>
          <p className="login__lead">{t('reset.lead')}</p>
        </div>
        <ResetForm token={token} />
        <p className="login__foot"><Icon name="lock" size={14} /> {t('login.notice')}</p>
      </div>
    </main>
  );
}
