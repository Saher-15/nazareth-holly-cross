import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';

// "Not found" inside the dashboard (a product id that does not exist, ...): shown INSIDE the dashboard's layout, so the
// menu stays and a live broadcast of this tab goes on (components/live/LiveBroadcast.tsx). The root not-found.tsx would
// replace the layout.
export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t('state.notFound')} />
      <div className="state" role="status">
        <Icon name="search" size={32} />
        <p className="state__text">{t('state.notFoundText')}</p>
        <Link className="btn btn--gold btn--sm" href="/">{t('nav.dashboard')}</Link>
      </div>
    </>
  );
}
