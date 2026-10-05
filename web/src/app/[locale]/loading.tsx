'use client';

import { useTranslations } from 'next-intl';
import { CrossMark } from '@/components/ui/icons';
import styles from './loading.module.css';

// Shown while a page is being fetched on navigation: the cross mark with a slow gold halo.
// It fades in after a short delay, so a page that arrives quickly never flashes a loader.
export default function Loading() {
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
