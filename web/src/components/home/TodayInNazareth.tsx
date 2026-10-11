import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { peekLiveStatus } from '@/lib/liveStatusPeek';
import { sunTimes } from '@/lib/sun';
import { nextBroadcast, peekSchedule, type ScheduledBroadcast } from './broadcast';
import { feastOn } from './feasts';
import { BroadcastIcon, ClockIcon, CrossIcon, SunIcon } from './icons';
import { formatCalendarDay, formatClock, formatDay, formatDuration, formatInDays, formatStart } from './today';
import { NazarethClock, StartsIn } from './TodayTicker';
import { nazarethDate } from './verse';
import styles from './TodayInNazareth.module.css';

/** What the broadcast item shows: one on air now, the next one scheduled, or nothing (the item is left out). */
export type BroadcastState = { live: true; title: string } | { live: false; next: ScheduledBroadcast } | null;

type ViewProps = { id: string; locale: string; now: number; broadcast: BroadcastState };

// "Today in Nazareth": a quiet band under the hero with the time in Nazareth, sunrise and sunset (computed here, no
// weather service), the feast of the day or the next great feast, and the live broadcast when there is one. All of it
// is rendered on the server; only the clock and the countdown follow the time in the browser, once a minute.
export function TodayView({ id, locale, now, broadcast }: ViewProps) {
  const t = useTranslations('home.today');
  const tLive = useTranslations('communityPage.live.now');
  const tFeast = useTranslations();
  const today = nazarethDate(new Date(now));
  const sun = sunTimes(today);
  const feast = feastOn(today);
  const dayText = formatDay(now, locale);

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="ui-container">
        <div className={`ui-glass ${styles.band}`}>
          <h2 id={`${id}-title`} className={`ui-eyebrow ${styles.title}`}>
            {t('title')}
          </h2>
          <dl className={styles.items}>
            <div className={styles.item}>
              <dt className={styles.label}>
                <ClockIcon className={styles.icon} />
                {t('time')}
              </dt>
              <dd className={styles.value}>
                <NazarethClock serverNow={now} serverText={formatClock(now, locale)} />
              </dd>
              <dd className={styles.sub}>{dayText}</dd>
            </div>

            {sun.sunrise && sun.sunset && (
              <div className={styles.item}>
                <dt className={styles.label}>
                  <SunIcon className={styles.icon} />
                  {t('sun')}
                </dt>
                <dd className={styles.value}>
                  <span className={styles.pair}>
                    <span>{t('sunrise', { time: formatClock(sun.sunrise.getTime(), locale) })}</span>
                    <span>{t('sunset', { time: formatClock(sun.sunset.getTime(), locale) })}</span>
                  </span>
                </dd>
                <dd className={styles.sub}>{t('daylight', { duration: formatDuration(sun.sunset.getTime() - sun.sunrise.getTime(), locale) })}</dd>
              </div>
            )}

            <div className={styles.item} data-feast={feast.id}>
              <dt className={styles.label}>
                <CrossIcon className={styles.icon} />
                {feast.today ? t('feastToday') : t('feastNext')}
              </dt>
              <dd className={styles.value}>{tFeast(feast.nameKey)}</dd>
              <dd className={styles.sub}>
                {feast.today
                  ? dayText
                  : t('feastWhen', { date: formatCalendarDay(feast.date, locale), inDays: formatInDays(feast.days, locale) })}
              </dd>
            </div>

            {broadcast && (
              <div className={styles.item} data-broadcast={broadcast.live ? 'live' : 'next'}>
                <dt className={styles.label}>
                  {broadcast.live ? (
                    <span className={styles.onAir}>
                      <span className={styles.dot} aria-hidden="true" />
                      {tLive('badge')}
                    </span>
                  ) : (
                    <>
                      <BroadcastIcon className={styles.icon} />
                      {t('broadcastNext')}
                    </>
                  )}
                </dt>
                <dd className={styles.value}>
                  <bdi>{broadcast.live ? broadcast.title : broadcast.next.title}</bdi>
                </dd>
                {!broadcast.live && (
                  <dd className={styles.sub}>
                    <time dateTime={new Date(broadcast.next.startsAt).toISOString()}>{formatStart(broadcast.next.startsAt, locale)}</time>
                    <span aria-hidden="true"> · </span>
                    <StartsIn
                      startsAt={broadcast.next.startsAt}
                      serverNow={now}
                      serverText={
                        broadcast.next.startsAt - now >= 60_000
                          ? t('startsIn', { duration: formatDuration(broadcast.next.startsAt - now, locale) })
                          : t('startingSoon')
                      }
                    />
                  </dd>
                )}
                <dd className={styles.action}>
                  <Link href="/live" className="ui-link">
                    {broadcast.live ? t('watch') : t('livePage')}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}

/** The broadcast to show: the live status the header already peeks at, else the next one on the schedule. */
export function broadcastState(live: ReturnType<typeof peekLiveStatus>, schedule: ScheduledBroadcast[] | null, now: number): BroadcastState {
  if (live.live) return { live: true, title: live.title };
  const next = nextBroadcast(schedule, now);
  if (!next) return null;
  return next.status === 'live' ? { live: true, title: next.title } : { live: false, next };
}

/** The request's moment and the broadcast to announce (a function, so rendering itself stays pure). */
async function loadToday(): Promise<{ now: number; broadcast: BroadcastState }> {
  const schedule = await peekSchedule();
  const now = Date.now();
  return { now, broadcast: broadcastState(peekLiveStatus(), schedule, now) };
}

export default async function TodayInNazareth({ id, locale }: { id: string; locale: string }) {
  const { now, broadcast } = await loadToday();
  return <TodayView id={id} locale={locale} now={now} broadcast={broadcast} />;
}
