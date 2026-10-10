import type { Metadata } from 'next';
import { PageHeader, Panel } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { can } from '@/lib/roles';
import { getSession, load, serverApi } from '@/lib/server-api';
import { siteSettingsSchema } from '@/lib/settings';
import { CandlePriceForm } from './CandlePrice';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.pricing') };
}

// The prices the shop charges that are not product prices (docs/ADMIN.md "Settings"): for now the prayer candle.
export default async function PricingPage() {
  const { t } = await getI18n();
  const { user } = await getSession();
  const settings = await load(() => serverApi({ path: '/admin/settings', schema: siteSettingsSchema }));
  return (
    <>
      <PageHeader title={t('nav.pricing')} description={t('pricing.lead')} />
      <Panel title={t('pricing.candleTitle')}>
        {settings.ok ? (
          <CandlePriceForm settings={settings.data} canEdit={can(user.role, 'managePricing')} />
        ) : (
          <p className="form__error" role="alert">{t('pricing.loadError')}</p>
        )}
      </Panel>
    </>
  );
}
