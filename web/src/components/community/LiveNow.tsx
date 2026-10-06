'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { fetchLiveStatus, LiveStatusError, nextPollDelay, type LiveStatus } from '@/lib/liveStatus';
import { useNow } from './useNow';
import styles from './LiveNow.module.css';

type Props = {
  /** What the server knew when it rendered the page (possibly a few seconds old, or "not live" at first). */
  initial: LiveStatus;
  /** When the server last asked the API (null: it never has, so the browser asks at once). */
  checkedAt: number | null;
  renderedAt: number;
};

/** A check is skipped when the last one is younger than this (switching tabs quickly does not ask again). */
const MIN_GAP_MS = 5_000;
const POLL_MS = nextPollDelay(0);

// The broadcast that is live right now (docs/LIVE.md), above the schedule of the /live page. It asks the API about
// every 15 seconds while the page is visible, at once when the page comes back into view, never while it is hidden,
// and less often after failures. The first question waits until the server's own answer is 15 seconds old (a visitor
// who only glances at the page costs the API nothing). When nothing is live it renders nothing and the schedule below stays as it was.
// The player is Cloudflare Stream's own page in a frame (it plays WebRTC/WHEP by itself, with its own controls:
// play, pause, volume, full screen); only a Cloudflare player address is ever framed (lib/liveStatus.ts, CSP frame-src).
export default function LiveNow({ initial, checkedAt, renderedAt }: Props) {
  const t = useTranslations('communityPage.live.now');
  const [status, setStatus] = useState<LiveStatus>(initial);
  const [announcement, setAnnouncement] = useState('');
  const previous = useRef<LiveStatus>(initial);
  const now = useNow(renderedAt);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let failures = 0;
    let lastCheck = 0;
    let stopped = false;

    const apply = (next: LiveStatus) => {
      const before = previous.current;
      previous.current = next;
      if (next.live && (!before.live || before.playbackUrl !== next.playbackUrl)) setAnnouncement(t('started', { title: next.title }));
      else if (!next.live && before.live) setAnnouncement(t('ended'));
      setStatus(next);
    };

    const poll = async () => {
      clearTimeout(timer);
      if (stopped || document.visibilityState === 'hidden') return; // resumes when the page is visible again
      controller?.abort();
      const own = new AbortController();
      controller = own;
      lastCheck = Date.now();
      let retryAfter: number | null = null;
      try {
        apply(await fetchLiveStatus(own.signal));
        failures = 0;
      } catch (error) {
        if (stopped || own.signal.aborted) return;
        failures += 1;
        retryAfter = error instanceof LiveStatusError ? error.retryAfterSeconds : null;
      }
      if (!stopped) timer = setTimeout(poll, nextPollDelay(failures, retryAfter));
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck >= MIN_GAP_MS) void poll();
    };

    const first = checkedAt === null ? 0 : Math.min(Math.max(checkedAt + POLL_MS - Date.now(), 1_000), POLL_MS);
    lastCheck = checkedAt ?? 0;
    timer = setTimeout(poll, first);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [t, checkedAt]);

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
