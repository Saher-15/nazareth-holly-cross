'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import { isApiError } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';

const MAX_NOTE = 1000;

// "Mark resolved": an admin has dealt with a payment that has no order or candle request (refunded it, entered the
// order by hand, ...) and writes down what was done. The note is required and kept with the payment.
export function ResolvePayment({ id }: { id: string }) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openDialog() {
    setNote('');
    setError(null);
    dialog.current?.showModal();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const text = note.trim();
    if (!text) return setError(t('payments.errNote'));
    setBusy(true);
    setError(null);
    try {
      await proxyCall({ method: 'PATCH', path: `payments/${id}`, body: { resolved: true, note: text } });
      toast(t('payments.resolvedToast'), 'success');
      dialog.current?.close();
      router.refresh();
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      setError(isApiError(e) && e.status < 500 && e.status !== 429 ? e.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn--gold btn--sm" onClick={openDialog} data-testid="resolve-payment">
        <Icon name="check" size={16} />
        <span>{t('payments.resolve')}</span>
      </button>
      <dialog ref={dialog} className="dialog dialog--form" aria-labelledby={`${uid}-title`} onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
        <form className="dialog__body form" onSubmit={submit} noValidate>
          <h2 id={`${uid}-title`} className="dialog__title">{t('payments.resolveTitle')}</h2>
          <p className="dialog__text">{t('payments.resolveText')}</p>
          <div className="field">
            <label htmlFor={`${uid}-note`}>{t('payments.note')}</label>
            <textarea id={`${uid}-note`} className="input textarea" rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_NOTE} required aria-invalid={error ? true : undefined} aria-describedby={`${uid}-err`} />
          </div>
          <div className="form__error" role="alert" aria-live="assertive" id={`${uid}-err`}>
            {error ? (
              <>
                <Icon name="alert" size={18} />
                <span>{error}</span>
              </>
            ) : null}
          </div>
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={() => dialog.current?.close()}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--gold" disabled={busy} aria-busy={busy || undefined} data-testid="resolve-submit">
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              <span>{t('payments.resolve')}</span>
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
