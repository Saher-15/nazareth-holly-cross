'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { prefersReducedMotion, REDUCE_MOTION_QUERY } from '@/lib/motion';
import { HERO_VIDEO } from '@/lib/videos';
import styles from './HomeHero.module.css';

type NetworkInformationLike = { saveData?: boolean; effectiveType?: string };

/** The hero film is a wide, silent loop: a phone-sized screen only gets the photo. */
const WIDE_QUERY = '(min-width: 768px)';

// The background video is skipped for visitors who asked for less motion or less data, on a slow connection
// and on a small screen (the photo alone is a better first impression than 2 MB spent on a 6-inch screen).
function videoAllowed() {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  const slow = connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g' || connection?.effectiveType === '3g';
  const wide = window.matchMedia?.(WIDE_QUERY).matches ?? true;
  return !prefersReducedMotion() && !connection?.saveData && !slow && wide;
}

function subscribe(onChange: () => void) {
  const queries = [REDUCE_MOTION_QUERY, WIDE_QUERY].map((q) => window.matchMedia?.(q));
  queries.forEach((q) => q?.addEventListener('change', onChange));
  return () => queries.forEach((q) => q?.removeEventListener('change', onChange));
}

/** Runs `fn` once the page has finished loading and the browser is idle, so the film never competes with the photo. */
function whenIdle(fn: () => void) {
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => !cancelled && fn(), { timeout: 3000 });
    else setTimeout(fn, 1500); // Safari has no requestIdleCallback
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener('load', run);
  };
}

// Server HTML and the first client render show only the poster; the video joins after hydration, once the page
// has loaded, and only where it is wanted (see videoAllowed).
export default function HeroVideo({ poster }: { poster: string }) {
  const allowed = useSyncExternalStore(subscribe, videoAllowed, () => false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => (allowed ? whenIdle(() => setReady(true)) : undefined), [allowed]);

  // Pause while the hero is scrolled out of view: no decoding work nobody sees.
  useEffect(() => {
    const video = ref.current;
    if (!allowed || !ready || !video || typeof IntersectionObserver === 'undefined') return undefined;
    video.muted = true; // autoplay needs muted set as a property too (iOS)
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
    io.observe(video);
    return () => io.disconnect();
  }, [allowed, ready]);

  if (!allowed || !ready) return null;

  return (
    <video
      ref={ref}
      className={`${styles.video} ${playing ? styles.videoOn : ''}`}
      poster={poster}
      preload="auto"
      autoPlay
      loop
      muted
      playsInline
      aria-hidden="true"
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
    >
      {HERO_VIDEO.map((source) => (
        <source key={source.src} src={source.src} type={source.type} />
      ))}
    </video>
  );
}
