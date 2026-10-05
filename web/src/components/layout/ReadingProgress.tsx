'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from '@/i18n/navigation';
import styles from './ReadingProgress.module.css';

/** Pages long enough to want a progress line: every holy-site page, the tour and the about page. */
export const isLongPage = (pathname: string) => /^\/sites\/[^/]+\/?$/.test(pathname) || pathname === '/tour' || pathname === '/about';

/** 0 at the top of the page, 1 at the bottom. A page that fits the screen has no progress. */
export function readingFraction(scrollY: number, scrollHeight: number, viewportHeight: number): number {
  const scrollable = scrollHeight - viewportHeight;
  if (scrollable <= 0) return 0;
  return Math.min(1, Math.max(0, scrollY / scrollable));
}

// A thin gold line across the top of the window that fills as the visitor reads down a long page.
// It grows from the start of the line (the right edge in Hebrew and Arabic) and is decorative, so
// it is hidden from assistive technology and from print.
export default function ReadingProgress() {
  const pathname = usePathname();
  const active = isLongPage(pathname);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const bar = barRef.current;
      if (!bar) return;
      const root = document.documentElement;
      const fraction = readingFraction(window.scrollY, root.scrollHeight, window.innerHeight);
      bar.style.transform = `scaleX(${fraction})`;
      bar.parentElement?.setAttribute('data-visible', fraction > 0.005 ? 'true' : 'false');
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [active, pathname]);

  if (!active) return null;
  return (
    <div className={styles.track} aria-hidden="true" data-print="hide" data-visible="false" data-testid="reading-progress">
      <div ref={barRef} className={styles.bar} />
    </div>
  );
}
