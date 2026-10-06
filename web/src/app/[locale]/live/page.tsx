import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import LiturgicalCalendarSection from '@/components/calendar/LiturgicalCalendarSection';
import LiveNow from '@/components/community/LiveNow';
import LivePlayer, { type PlayerBroadcast } from '@/components/community/LivePlayer';
import PastBroadcasts from '@/components/community/PastBroadcasts';
import { broadcasts, LIVE_WINDOW_MS } from '@/components/community/liveSchedule';
import { pastBroadcasts } from '@/components/community/recordings';
import JsonLd from '@/components/ui/JsonLd';
import MediaPicture from '@/components/media/MediaPicture';
import PageHero from '@/components/ui/PageHero';
import { getMedia, mediaShareFile } from '@/data/media';
import Reveal from '@/components/ui/Reveal';
import { SITE_URL } from '@/lib/config';
import { livePeekCheckedAt, peekLiveStatus } from '@/lib/liveStatusPeek';
import { contentUrl } from '@/lib/videos';
import { organizationJsonLd } from '@/lib/jsonLd';
import { pageMetadata } from '@/lib/seo';
import { socialLinks } from '@/lib/site';
import { NAZARETH_TIME_ZONE } from '@/lib/time';
import styles from './page.module.css';

// Re-rendered every hour so the HTML (and the structured data) follow the schedule; in the browser
// the player recomputes its state every second anyway.
export const revalidate = 3600;

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
 * The schedule in the page language and the structured data. The current time is read here, once per
 * render (at most hourly, see `revalidate`), like any other data; in the browser the player then follows
 * the visitor's own clock.
 */
async function loadLiveData(locale: string) {
  const [t, all, format] = await Promise.all([getTranslations('communityPage.live'), getTranslations(), getFormatter()]);
  const renderedAt = Date.now();

  const schedule: PlayerBroadcast[] = broadcasts.map((b) => {
    const start = new Date(b.startsAt);
    return {
      id: b.id,
      start: start.getTime(),
      title: t(`events.${b.titleKey}`),
      when: format.dateTime(start, { dateStyle: 'full', timeStyle: 'short', timeZone: NAZARETH_TIME_ZONE, numberingSystem: 'latn' }),
    };
  });

  const organizer = organizationJsonLd({ name: all('site.name') });
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/${locale}/live#webpage`,
        url: `${SITE_URL}/${locale}/live`,
        name: t('metaTitle'),
        description: t('metaDescription'),
        inLanguage: locale,
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      ...pastBroadcasts.map((video) => ({
        '@type': 'VideoObject',
        name: all(`videos.${video.messageKey}.title`),
        description: all(`videos.${video.messageKey}.description`),
        thumbnailUrl: `${SITE_URL}${video.poster.src}`,
        contentUrl: contentUrl(video.sources, SITE_URL),
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
  const { t, all, renderedAt, schedule, jsonLd } = await loadLiveData(locale);

  return (
    <div className={`ui-page ${styles.page}`}>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />

      <section className={`ui-container ${styles.stage}`} aria-labelledby="live-stage-title">
        {/* A broadcast started from the dashboard (docs/LIVE.md): shown above the schedule while it is live. */}
        <LiveNow initial={peekLiveStatus()} checkedAt={livePeekCheckedAt()} renderedAt={renderedAt} />
        <LivePlayer
          broadcasts={schedule}
          renderedAt={renderedAt}
          joinUrl={INSTAGRAM_URL}
          titleId="live-stage-title"
          background={
            <MediaPicture
              item={getMedia('basilica-night-front')}
              alt=""
              fill
              sizes="(min-width: 1212px) 1180px, calc(100vw - 32px)"
            />
          }
        />
      </section>

      {/* The Christian calendar: feasts of both traditions and the scheduled broadcasts (docs/LITURGICAL-CALENDAR.md). */}
      <LiturgicalCalendarSection locale={locale} />

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
