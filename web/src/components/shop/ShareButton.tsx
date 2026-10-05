'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import ShopIcon from './ShopIcon';
import styles from './ShareButton.module.css';

const TOAST_MS = 3500;

type Toast = { kind: 'ok' | 'error'; text: string } | null;

// Shares the product page with the phone's share sheet (navigator.share); where there is
// none (most desktops), it copies the link and says so in a short toast.
export default function ShareButton({ name, className = '' }: { name: string; className?: string }) {
  const t = useTranslations('shopFeatures.share');
  const [toast, setToast] = useState<Toast>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (next: Toast) => {
    setToast(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  const share = async () => {
    const url = window.location.href.split('#')[0];
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: name, text: t('text', { name }), url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return; // the visitor closed the sheet
        // any other failure: fall back to copying the link
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      show({ kind: 'ok', text: t('copied') });
    } catch {
      show({ kind: 'error', text: t('failed') });
    }
  };

  return (
    <>
      <button type="button" className={`${styles.button} ${className}`} onClick={share} data-testid="share-button">
        <ShopIcon name="share" className={styles.icon} />
        <span>{t('button')}</span>
      </button>
      <div className={styles.toastRegion} role="status" aria-live="polite">
        {toast && (
          <p className={styles.toast} data-kind={toast.kind} data-testid="toast">
            <ShopIcon name={toast.kind === 'ok' ? 'check' : 'alert'} className={styles.toastIcon} />
            <span>{toast.text}</span>
          </p>
        )}
      </div>
    </>
  );
}
