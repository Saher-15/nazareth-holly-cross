'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarAddIcon } from '@/components/ui/icons';
import { buildIcs } from '@/data/pilgrim/ics';
import { SITE_URL } from '@/lib/config';
import {
  broadcastView,
  CALENDAR_EVENT_MS,
  countdownParts,
  countdownSummary,
  fetchScheduleInBrowser,
  formatVisitorTime,
  scheduleView,
  STARTING_SOON_POLL_MS,
  type BroadcastView,
  type CountdownParts,
  type ScheduledBroadcast,
} from '@/lib/liveSchedule';
import { prefersReducedMotion, subscribeMotion } from '@/lib/motion';
import { useLivePolling, useLiveStatus, type LiveSeed } from '@/lib/useLiveStatus';
import Icon from './Icon';
import { useHydrated, useNow } from './useNow';
import styles from './BroadcastStage.module.css';

type Props = {
  /** What the server read (GET /live/schedule), with the times written on the server. */
  initial: BroadcastView[];
  /** When the server rendered the page: the time shown until the browser takes over. */
  renderedAt: number;
  /** "Follow us on Instagram" when nothing is announced. */
  followUrl: string;
  titleId: string;
  /** The frame's background photo, rendered on the server. */
  background: ReactNode;
  /** What the server knew about a live broadcast (the same as <LiveNow>'s), so the HTML already steps aside for it. */
  live?: LiveSeed;
};

const UNITS: (keyof CountdownParts)[] = ['days', 'hours', 'minutes', 'seconds'];
const pad = (n: number) => String(n).padStart(2, '0');

