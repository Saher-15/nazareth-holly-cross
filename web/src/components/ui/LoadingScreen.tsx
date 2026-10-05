'use client';

import { useTranslations } from 'next-intl';
import { CrossMark } from './icons';
import styles from './LoadingScreen.module.css';

// The branded loading state: the cross mark with a slow gold halo. It fades in after a short delay, so a
// quick page never flashes a loader. Shown by PageTransitions over the old page when a navigation is slow.
// (There is deliberately no loading.tsx using it: see the note in PageTransitions.tsx.)
export default function LoadingScreen() {
  const t = useTranslations('ux');
  return (
    <div className={`ui-page ${styles.page}`} role="status" aria-live="polite">
      <div className={styles.mark} aria-hidden="true">
        <span className={styles.halo} />
        <CrossMark size={64} className={styles.cross} />
      </div>
      <p className={styles.label}>{t('loading')}</p>
    </div>
  );
}
