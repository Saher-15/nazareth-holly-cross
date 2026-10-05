'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from './icons';
import styles from './Toast.module.css';

export type ToastKind = 'info' | 'success' | 'error';
export type ToastInput = {
  message: string;
  kind?: ToastKind;
  /** Milliseconds before it disappears by itself (default 4500; errors stay 7000). 0 keeps it until dismissed. */
  duration?: number;
};

type Toast = Required<Pick<ToastInput, 'message' | 'kind'>> & { id: number; duration: number };
type Api = { show: (toast: ToastInput) => void };

const MAX_VISIBLE = 3;
const ToastContext = createContext<Api | null>(null);

/** `const toast = useToast(); toast.show({ message: t('saved'), kind: 'success' })` */
export function useToast(): Api {
  // Outside a provider (tests, isolated components) a toast is simply dropped.
  return useContext(ToastContext) ?? { show: () => undefined };
}

const ICONS = { info: InfoIcon, success: CheckIcon, error: AlertIcon } as const;

// Small, restrained notifications. The container is a polite live region that is always in the page,
// so screen readers announce each new message; errors use role="alert". Hovering or focusing a toast
// pauses its timer; every toast has a 44px close button; motion is off for reduced-motion visitors.
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('ux.toast');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), []);
  const show = useCallback(({ message, kind = 'info', duration }: ToastInput) => {
    const id = nextId.current++;
    const toast: Toast = { id, message, kind, duration: duration ?? (kind === 'error' ? 7000 : 4500) };
    setToasts((list) => [...list.filter((x) => x.message !== message), toast].slice(-MAX_VISIBLE));
  }, []);

  const api = useMemo<Api>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="region" aria-label={t('region')} data-print="hide">
        <div className={styles.list} aria-live="polite" aria-relevant="additions">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} closeLabel={t('dismiss')} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss, closeLabel }: { toast: Toast; onDismiss: (id: number) => void; closeLabel: string }) {
  const { id, kind, message, duration } = toast;
  const [paused, setPaused] = useState(false);
  const Icon = ICONS[kind];

  useEffect(() => {
    if (!duration || paused) return undefined;
    const timer = window.setTimeout(() => onDismiss(id), duration);
    return () => window.clearTimeout(timer);
  }, [id, duration, paused, onDismiss]);

  return (
    <div
      className={`${styles.toast} ${styles[kind]}`}
      role={kind === 'error' ? 'alert' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon className={styles.icon} />
      <p className={styles.message}>{message}</p>
      <button type="button" className={styles.close} aria-label={closeLabel} onClick={() => onDismiss(id)}>
        <CloseIcon size={18} />
      </button>
    </div>
  );
}
