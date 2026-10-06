'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { prefersReducedMotion, subscribeMotion } from '@/lib/motion';
import Icon from './Icon';
import { countdownParts, liveState, type CountdownParts } from './liveSchedule';
import { useHydrated, useNow } from './useNow';
import styles from './LivePlayer.module.css';

export type PlayerBroadcast = {
  id: string;
  /** Start, in milliseconds since the epoch. */
  start: number;
  title: string;
  /** Start already formatted in Nazareth time and the page language (on the server). */
  when: string;
};

type Props = {
  broadcasts: PlayerBroadcast[];
  /** When the server rendered the page; the state shown until the browser takes over. */
  renderedAt: number;
  joinUrl: string;
  titleId: string;
  /** The frame's background photo, rendered on the server. */
  background: ReactNode;
};

const UNITS: (keyof CountdownParts)[] = ['days', 'hours', 'minutes', 'seconds'];

// The cinematic player frame. Its Live / Upcoming / Offline state follows the visitor's clock every
// second, so it goes live at the start time without a page refresh.
export default function LivePlayer({ broadcasts, renderedAt, joinUrl, titleId, background }: Props) {
  const t = useTranslations('communityPage');
  const tLive = useTranslations('live');
  const now = useNow(renderedAt);
  const hydrated = useHydrated();
  const { status, event } = liveState(broadcasts, now);
  // A countdown that changes every second is content that moves by itself (WCAG 2.2.2). For visitors who asked for
  // less motion (system setting or the accessibility panel) it shows no seconds, so it changes once a minute.
  const calm = useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => false);
  const units = calm ? UNITS.filter((unit) => unit !== 'seconds') : UNITS;
  const newTab = <span className="visually-hidden"> {t('opensInNewTab')}</span>;

  return (
    <div className={`${styles.player} ${styles[status]}`} data-status={status}>
      <span className={styles.bg} aria-hidden="true">
        {background}
      </span>
      <span className={styles.shade} aria-hidden="true" />

      <div className={styles.top}>
        <p className={styles.badge} role="status">
          <span className={styles.dot} aria-hidden="true" />
          {t(`live.status.${status}`)}
        </p>
        <Icon name="broadcast" className={styles.brand} />
      </div>

      <div className={styles.body}>
        {event ? (
          <>
            <h2 id={titleId} className={styles.title}>
              {status === 'live' ? tLive('event_ongoing') : tLive('upcoming_event')}
            </h2>
            <p className={styles.event}>{event.title}</p>
            <dl className={styles.meta}>
              <div>
                <dt>{tLive('nazareth_date_time')}</dt>
                <dd>
                  <time dateTime={new Date(event.start).toISOString()}>{event.when}</time>
                </dd>
              </div>
              <div>
                <dt>{tLive('time_remaining')}</dt>
                <dd>
                  {status === 'live' ? (
                    <span className={styles.started}>{t('live.eventStarted')}</span>
                  ) : (
                    <span className={styles.countdown} role="timer">
                      {units.map((unit) => {
                        const value = countdownParts(event.start - now)[unit];
                        return (
                          <span key={unit} className={styles.unit}>
                            <span className={styles.value}>{hydrated ? String(value).padStart(2, '0') : '--'}</span>
                            {/* A plural message, so the label agrees with the number (1 day, 2 days; Russian 1 день, 5 дней). */}
                            <span className={styles.unitLabel}>{t(`live.units.${unit}`, { count: value })}</span>
                          </span>
                        );
                      })}
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            {status === 'live' ? (
              <a
                href={joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`ui-btn ui-btn--gold ${styles.join}`}
              >
                <Icon name="instagram" />
                {tLive('join_live')}
                {newTab}
              </a>
            ) : (
              <>
                <p className={styles.note}>
                  <Icon name="info" className={styles.noteIcon} />
                  {tLive('live_note')}
                </p>
                <button type="button" className={`ui-btn ui-btn--gold ${styles.join}`} disabled>
                  <Icon name="instagram" />
                  {tLive('join_live')}
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <span className={styles.icon} aria-hidden="true">
              <Icon name="videoOff" />
            </span>
            <h2 id={titleId} className={styles.title}>
              {tLive('no_upcoming_events')}
            </h2>
            <p className={styles.hint}>{t('live.offlineHint')}</p>
            <a href={joinUrl} target="_blank" rel="noopener noreferrer" className={`ui-btn ui-btn--glass ${styles.follow}`}>
              <Icon name="instagram" />
              {t('live.follow')}
              {newTab}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
