import Link from 'next/link';
import { PageHeader, StateBox } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';

// "Not found" inside the dashboard (a product id that does not exist, ...): shown INSIDE the dashboard's layout, so the
// menu stays and a live broadcast of this tab goes on (components/live/LiveBroadcast.tsx). The root not-found.tsx would
// replace the layout.
export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t('state.notFound')} />
      <StateBox icon="search" title={t('state.notFound')} text={t('state.notFoundText')} action={<Link className="btn btn--gold btn--sm" href="/">{t('nav.dashboard')}</Link>} />
    </>
  );
}
