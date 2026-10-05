'use client';

import { useEffect, useRef, useState } from 'react';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { usePathname } from '@/i18n/navigation';
import { prefersReducedMotion } from '@/lib/motion';
import styles from './PageTransitions.module.css';

/** The longest the old page is held on screen while the next one loads; after that the page just switches. */
const MAX_WAIT_MS = 700;
/** A navigation still running after this long gets the branded loading screen (fast ones never flash it). */
const SLOW_AFTER_MS = 900;
/** Safety net: never leave the loading screen up for more than this (a failed navigation). */
const GIVE_UP_MS = 12000;

/** True for a plain left click on a link that Next will turn into a client-side navigation. */
export function isPageLinkClick(e: MouseEvent, currentPath: string): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  // Next's <Link> calls preventDefault() when it takes over; an ordinary anchor (external, download) does not.
  if (!e.defaultPrevented) return false;
  const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  if (url.pathname === currentPath && url.search === window.location.search) return false; // hash jump or same page
  return true;
}

// Two things that happen when a visitor follows an internal link:
//  1. Page transition (View Transitions API): the old page is held while Next loads the new one, then it fades
//     out and the new one fades in with a small rise (CSS: .vt-page and ::view-transition-* in globals.css).
//     Browsers without the API and visitors who prefer reduced motion get the normal instant navigation.
//  2. Loading feedback: if the new page takes longer than ~1s (slow phone connection) the branded loading screen
//     covers the old page until it arrives.
// Both hook into link clicks only, so they never touch how a page is first rendered or hydrated. (A
// loading.tsx file was tried instead: a Suspense boundary above the catch-all route turns its 404 into a
// "soft 404" with status 200, and boundaries on the form pages made React render a second hidden copy of the
// page while hydrating. Back/forward and the language menu are not covered.)
export default function PageTransitions() {
  const pathname = usePathname();
  const release = useRef<(() => void) | null>(null);
  const slowTimer = useRef(0);
  const giveUpTimer = useRef(0);
  const [slow, setSlow] = useState(false);

  // The new page is in place: let the browser take its picture and drop the loading screen.
  useEffect(() => {
    release.current?.();
    window.clearTimeout(slowTimer.current);
    window.clearTimeout(giveUpTimer.current);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting the overlay when the route has changed
    setSlow(false);
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;

    const onClick = (e: MouseEvent) => {
      if (!isPageLinkClick(e, window.location.pathname)) return;

      window.clearTimeout(slowTimer.current);
      window.clearTimeout(giveUpTimer.current);
      slowTimer.current = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
      giveUpTimer.current = window.setTimeout(() => setSlow(false), GIVE_UP_MS);

      if (prefersReducedMotion() || release.current || typeof document.startViewTransition !== 'function') return;
      let timer = 0;
      const transition = document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            const done = () => {
              window.clearTimeout(timer);
              release.current = null;
              resolve();
            };
            release.current = done;
            timer = window.setTimeout(done, MAX_WAIT_MS);
          }),
      );
      root.classList.add('vt-page');
      const cleanup = () => root.classList.remove('vt-page');
      transition.finished.then(cleanup, cleanup);
    };

    // Bubble phase on the document: React's own handlers (Next's <Link>) have run by then.
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      window.clearTimeout(slowTimer.current);
      window.clearTimeout(giveUpTimer.current);
    };
  }, []);

  if (!slow) return null;
  return (
    <div className={styles.overlay} data-print="hide" data-testid="navigation-loading">
      <LoadingScreen />
    </div>
  );
}
