import type { Metadata } from 'next';
import { PageHeader, Panel } from '@/components/ui/Primitives';
import { getI18n } from '@/i18n/server';
import { candleVideoListSchema } from '@/lib/candle-videos';
import { can } from '@/lib/roles';
import { getSession, load, serverApi } from '@/lib/server-api';
import { CandleVideos } from './CandleVideos';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('nav.candleVideos') };
}

// The videos of the website's candle page (docs/ADMIN.md 5.5).
export default async function CandleVideosPage() {
  const { t } = await getI18n();
  const { user } = await getSession();
  const list = await load(() => serverApi({ path: '/admin/candle-videos', schema: candleVideoListSchema }));
  return (
    <>
      <PageHeader title={t('nav.candleVideos')} description={t('candleVideos.lead')} />
      <Panel title={t('candleVideos.panelTitle')}>
        {list.ok ? (
          <CandleVideos list={list.data} canEdit={can(user.role, 'write')} />
        ) : (
          <p className="form__error" role="alert">{t('candleVideos.loadError')}</p>
        )}
      </Panel>
    </>
  );
}
