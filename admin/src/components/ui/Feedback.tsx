'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@/i18n/client';
import { Icon } from './Icon';

// Toasts (status messages) and confirm dialogs (destructive actions), available to every client component
// below <FeedbackProvider>. Both are accessible: toasts live in a polite/alert live region, the confirm dialog
// is a native <dialog> opened with showModal() (focus is trapped and Escape cancels).

type ToastTone = 'success' | 'error' | 'info';
type ToastItem = { id: number; tone: ToastTone; text: string };

type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; tone?: 'danger' | 'primary' };

type Ctx = {
  toast: (text: string, tone?: ToastTone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<Ctx | null>(null);

export function useFeedback(): Ctx {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback needs <FeedbackProvider>');
  return ctx;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((text: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-3), { id, tone, text }]);
    window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), tone === 'error' ? 9000 : 5000);
  }, []);

  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (pending && dialog && !dialog.open) dialog.showModal();
  }, [pending]);

  function settle(ok: boolean) {
    pending?.resolve(ok);
    dialogRef.current?.close();
    setPending(null);
  }

  const value = useMemo<Ctx>(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast--${item.tone}`} role={item.tone === 'error' ? 'alert' : 'status'}>
            <Icon name={item.tone === 'error' ? 'alert' : item.tone === 'info' ? 'info' : 'check'} />
            <span>{item.text}</span>
            <button type="button" className="icon-btn icon-btn--bare" aria-label={t('common.dismiss')} onClick={() => setToasts((list) => list.filter((x) => x.id !== item.id))}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onCancel={(event) => {
          event.preventDefault();
          settle(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) settle(false);
        }}
      >
        {pending ? (
          <div className="dialog__body">
            <h2 id="confirm-title" className="dialog__title">{pending.title}</h2>
            <p id="confirm-message" className="dialog__text">{pending.message}</p>
            <div className="dialog__actions">
              <button type="button" className="btn btn--ghost" onClick={() => settle(false)} autoFocus>
                {t('common.cancel')}
              </button>
              <button type="button" className={`btn ${pending.tone === 'primary' ? 'btn--gold' : 'btn--danger'}`} onClick={() => settle(true)}>
                {pending.confirmLabel ?? t('common.confirm')}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </FeedbackContext.Provider>
  );
}