/** The calendar entry of a broadcast (a moment in UTC, so every calendar shows it at the visitor's own time). */
function downloadCalendar(item: ScheduledBroadcast, locale: string, name: string) {
  const liveUrl = `${SITE_URL}/${locale}/live`;
  const ics = buildIcs(
    [
      {
        uid: `live-${item.id}@${new URL(SITE_URL).hostname}`,
        startsAt: item.start,
        endsAt: item.start + CALENDAR_EVENT_MS,
        summary: item.title,
        description: item.description ? `${item.description}\n\n${liveUrl}` : liveUrl,
        url: liveUrl,
      },
    ],
    { name, product: 'Live broadcasts' },
  );
  const href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = href;
  link.download = `nazareth-holy-cross-live-${new Date(item.start).toISOString().slice(0, 10)}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

// The top of /live when nothing is live (docs/LIVE.md): the next broadcast announced from the dashboard, large, with a
// countdown, its time in Nazareth and on the visitor's own clock, its description and "Add to calendar"; then the other
// broadcasts still to come. Nothing announced (or the API unreachable): the offline state, never made-up data.
// When the countdown reaches zero it says "Starting soon" and asks the tab's live-status poller to check every
// 10 seconds for up to half an hour, so the player (<LiveNow>, above) appears as soon as the team goes live. While a
// broadcast is live the frame steps aside for the player; the list stays.
//
// Screen readers do not hear the seconds: the ticking numbers are hidden from them and the timer reads as one sentence
// ("Starts in 2 days and 3 hours") that changes at most once a minute and is never announced by itself; only a change
// of state ("The broadcast is starting now") is announced, politely. With less motion (system setting or the
// accessibility panel) the countdown shows no seconds, so it changes once a minute.
export default function BroadcastStage({ initial, renderedAt, followUrl, titleId, background, live }: Props) {
  const t = useTranslations('communityPage.live');
  const tLive = useTranslations('live');
  const tPage = useTranslations('communityPage');
  const locale = useLocale();
  const [items, setItems] = useState<BroadcastView[]>(initial);
  const now = useNow(renderedAt);
  const hydrated = useHydrated();
  const calm = useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => false);
  const status = useLiveStatus(null, live); // <LiveNow> keeps the poller going on this page
  const { next, phase, others } = scheduleView(items, now, status.live);
  useLivePolling(phase === 'soon' ? STARTING_SOON_POLL_MS : null);

  // Fresh from the browser once, when the page opens (never polled).
  useEffect(() => {
    let cancelled = false;
    void fetchScheduleInBrowser().then((fresh) => {
      if (cancelled || fresh === null) return;
      setItems(fresh.map((item) => broadcastView(item, locale)));
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Announce the moment the countdown ends (not the state the page opened in).
  const [lastPhase, setLastPhase] = useState(phase);
  const [announcement, setAnnouncement] = useState('');
  if (lastPhase !== phase) {
    setLastPhase(phase);
    if (lastPhase === 'countdown' && phase === 'soon') setAnnouncement(t('next.startingNow'));
  }

  const calendarName = t('eyebrow');
  const newTab = <span className="visually-hidden"> {tPage('opensInNewTab')}</span>;

  const timeOf = (item: BroadcastView, large: boolean) => {
    const visitor = hydrated ? formatVisitorTime(item.start, locale) : null;
    const iso = new Date(item.start).toISOString();
    return (
      <dl className={large ? styles.times : styles.itemTimes}>
        <div>
          <dt>{t('next.nazarethTime')}</dt>
          <dd>
            <time dateTime={iso}>{item.when}</time>
          </dd>
        </div>
        {visitor ? (
          <div>
            <dt>{t('next.yourTime')}</dt>
            <dd>
              <time dateTime={iso}>{visitor}</time>
            </dd>
          </div>
        ) : null}
      </dl>
    );
  };

  const stageStatus = next ? (phase === 'soon' ? 'soon' : 'upcoming') : 'offline';

  return (
    <>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true" data-testid="live-stage-announcement">
        {announcement}
      </p>

      {status.live ? null : (
        <section className={`${styles.stage} ${styles[stageStatus]}`} aria-labelledby={titleId} data-status={stageStatus} data-testid="live-stage">
          <span className={styles.bg} aria-hidden="true">
            {background}
          </span>
          <span className={styles.shade} aria-hidden="true" />

          <div className={styles.top}>
            <p className={styles.badge}>
              <span className={styles.dot} aria-hidden="true" />
              {stageStatus === 'offline' ? t('status.offline') : t('status.upcoming')}
            </p>
            <Icon name="broadcast" className={styles.brand} />
          </div>

          <div className={styles.body}>
            {next ? (
              <>
                <p className={styles.kicker}>{t('next.kicker')}</p>
                <h2 id={titleId} className={styles.title} dir="auto">
                  {next.title}
                </h2>

                {phase === 'countdown' ? (
                  <Countdown start={next.start} now={now} hydrated={hydrated} calm={calm} />
                ) : (
                  <div className={styles.soon} data-testid="live-starting-soon">
                    <p className={styles.soonTitle}>{t('next.soonTitle')}</p>
                    <p className={styles.soonText}>{t('next.soonText')}</p>
                  </div>
                )}

                {timeOf(next, true)}
                {next.description ? (
                  <p className={styles.description} dir="auto">
                    {next.description}
                  </p>
                ) : null}
                <button type="button" className={`ui-btn ui-btn--gold ${styles.calendar}`} onClick={() => downloadCalendar(next, locale, calendarName)}>
                  <CalendarAddIcon />
                  {t('next.addToCalendar')}
                </button>
              </>
            ) : (
              <>
                <span className={styles.icon} aria-hidden="true">
                  <Icon name="videoOff" />
                </span>
                <h2 id={titleId} className={styles.title}>
                  {tLive('no_upcoming_events')}
                </h2>
                <p className={styles.hint}>{t('offlineHint')}</p>
                <a href={followUrl} target="_blank" rel="noopener noreferrer" className={`ui-btn ui-btn--glass ${styles.follow}`}>
                  <Icon name="instagram" />
                  {t('follow')}
                  {newTab}
                </a>
              </>
            )}
          </div>
        </section>
      )}

      {others.length ? (
        <section className={styles.more} aria-labelledby="live-upcoming-title" data-testid="live-upcoming">
          <h2 id="live-upcoming-title" className={`ui-h2 ${styles.moreTitle}`}>
            {t('next.moreTitle')}
          </h2>
          <ul className={styles.list}>
            {others.map((item) => {
              const itemTitleId = `live-upcoming-${item.id}`;
              const onAir = status.live && item.status === 'live';
              return (
                <li key={item.id} className={`ui-glass ${styles.item}`}>
                  {onAir ? (
                    <p className={styles.onAir}>
                      <span className={styles.onAirDot} aria-hidden="true" />
                      {t('now.badge')}
                    </p>
                  ) : null}
                  <h3 id={itemTitleId} className={styles.itemTitle} dir="auto">
                    {item.title}
                  </h3>
                  {timeOf(item, false)}
                  {item.description ? (
                    <p className={styles.itemText} dir="auto">
                      {item.description}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className={`ui-btn ui-btn--ghost ui-btn--sm ${styles.itemCalendar}`}
                    aria-describedby={itemTitleId}
                    onClick={() => downloadCalendar(item, locale, calendarName)}
                  >
                    <CalendarAddIcon />
                    {t('next.addToCalendar')}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/** Days (when any), hours, minutes and seconds (not with less motion) in large gold figures. */
function Countdown({ start, now, hydrated, calm }: { start: number; now: number; hydrated: boolean; calm: boolean }) {
  const t = useTranslations('communityPage.live');
  const locale = useLocale();
  const parts = countdownParts(start - now);
  const units = UNITS.filter((unit) => (unit === 'days' ? parts.days > 0 : unit !== 'seconds' || !calm));
  const summary = countdownSummary(start - now);
  const phrase = (unit: 'days' | 'hours' | 'minutes') => t(`next.${unit}`, { count: summary[unit] });
  const spoken =
    summary.kind === 'days'
      ? [phrase('days'), ...(summary.hours ? [phrase('hours')] : [])]
      : summary.kind === 'hours'
        ? [phrase('hours'), ...(summary.minutes ? [phrase('minutes')] : [])]
        : [phrase('minutes')];
  // The language's own "and" ("2 days and 3 hours", "2 jours et 3 heures"); the phrases are plural messages.
  const time = new Intl.ListFormat(locale, { type: 'conjunction', style: 'long' }).format(spoken);

  return (
    <div className={styles.countdown} role="timer" aria-live="off" aria-atomic="true" data-testid="live-countdown">
      <span className={styles.units} aria-hidden="true">
        {/* Two by two, so a narrow screen or a long word wraps the tiles in pairs, never three and one alone. */}
        {[units.slice(0, 2), units.slice(2)].filter((pair) => pair.length).map((pair) => (
          <span key={pair.join()} className={styles.pair}>
            {pair.map((unit) => (
              <span key={unit} className={styles.unit}>
                <span key={unit === 'seconds' ? parts.seconds : unit} className={`${styles.value} ${unit === 'seconds' && hydrated ? styles.tick : ''}`}>
                  {hydrated ? pad(parts[unit]) : '--'}
                </span>
                {/* A plural message, so the label agrees with the number (1 day, 2 days; Russian 1 день, 5 дней). */}
                <span className={styles.unitLabel}>{t(`units.${unit}`, { count: parts[unit] })}</span>
              </span>
            ))}
          </span>
        ))}
      </span>
      <span className="visually-hidden" data-testid="live-countdown-summary">
        {t('next.startsIn', { time })}
      </span>
    </div>
  );
}
