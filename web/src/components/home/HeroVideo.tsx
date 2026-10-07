'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MOTION_PAUSE_EVENT, MOTION_SCOPE_ATTRIBUTE } from '@/components/ui/MotionToggle';
import { prefersReducedMotion, subscribeMotion } from '@/lib/motion';
import { HERO_TOUR_PARTS, HERO_TOUR_TYPE, HERO_VIDEO } from '@/lib/videos';
import styles from './HomeHero.module.css';

type NetworkInformationLike = EventTarget & { saveData?: boolean; effectiveType?: string };

/** The hero film is a wide, silent background: a phone-sized screen only gets the photo. */
export const WIDE_QUERY = '(min-width: 768px)';

/** How long before the end of a part the next one starts to load. */
export const PRELOAD_NEXT_SECONDS = 8;

export type FilmConditions = {
  reducedMotion: boolean;
  wide: boolean;
  /** navigator.connection, where the browser has it (Chromium); Safari and Firefox do not tell. */
  saveData?: boolean;
  effectiveType?: string;
};

/**
 * Whether the hero film may play. Never for visitors who asked for less motion (system setting or the accessibility
 * panel's "Stop animations"), never on a screen narrower than 768 px, never when the browser says the visitor wants to
 * save data, and only on a connection the browser rates as good (effectiveType "4g"). A browser that does not report
 * its connection (Safari, Firefox) is treated as a good desktop connection.
 */
export function filmAllowed({ reducedMotion, wide, saveData, effectiveType }: FilmConditions): boolean {
  if (reducedMotion || !wide || saveData) return false;
  return effectiveType === undefined || effectiveType === '4g';
}

/** What the hero plays: the whole tour in parts, or the 16 s loop (the tour cannot be played or failed to load). */
export type FilmPlan = { mode: 'tour'; parts: readonly string[] } | { mode: 'loop'; src: string } | null;

/** The 16 s loop, in the first format the browser plays; null when it plays none (the photo stays). */
export function loopPlan(canPlay: (type: string) => boolean): FilmPlan {
  const source = HERO_VIDEO.find((s) => canPlay(s.type));
  return source ? { mode: 'loop', src: source.src } : null;
}

/** The tour where the browser plays H.264 (every browser but Playwright's own Chromium), else the loop. */
export function filmPlan(canPlay: (type: string) => boolean): FilmPlan {
  return canPlay(HERO_TOUR_TYPE) ? { mode: 'tour', parts: HERO_TOUR_PARTS } : loopPlan(canPlay);
}

const connection = () => (navigator as Navigator & { connection?: NetworkInformationLike }).connection;

function videoAllowed() {
  const info = connection();
  return filmAllowed({
    reducedMotion: prefersReducedMotion(),
    wide: window.matchMedia?.(WIDE_QUERY).matches ?? true,
    saveData: info?.saveData,
    effectiveType: info?.effectiveType,
  });
}

/** Whether a film that has started may go on: the connection is judged once, at the start (its rating wobbles). */
function stillAllowed() {
  return filmAllowed({ reducedMotion: prefersReducedMotion(), wide: window.matchMedia?.(WIDE_QUERY).matches ?? true });
}

// The motion preference (system or accessibility panel), the screen width and the connection can change while the
// page is open.
function subscribe(onChange: () => void) {
  const wide = window.matchMedia?.(WIDE_QUERY);
  wide?.addEventListener('change', onChange);
  const info = connection();
  info?.addEventListener?.('change', onChange);
  const stopMotion = subscribeMotion(onChange);
  return () => {
    wide?.removeEventListener('change', onChange);
    info?.removeEventListener?.('change', onChange);
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

const canPlayHere = (type: string) => document.createElement('video').canPlayType(type) !== '';

/**
 * Plays only while the film is in view, the tab is visible and the hero's motion is not paused (<MotionToggle>,
 * WCAG 2.2.2). `current()` is the element on screen. Returns `update` (apply the rules now) and `stop` (clean up).
 */
function playWhileWanted(box: HTMLElement, current: () => HTMLVideoElement): { update: () => void; stop: () => void } {
  const scope = box.closest<HTMLElement>(`[${MOTION_SCOPE_ATTRIBUTE}]`);
  let visible = false;
  const update = () => {
    const video = current();
    const paused = scope?.hasAttribute('data-motion-paused') ?? false;
    if (visible && !paused && !document.hidden) video.play().catch(() => {});
    else video.pause();
  };
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  });
  io.observe(box);
  scope?.addEventListener(MOTION_PAUSE_EVENT, update);
  document.addEventListener('visibilitychange', update);
  return {
    update,
    stop: () => {
      io.disconnect();
      scope?.removeEventListener(MOTION_PAUSE_EVENT, update);
      document.removeEventListener('visibilitychange', update);
    },
  };
}

