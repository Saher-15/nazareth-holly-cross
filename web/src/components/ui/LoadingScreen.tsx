'use client';

import { useTranslations } from 'next-intl';
import { CrossMark } from './icons';
import styles from './LoadingScreen.module.css';

// The branded loading state of a page: the cross mark with a slow gold halo. It fades in after a short
// delay, so a page that arrives quickly never flashes a loader. Each page folder re-exports it as its
// loading.tsx. (There is deliberately no app/[locale]/loading.tsx: a Suspense boundary above the
// catch-all route would stream its 404 page with status 200, a "soft 404".)
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
