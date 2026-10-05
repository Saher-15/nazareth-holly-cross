'use client';

import type { ReactNode, Ref } from 'react';
import { useTranslations } from 'next-intl';
import { CONTACT_EMAIL } from '@/lib/config';
import Flame from '@/components/ui/Flame';
import { CheckIcon } from '@/components/ui/icons';
import Notice from '@/components/ui/Notice';
import type { SaveStatus } from './hooks';
import { HeartIcon } from './icons';
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
        {icon === 'flame' && <Flame size="lg" />}
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
        <Notice role="alert" className={styles.doneNotice}>
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
        </Notice>
      )}
      {action && <div className={styles.doneActions}>{action}</div>}
    </div>
  );
}