// Server HTML and the first client render show only the photo (the LCP image); the film joins after hydration, once the
// page has loaded and the browser is idle, and only where it is wanted (filmAllowed). Nothing of it downloads until it
// is asked to play, which happens only while the hero is on screen, the tab is visible and the visitor has not paused
// it. It fades in over the photo once it really plays.
//
// The tour is twelve 30-second parts on two stacked <video> elements: one plays, the other loads the next part a few
// seconds before the end and takes over when the part ends, so the film runs on without a gap while the browser never
// holds more than two parts (it buffers about a minute ahead of a single long file). After the last part it starts again. If
// any part fails to load, the 16 s loop takes the tour's place; if that fails too, the photo stays.
export default function HeroVideo() {
  const startable = useSyncExternalStore(subscribe, videoAllowed, () => false);
  const allowed = useSyncExternalStore(subscribe, stillAllowed, () => false);
  const [plan, setPlan] = useState<FilmPlan>(null);
  const [playing, setPlaying] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLVideoElement>(null);
  const second = useRef<HTMLVideoElement>(null);

  // Chosen once: a later change of the connection rating neither restarts the film nor undoes a fall-back to the loop.
  useEffect(() => (startable && !plan ? whenIdle(() => setPlan((current) => current ?? filmPlan(canPlayHere))) : undefined), [startable, plan]);

  useEffect(() => {
    const container = box.current;
    const a = first.current;
    if (!allowed || !plan || !container || !a || typeof IntersectionObserver === 'undefined') return undefined;
    const fallBack = () => {
      setPlaying(false);
      setPlan(plan.mode === 'tour' ? loopPlan(canPlayHere) : null);
    };

    if (plan.mode === 'loop') {
      a.muted = true; // autoplay needs muted set as a property too (iOS)
      const control = playWhileWanted(container, () => a);
      a.addEventListener('error', fallBack);
      return () => {
        control.stop();
        a.removeEventListener('error', fallBack);
        a.pause();
      };
    }

    const b = second.current;
    if (!b) return undefined;
    const players = [a, b];
    const parts = plan.parts;
    let front = 0; // the element on screen
    let part = 0; // the part it plays
    let queued = -1; // the part already loading on the other element
    const show = () => {
      players.forEach((video, i) => {
        video.dataset.front = String(i === front);
      });
    };
    const control = playWhileWanted(container, () => players[front]);

    const queueNext = () => {
      const next = (part + 1) % parts.length;
      if (queued === next) return;
      const back = players[1 - front];
      back.preload = 'auto';
      back.src = parts[next];
      queued = next;
    };
    const onTime = (event: Event) => {
      const video = players[front];
      if (event.target !== video || !video.duration) return;
      if (video.duration - video.currentTime <= PRELOAD_NEXT_SECONDS) queueNext();
    };
    const onEnded = (event: Event) => {
      if (event.target !== players[front]) return;
      queueNext();
      part = queued;
      front = 1 - front;
      show();
      control.update();
    };
    const onPlaying = () => setPlaying(true);

    players.forEach((video) => {
      video.muted = true;
      video.addEventListener('timeupdate', onTime);
      video.addEventListener('ended', onEnded);
      video.addEventListener('playing', onPlaying);
      video.addEventListener('error', fallBack);
    });
    a.src = parts[0];
    show();
    control.update();

    return () => {
      control.stop();
      players.forEach((video) => {
        video.removeEventListener('timeupdate', onTime);
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('error', fallBack);
        video.pause();
      });
    };
  }, [allowed, plan]);

  if (!allowed || !plan) return null;

  const common = {
    muted: true,
    playsInline: true,
    disablePictureInPicture: true,
    preload: 'none',
    'aria-hidden': true,
    tabIndex: -1,
  } as const;

  return (
    <div ref={box} className={`${styles.video} ${playing ? styles.videoOn : ''}`} data-film={plan.mode} aria-hidden="true">
      {plan.mode === 'loop' ? (
        <video key={plan.src} ref={first} className={styles.film} src={plan.src} loop onPlaying={() => setPlaying(true)} {...common} />
      ) : (
        <>
          <video key="tour-a" ref={first} className={`${styles.film} ${styles.part}`} {...common} />
          <video key="tour-b" ref={second} className={`${styles.film} ${styles.part}`} {...common} />
        </>
      )}
    </div>
  );
}
