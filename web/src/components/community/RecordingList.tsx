'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PlayIcon } from '@/components/ui/icons';
import { fetchRecordingsInBrowser, isoDuration, nazarethDay, recordingView, type RecordingView } from '@/lib/liveRecordings';
import styles from './RecordingList.module.css';

// The recordings of past live broadcasts (GET /live/recordings), first in the "Past broadcasts" list of /live, newest
// first. Each shows Cloudflare Stream's poster (lazy, decorative) under one button, "Play: <title>"; only a press
// replaces it with Cloudflare's player in a frame (and moves the focus into it), one recording at a time, so the page
// never loads a player nobody asked for. Fresh from the browser once when the page opens; never polled.
// The <li> items go into the list of <PastBroadcasts>, before its own recordings.
export default function RecordingList({ initial }: { initial: RecordingView[] }) {
  const t = useTranslations('communityPage.live.recordings');
  const locale = useLocale();
  const [items, setItems] = useState(initial);
  const [playing, setPlaying] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchRecordingsInBrowser().then((fresh) => {
      if (cancelled || fresh === null) return;
      setItems(fresh.map((recording) => recordingView(recording, locale)));
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // The visitor pressed play: the keyboard goes on inside the player.
  useEffect(() => {
    if (playing) frameRef.current?.focus();
  }, [playing]);

  // An odd number of recordings: the newest spans the whole row, so the posters below stay in pairs.
  const wideFirst = items.length % 2 === 1;

  return (
    <>
      {items.map((item, index) => {
        const titleId = `recording-${item.id}-title`;
        const isPlaying = playing === item.id;
        return (
          <li key={item.id} className={`ui-glass ${styles.item} ${wideFirst && index === 0 ? styles.wide : ''}`} data-testid="live-recording">
            <div className={styles.frame}>
              {isPlaying ? (
                <iframe
                  ref={frameRef}
                  src={`${item.playbackUrl}?autoplay=true`}
                  title={t('playerTitle', { title: item.title })}
                  className={styles.player}
                  allow="fullscreen; picture-in-picture; autoplay"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  data-testid="live-recording-player"
                />
              ) : (
                <button type="button" className={styles.play} aria-label={t('play', { title: item.title })} onClick={() => setPlaying(item.id)}>
                  {/* The poster is decorative: the button's name says what it plays. Cloudflare's own picture,
                      not optimised by Next (only Firebase Storage is), so a plain lazy <img>. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.poster} src={item.thumbnailUrl} alt="" loading="lazy" decoding="async" width={640} height={360} />
                  <span className={styles.playIcon} aria-hidden="true">
                    <PlayIcon size={28} />
                  </span>
                </button>
              )}
            </div>
            <div className={styles.body}>
              <h3 id={titleId} className="ui-h3" dir="auto">
                {item.title}
              </h3>
              {item.dateLabel || item.durationLabel ? (
                <p className={styles.meta}>
                  {item.dateLabel && item.date !== null ? <time dateTime={nazarethDay(item.date)}>{item.dateLabel}</time> : null}
                  {item.durationLabel ? (
                    <time className={styles.duration} dateTime={isoDuration(item.durationSeconds)}>
                      {item.durationLabel}
                    </time>
                  ) : null}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </>
  );
}
