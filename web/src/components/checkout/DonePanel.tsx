'use client';

import type { ReactNode, Ref } from 'react';
import { useTranslations } from 'next-intl';
import { CONTACT_EMAIL } from '@/lib/config';
import type { SaveStatus } from './hooks';
import { AlertIcon, CheckIcon, HeartIcon } from './icons';
import styles from './checkout.module.css';

type Props = {
  icon: 'check' | 'flame' | 'heart';
  title: string;
  headingRef?: Ref<HTMLHeadingElement>;
  reference?: string; // PayPal's id for the payment
  saveStatus?: SaveStatus | null;
  onRetry?: () => void;
  action?: ReactNode;
  children?: ReactNode;
};

// The thank-you panel shown once PayPal reports the payment as completed.
export default function DonePanel({ icon, title, headingRef, reference, saveStatus, onRetry, action, children }: Props) {
  const t = useTranslations('checkoutPage.payment');
  const retry = useTranslations('home')('retry');

  return (
    <div className={styles.done}>
      <span className={`${styles.doneIcon} ${icon === 'flame' ? styles.doneIconFlame : ''}`} aria-hidden="true">
        {icon === 'check' && <CheckIcon size={30} />}
        {icon === 'heart' && <HeartIcon size={30} />}
        {icon === 'flame' && <span className={`${styles.flame} ${styles.flameLg}`} />}
      </span>
      <h2 ref={headingRef} tabIndex={-1} className={styles.doneTitle}>
        {title}
      </h2>
      {children}
      {reference && <p className={styles.reference}>{t('reference', { id: reference })}</p>}
      <p role="status" className={saveStatus === 'saving' ? undefined : 'visually-hidden'}>
        {saveStatus === 'saving' ? t('saving') : ''}
      </p>
      {saveStatus === 'failed' && (
        <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
          <AlertIcon />
          <div>
            <p>
              {t.rich('saveFailed', {
                email: CONTACT_EMAIL,
                mail: (chunks) => <a href={`mailto:${CONTACT_EMAIL}`}>{chunks}</a>,
              })}
            </p>
            {onRetry && (
              <button type="button" className="ui-btn ui-btn--ghost" onClick={onRetry}>
                {retry}
              </button>
            )}
          </div>
        </div>
      )}
      {action && <div className={styles.doneActions}>{action}</div>}
    </div>
  );
}
