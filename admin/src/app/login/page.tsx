import type { Metadata } from 'next';
import { BrandMark } from '@/components/shell/Brand';
import { LanguageSwitcher } from '@/components/shell/LanguageSwitcher';
import { Icon } from '@/components/ui/Icon';
import { getI18n } from '@/i18n/server';
import { safeNextPath } from '@/lib/session';
import { LoginForm } from './LoginForm';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('login.title') };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getI18n();
  const params = await searchParams;
  const reasonRaw = Array.isArray(params.reason) ? params.reason[0] : params.reason;
  const reason = reasonRaw === 'expired' || reasonRaw === 'idle' ? reasonRaw : undefined;
  const nextRaw = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <main id="main" className="login" tabIndex={-1}>
      <div className="login__lang"><LanguageSwitcher /></div>
      <div className="login__card">
        <div className="login__brand">
          <BrandMark size={52} />
          <p className="eyebrow">{t('shell.brand')}</p>
          <h1 className="login__title">{t('login.title')}</h1>
          <p className="login__lead">{t('login.lead')}</p>
        </div>
        <LoginForm reason={reason} next={safeNextPath(nextRaw)} />
        <p className="login__foot"><Icon name="lock" size={14} /> {t('login.notice')}</p>
      </div>
    </main>
  );
}
