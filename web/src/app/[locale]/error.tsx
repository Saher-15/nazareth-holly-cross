'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { AlertIcon } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import styles from './error.module.css';

// Catches anything unexpected while a page renders (the shop has its own, friendlier boundary).
// The heading takes the focus, so a screen-reader visitor hears what happened at once.
export default function LocaleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations('ux.error');
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
    heading.current?.focus();
  }, [error]);

  return (
    <div className={`ui-page ${styles.page}`}>
      <div className={`ui-container ${styles.wrap}`}>
        <div className="ui-state ui-state--error" role="alert">
          <AlertIcon size={40} />
          <h1 className="ui-state__title" ref={heading} tabIndex={-1}>
            {t('title')}
          </h1>
          <p className="ui-state__text">{t('text')}</p>
          {error.digest && (
            <p className={styles.digest}>
              {t('reference')}: <span className="ui-ltr">{error.digest}</span>
            </p>
          )}
          <div className={styles.actions}>
            <button type="button" className="ui-btn ui-btn--gold" onClick={() => retry()}>
              {t('retry')}
            </button>
            <Link href="/" className="ui-btn ui-btn--ghost">
              {t('home')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
