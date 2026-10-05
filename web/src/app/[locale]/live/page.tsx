import type { Metadata } from 'next';
import Image from 'next/image';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import JsonLd from '@/components/community/JsonLd';
import LivePlayer, { type PlayerBroadcast } from '@/components/community/LivePlayer';
import PastBroadcasts from '@/components/community/PastBroadcasts';
import { broadcasts, LIVE_WINDOW_MS, NAZARETH_TIME_ZONE } from '@/components/community/liveSchedule';
import { communityMetadata } from '@/components/community/metadata';
import { pastBroadcasts } from '@/components/community/recordings';
import PageHero from '@/components/ui/PageHero';
import Reveal from '@/components/ui/Reveal';
import { SITE_URL } from '@/lib/config';
import { socialLinks } from '@/lib/site';
import styles from './page.module.css';

// Re-rendered every hour so the HTML (and the structured data) follow the schedule; in the browser
// the player recomputes its state every second anyway.
export const revalidate = 3600;

const INSTAGRAM_URL = socialLinks.find((s) => s.name === 'Instagram')?.href ?? socialLinks[0].href;

export async function generateMetadata({ params }: PageProps<'/[locale]/live'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'communityPage.live' });
  const site = await getTranslations({ locale, namespace: 'site' });
  return communityMetadata({
    locale,
    path: '/live',
    title: t('metaTitle'),
    description: t('metaDescription'),
    siteName: site('name'),
    image: '/images/latin/latin8.jpg',
  });
}

/**
 * The schedule in the page language and the structured data. The current time is read here, once per
 * render (at most hourly, see `revalidate`), like any other data; in the browser the player then follows
 * the visitor's own clock.
 */
async function loadLiveData() {
  const [t, all, site, format] = await Promise.all([
    getTranslations('communityPage.live'),
    getTranslations(),
    getTranslations('site'),
    getFormatter(),
  ]);
  const renderedAt = Date.now();

  const schedule: PlayerBroadcast[] = broadcasts.map((b) => {
    const start = new Date(b.startsAt);
    return {
      id: b.id,
      start: start.getTime(),
      title: t(`events.${b.titleKey}`),
      when: format.dateTime(start, { dateStyle: 'full', timeStyle: 'short', timeZone: NAZARETH_TIME_ZONE }),
    };
  });

  const organizer = { '@type': 'Organization', name: site('name'), url: SITE_URL };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ...pastBroadcasts.map((video) => ({
        '@type': 'VideoObject',
        name: all(`videos.${video.messageKey}.title`),
        description: all(`videos.${video.messageKey}.description`),
        thumbnailUrl: `${SITE_URL}${video.poster.src}`,
        contentUrl: video.src,
        ...(video.recordedOn ? { uploadDate: video.recordedOn } : {}),
      })),
      ...broadcasts
        .filter((b) => new Date(b.startsAt).getTime() + LIVE_WINDOW_MS >= renderedAt)
        .map((b) => ({
          '@type': 'Event',
          name: t(`events.${b.titleKey}`),
          startDate: b.startsAt,
          endDate: new Date(new Date(b.startsAt).getTime() + LIVE_WINDOW_MS).toISOString(),
          eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
          eventStatus: 'https://schema.org/EventScheduled',
          location: { '@type': 'VirtualLocation', url: INSTAGRAM_URL },
          organizer,
        })),
    ],
  };

  return { t, all, renderedAt, schedule, jsonLd };
}

export default async function LivePage({ params }: PageProps<'/[locale]/live'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { t, all, renderedAt, schedule, jsonLd } = await loadLiveData();

  return (
    <div className={`ui-page ${styles.page}`}>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />

      <section className={`ui-container ${styles.stage}`} aria-labelledby="live-stage-title">
        <LivePlayer
          broadcasts={schedule}
          renderedAt={renderedAt}
          joinUrl={INSTAGRAM_URL}
          titleId="live-stage-title"
          background={
            <Image
              src="/images/latin/latin8.jpg"
              alt=""
              fill
              sizes="(min-width: 1212px) 1180px, calc(100vw - 32px)"
            />
          }
        />
      </section>

      <section className="ui-section" aria-labelledby="past-broadcasts-title">
        <Reveal className="ui-container">
          <header className={styles.head}>
            <p className="ui-eyebrow">{t('pastEyebrow')}</p>
            <h2 id="past-broadcasts-title" className="ui-h2">
              {all('live.past_live_events')}
            </h2>
          </header>
          <PastBroadcasts />
        </Reveal>
      </section>

      <JsonLd data={jsonLd} />
    </div>
  );
}
