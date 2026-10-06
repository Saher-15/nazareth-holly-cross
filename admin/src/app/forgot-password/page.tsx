import type { Metadata } from 'next';
import { BrandMark } from '@/components/shell/Brand';
import { LanguageSwitcher } from '@/components/shell/LanguageSwitcher';
import { Icon } from '@/components/ui/Icon';
import { getI18n } from '@/i18n/server';
import { ForgotForm } from './ForgotForm';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('forgot.title') };
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <main id="main" className="login" tabIndex={-1}>
      <div className="login__lang"><LanguageSwitcher /></div>
      <div className="login__card">
        <div className="login__brand">
          <BrandMark size={52} />
          <p className="eyebrow">{t('shell.brand')}</p>
          <h1 className="login__title">{t('forgot.title')}</h1>
          <p className="login__lead">{t('forgot.lead')}</p>
        </div>
        <ForgotForm />
        <p className="login__foot"><Icon name="lock" size={14} /> {t('login.notice')}</p>
      </div>
    </main>
  );
}
