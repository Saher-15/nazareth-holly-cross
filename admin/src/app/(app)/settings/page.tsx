import type { Metadata } from 'next';
import { PageHeader, Panel } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { getSession } from '@/lib/server-api';
import { ChangePasswordForm, TotpPanel } from './SettingsForms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.settings') };
}

export default async function SettingsPage() {
  const { t } = await getI18n();
  const { user } = await getSession();
  return (
    <>
      <PageHeader title={t('nav.settings')} description={t('settings.lead')} />
      <div className="grid grid--two grid--top">
        <Panel title={t('settings.passwordTitle')}>
          <p className="hint">{t('settings.passwordLead')}</p>
          <ChangePasswordForm username={user.username} />
        </Panel>
        <Panel title={t('settings.totpTitle')}>
          <TotpPanel enabled={user.totpEnabled} username={user.username} />
        </Panel>
      </div>
    </>
  );
}
