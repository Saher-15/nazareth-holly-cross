'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import styles from './HomeHero.module.css';

export const HERO_VIDEO_URL =
  'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fvideo-7.mp4?alt=media&token=b0173721-21a1-46d0-b15b-f2001b912e72';

type NetworkInformationLike = { saveData?: boolean };

const REDUCE_MOTION = '(prefers-reduced-motion: reduce)';

// The background video is skipped for visitors who asked for less motion or less data.
function videoAllowed() {
  const reduce = window.matchMedia?.(REDUCE_MOTION).matches ?? false;
  const saveData = (navigator as Navigator & { connection?: NetworkInformationLike }).connection?.saveData ?? false;
  return !reduce && !saveData;
}

function subscribe(onChange: () => void) {
  const query = window.matchMedia?.(REDUCE_MOTION);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

// Server HTML and the first client render show only the poster; the video joins after hydration.
export default function HeroVideo({ poster }: { poster: string }) {
  const allowed = useSyncExternalStore(subscribe, videoAllowed, () => false);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  // Pause while the hero is scrolled out of view: no decoding work nobody sees.
  useEffect(() => {
    const video = ref.current;
    if (!allowed || !video || typeof IntersectionObserver === 'undefined') return undefined;
    video.muted = true; // autoplay needs muted set as a property too (iOS)
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
    io.observe(video);
    return () => io.disconnect();
  }, [allowed]);

  if (!allowed) return null;

  return (
    <video
      ref={ref}
      className={`${styles.video} ${playing ? styles.videoOn : ''}`}
      src={HERO_VIDEO_URL}
      poster={poster}
      preload="none"
      autoPlay
      loop
      muted
      playsInline
      aria-hidden="true"
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
    />
  );
}
