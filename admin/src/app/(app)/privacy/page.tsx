import type { Metadata } from 'next';
import { Forbidden, PageHeader, Panel } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { can } from '@/lib/roles';
import { getSession } from '@/lib/server-api';
import { PrivacyTool } from './PrivacyTool';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.privacy') };
}

// Data-protection requests (owner only): what is stored about an e-mail address, and erasing it. docs/DATABASE.md
// has the policy; the API (server/route/admin/privacy.js) enforces the role and writes the audit entry.
export default async function PrivacyPage() {
  const { t } = await getI18n();
  const { user } = await getSession();
  if (!can(user.role, 'managePrivacy')) return <Forbidden />;

  return (
    <>
      <PageHeader title={t('nav.privacy')} description={t('privacy.lead')} />
      <div className="grid grid--two">
        <PrivacyTool />
        <Panel title={t('privacy.rulesTitle')}>
          <ul className="rules">
            <li>{t('privacy.ruleOrders')}</li>
            <li>{t('privacy.ruleCandles')}</li>
            <li>{t('privacy.ruleMessages')}</li>
            <li>{t('privacy.rulePayments')}</li>
            <li>{t('privacy.ruleNotFound')}</li>
            <li>{t('privacy.ruleOutside')}</li>
            <li>{t('privacy.ruleAudit')}</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
