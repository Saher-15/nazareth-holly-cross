'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpIcon } from '@/components/ui/icons';
import { scrollBehavior } from '@/lib/motion';
import styles from './BackToTop.module.css';

/** How far the page must be scrolled (in viewport heights) before the button appears. */
const SHOW_AFTER = 1.4;

// A round "back to top" button, bottom corner at the end of the line. It appears after a long scroll,
// is out of the tab order while hidden, and hands the focus to <main> after jumping up so keyboard
// users continue from the top of the content, not from a button that just disappeared.
export default function BackToTop() {
  const t = useTranslations('ux');
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setShown(window.scrollY > window.innerHeight * SHOW_AFTER);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const goTop = () => {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    document.getElementById('main')?.focus({ preventScroll: true });
  };

  return (
    <button
      type="button"
      className={`${styles.button} ${shown ? styles.shown : ''}`}
      onClick={goTop}
      aria-label={t('backToTop')}
      data-print="hide"
      data-shown={shown}
    >
      <ArrowUpIcon size={22} />
    </button>
  );
}
