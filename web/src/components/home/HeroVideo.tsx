'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MOTION_PAUSE_EVENT, MOTION_SCOPE_ATTRIBUTE } from '@/components/ui/MotionToggle';
import { prefersReducedMotion, subscribeMotion } from '@/lib/motion';
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

// The motion preference (system or accessibility panel) and the screen width can change while the page is open.
function subscribe(onChange: () => void) {
  const wide = window.matchMedia?.(WIDE_QUERY);
  wide?.addEventListener('change', onChange);
  const stopMotion = subscribeMotion(onChange);
  return () => {
    wide?.removeEventListener('change', onChange);
    stopMotion();
  };
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

  // Pause while the hero is scrolled out of view (no decoding work nobody sees) and while the visitor has paused
  // the hero's motion with its pause button (<MotionToggle>, WCAG 2.2.2).
  useEffect(() => {
    const video = ref.current;
    if (!allowed || !ready || !video || typeof IntersectionObserver === 'undefined') return undefined;
    video.muted = true; // autoplay needs muted set as a property too (iOS)
    const scope = video.closest<HTMLElement>(`[${MOTION_SCOPE_ATTRIBUTE}]`);
    let visible = false;
    const update = () => {
      const paused = scope?.hasAttribute('data-motion-paused') ?? false;
      if (visible && !paused) video.play().catch(() => {});
      else video.pause();
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    io.observe(video);
    scope?.addEventListener(MOTION_PAUSE_EVENT, update);
    return () => {
      io.disconnect();
      scope?.removeEventListener(MOTION_PAUSE_EVENT, update);
    };
  }, [allowed, ready]);

  if (!allowed || !ready) return null;

  return (
    <video
      ref={ref}
      className={`${styles.video} ${playing ? styles.videoOn : ''}`}
      poster={poster}
      preload="auto"
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
