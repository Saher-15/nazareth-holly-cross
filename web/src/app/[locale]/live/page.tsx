import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import BroadcastStage from '@/components/community/BroadcastStage';
import LiveNow from '@/components/community/LiveNow';
import PastBroadcasts from '@/components/community/PastBroadcasts';
import { pastBroadcasts } from '@/components/community/recordings';
import JsonLd from '@/components/ui/JsonLd';
import MediaPicture from '@/components/media/MediaPicture';
import PageHero from '@/components/ui/PageHero';
import { getMedia, mediaShareFile } from '@/data/media';
import Reveal from '@/components/ui/Reveal';
import { api } from '@/lib/api';
import { SITE_URL } from '@/lib/config';
import { recordingView } from '@/lib/liveRecordings';
import { broadcastView } from '@/lib/liveSchedule';
import { livePeekCheckedAt, peekLiveStatus } from '@/lib/liveStatusPeek';
import { contentUrl } from '@/lib/videos';
import { broadcastEventJsonLd, organizationJsonLd, recordingVideoJsonLd } from '@/lib/jsonLd';
import { pageMetadata } from '@/lib/seo';
import { socialLinks } from '@/lib/site';
import styles from './page.module.css';

// The announced broadcasts and the recordings are read through lib/api.ts (cached a minute, retried, the last good
// answer kept); in the browser the page reads them once more when it opens.
export const revalidate = 60;

const INSTAGRAM_URL = socialLinks.find((s) => s.name === 'Instagram')?.href ?? socialLinks[0].href;

export async function generateMetadata({ params }: PageProps<'/[locale]/live'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'communityPage.live' });
  return pageMetadata({
    locale,
    path: '/live',
    title: t('metaTitle'),
    description: t('metaDescription'),
    image: mediaShareFile(getMedia('basilica-night-front')),
  });
}

/**
 * The announced broadcasts (GET /live/schedule) and the published recordings (GET /live/recordings), written in the
 * page language, and the structured data. An API that does not have these routes yet, or is down, gives empty lists
 * (the page then shows its offline state and the older recordings only), never made-up data.
 */
async function loadLiveData(locale: string) {
  const [t, all, schedule, recordings] = await Promise.all([
    getTranslations('communityPage.live'),
    getTranslations(),
    api.liveSchedule().catch(() => []),
    api.liveRecordings().catch(() => []),
  ]);
  const renderedAt = Date.now();
  const liveUrl = `${SITE_URL}/${locale}/live`;
  const organizer = organizationJsonLd({ name: all('site.name') });
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${liveUrl}#webpage`,
        url: liveUrl,
        name: t('metaTitle'),
        description: t('metaDescription'),
        inLanguage: locale,
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      ...schedule.filter((b) => b.start > renderedAt).map((b) => broadcastEventJsonLd(b, { liveUrl, organizer })),
      ...recordings.map(recordingVideoJsonLd),
      ...pastBroadcasts.map((video) => ({
        '@type': 'VideoObject',
        name: all(`videos.${video.messageKey}.title`),
        description: all(`videos.${video.messageKey}.description`),
        thumbnailUrl: `${SITE_URL}${video.poster.src}`,
        contentUrl: contentUrl(video.sources, SITE_URL),
        ...(video.recordedOn ? { uploadDate: video.recordedOn } : {}),
      })),
    ],
  };

  return {
    t,
    all,
    renderedAt,
    broadcasts: schedule.map((b) => broadcastView(b, locale)),
    recordings: recordings.map((r) => recordingView(r, locale)),
    jsonLd,
  };
}

export default async function LivePage({ params }: PageProps<'/[locale]/live'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { t, all, renderedAt, broadcasts, recordings, jsonLd } = await loadLiveData(locale);
  const live = { initial: peekLiveStatus(), checkedAt: livePeekCheckedAt() };

  return (
    <div className={`ui-page ${styles.page}`}>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />

      <div className={`ui-container ${styles.stage}`}>
        {/* A broadcast started from the dashboard (docs/LIVE.md): the player, at the top while it is live. */}
        <LiveNow initial={live.initial} checkedAt={live.checkedAt} renderedAt={renderedAt} />
        {/* Otherwise the next announced broadcast with its countdown (or the offline state); then the others. */}
        <BroadcastStage
          initial={broadcasts}
          renderedAt={renderedAt}
          followUrl={INSTAGRAM_URL}
          titleId="live-stage-title"
          live={live}
          background={
            <MediaPicture
              item={getMedia('basilica-night-front')}
              alt=""
              fill
              sizes="(min-width: 1212px) 1180px, calc(100vw - 32px)"
            />
          }
        />
      </div>

      <section className="ui-section" aria-labelledby="past-broadcasts-title">
        <Reveal className="ui-container">
          <header className={styles.head}>
            <p className="ui-eyebrow">{t('pastEyebrow')}</p>
            <h2 id="past-broadcasts-title" className="ui-h2">
              {all('live.past_live_events')}
            </h2>
          </header>
          <PastBroadcasts recordings={recordings} />
        </Reveal>
      </section>

      <JsonLd data={jsonLd} />
    </div>
  );
}
