import type { ReactNode } from 'react';
import { AlertIcon } from './icons';
import styles from './Notice.module.css';

type Props = {
  /** `danger` for something that went wrong, `info` for a neutral note. */
  tone?: 'danger' | 'info';
  /** `alert` is announced at once, `status` politely; leave out for a static note. */
  role?: 'alert' | 'status';
  className?: string;
  children: ReactNode;
};

// A boxed message with an icon: payment errors, form-level errors, "payment cancelled" and the like.
export default function Notice({ tone = 'danger', role, className = '', children }: Props) {
  return (
    <div className={`${styles.notice} ${styles[tone]} ${className}`} role={role}>
      <AlertIcon />
      <div className={styles.body}>{children}</div>
    </div>
  );
}
