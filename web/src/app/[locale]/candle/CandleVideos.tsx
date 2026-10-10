'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import gridStyles from '@/components/community/PastBroadcasts.module.css';
import styles from '@/components/community/RecordingList.module.css';
import { PlayIcon } from '@/components/ui/icons';
import type { CandleVideo } from '@/lib/api';

// The candle page's videos (the dashboard's "Candle page videos", docs/ADMIN.md 5.5). Like the broadcast recordings
// on /live: a poster button, and Cloudflare's player only after a press (nothing is downloaded before that).
export default function CandleVideos({ videos }: { videos: CandleVideo[] }) {
  const t = useTranslations('candle');
  const [playing, setPlaying] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (playing) frameRef.current?.focus();
  }, [playing]);

  if (videos.length === 0) return null;
  const wideFirst = videos.length % 2 === 1;
  return (
    <section className="ui-container" aria-labelledby="candle-videos-title" data-testid="candle-videos">
      <h2 id="candle-videos-title" className="ui-h2">{t('videosTitle')}</h2>
      <p>{t('videosLead')}</p>
      <ul className={gridStyles.grid}>
        {videos.map((video, index) => (
          <li key={video.id} className={`ui-glass ${styles.item} ${wideFirst && index === 0 ? styles.wide : ''}`} data-testid="candle-video">
            <div className={styles.frame}>
              {playing === video.id ? (
                <iframe
                  ref={frameRef}
                  src={`${video.playbackUrl}?autoplay=true`}
                  title={t('videoPlayerTitle', { title: video.title })}
                  className={styles.player}
                  allow="fullscreen; picture-in-picture; autoplay"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <button type="button" className={styles.play} aria-label={t('videoPlay', { title: video.title })} onClick={() => setPlaying(video.id)}>
                  {/* Decorative: the button's name says what it plays. Cloudflare's own poster, a plain lazy <img>. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.poster} src={video.thumbnailUrl} alt="" loading="lazy" decoding="async" width={640} height={360} />
                  <span className={styles.playIcon} aria-hidden="true">
                    <PlayIcon size={28} />
                  </span>
                </button>
              )}
            </div>
            <div className={styles.body}>
              <h3 className="ui-h3" dir="auto">{video.title}</h3>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
