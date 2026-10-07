'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LiveStatus } from '@/lib/liveStatus';
import { LIVE_PAGE_POLL_MS } from '@/lib/liveStatusStore';
import { useLiveStatus } from '@/lib/useLiveStatus';
import { useNow } from './useNow';
import styles from './LiveNow.module.css';

type Props = {
  /** What the server knew when it rendered the page (possibly a few seconds old, or "not live" at first). */
  initial: LiveStatus;
  /** When the server last asked the API (null: it never has, so the browser asks at once). */
  checkedAt: number | null;
  renderedAt: number;
};

// The broadcast that is live right now (docs/LIVE.md), at the top of the /live page. It reads the tab's one live-status
// poller (lib/liveStatusStore.ts) and asks it to check about every 15 seconds while the page is visible (never while it
// is hidden, less often after failures; the first question waits until the server's own answer is 15 seconds old, so a
// visitor who only glances at the page costs the API nothing). When nothing is live it renders nothing.
// The player is Cloudflare Stream's own page in a frame (it plays WebRTC/WHEP by itself, with its own controls:
// play, pause, volume, full screen); only a Cloudflare player address is ever framed (lib/liveStatus.ts, CSP frame-src).
export default function LiveNow({ initial, checkedAt, renderedAt }: Props) {
  const t = useTranslations('communityPage.live.now');
  const status = useLiveStatus(LIVE_PAGE_POLL_MS, { initial, checkedAt });
  const now = useNow(renderedAt);

  // A start or an end is announced once, when it happens (not for what the page showed when it opened).
  const [previous, setPrevious] = useState<LiveStatus>(status);
  const [announcement, setAnnouncement] = useState('');
  if (previous !== status) {
    setPrevious(status);
    if (status.live && (!previous.live || previous.playbackUrl !== status.playbackUrl)) setAnnouncement(t('started', { title: status.title }));
    else if (!status.live && previous.live) setAnnouncement(t('ended'));
  }

  const minutes = status.live ? Math.max(0, Math.floor((now - status.startedAt) / 60_000)) : 0;

  return (
    <>
      {/* Always in the page, so screen readers hear "a broadcast has started / has ended" when it changes. */}
      <p className="visually-hidden" aria-live="polite" aria-atomic="true" data-testid="live-now-announcement">
        {announcement}
      </p>
      {status.live ? (
        <section className={styles.live} aria-labelledby="live-now-title" data-testid="live-now">
          <div className={styles.head}>
            <p className={styles.badge}>
              <span className={styles.dot} aria-hidden="true" />
              {t('badge')}
            </p>
            <h2 id="live-now-title" className={styles.title} dir="auto">
              {status.title}
            </h2>
            <p className={styles.since}>
              <time dateTime={new Date(status.startedAt).toISOString()}>{t('since', { minutes })}</time>
            </p>
          </div>
          <div className={styles.frame}>
            <iframe
              key={status.playbackUrl}
              src={status.playbackUrl}
              title={t('playerTitle', { title: status.title })}
              className={styles.player}
              allow="fullscreen; picture-in-picture; autoplay"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              data-testid="live-now-player"
            />
          </div>
          <p className={styles.note}>{t('note')}</p>
        </section>
      ) : null}
    </>
  );
}
