'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import { isApiError, privacyEraseSchema, privacyLookupSchema, type PrivacyCounts } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KINDS = ['orders', 'candles', 'contacts', 'reviews', 'payments'] as const;
const total = (counts: PrivacyCounts) => KINDS.reduce((sum, kind) => sum + counts[kind], 0);

// Look up what is stored about an e-mail address, then (after typing the address again) erase it. The numbers are
// counts only: no personal data is shown, and the address never goes into the audit log.
export function PrivacyTool() {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const uid = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<{ email: string; counts: PrivacyCounts } | null>(null);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const message = (e: unknown) => (isApiError(e) && e.status < 500 && e.status !== 429 ? e.message : t('error.generic'));

  async function find(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address)) return setError(t('privacy.errInvalid'));
    setBusy(true);
    setError(null);
    setFound(null);
    try {
      const result = await proxyCall({ method: 'POST', path: 'privacy/lookup', body: { email: address }, schema: privacyLookupSchema });
      setFound({ email: address, counts: result.found });
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  function openDialog() {
    setConfirm('');
    setDialogError(null);
    dialog.current?.showModal();
  }

  async function erase(event: FormEvent) {
    event.preventDefault();
    if (busy || !found) return;
    if (confirm.trim().toLowerCase() !== found.email) return setDialogError(t('privacy.errMismatch'));
    setBusy(true);
    setDialogError(null);
    try {
      const result = await proxyCall({ method: 'POST', path: 'privacy/erase', body: { email: found.email, confirm: confirm.trim() }, schema: privacyEraseSchema });
      const c = result.erased;
      toast(t('privacy.erasedToast', { orders: c.orders, candles: c.candles, contacts: c.contacts, reviews: c.reviews, payments: c.payments }), 'success');
      dialog.current?.close();
      setFound(null);
      setEmail('');
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      setDialogError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{t('privacy.findTitle')}</h2>
      </div>
      <form className="form" onSubmit={find} noValidate>
        <div className="field">
          <label htmlFor={`${uid}-email`}>{t('privacy.emailLabel')}</label>
          <input id={`${uid}-email`} className="input" type="email" dir="ltr" value={email} onChange={(e) => { setEmail(e.target.value); setFound(null); }} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={254} required aria-describedby={`${uid}-hint ${uid}-err`} aria-invalid={error ? true : undefined} data-testid="privacy-email" />
          <p id={`${uid}-hint`} className="hint">{t('privacy.emailHint')}</p>
        </div>
        <div className="form__error" role="alert" aria-live="assertive" id={`${uid}-err`}>
          {error ? (
            <>
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </>
          ) : null}
        </div>
        <div>
          <button type="submit" className="btn btn--gold" disabled={busy} aria-busy={busy || undefined} data-testid="privacy-find">
            {busy && !found ? <span className="spinner" aria-hidden="true" /> : <Icon name="search" size={16} />}
            <span>{t('privacy.find')}</span>
          </button>
        </div>
      </form>

      {found ? (
        <div className="stack" role="status" data-testid="privacy-result">
          {total(found.counts) === 0 ? (
            <p className="hint">{t('privacy.none')}</p>
          ) : (
            <>
              <h3 className="drawer__subtitle">{t('privacy.storedTitle')}</h3>
              <dl className="counts">
                {KINDS.map((kind) => (
                  <div key={kind}>
                    <dt>{t(`privacy.kind.${kind}`)}</dt>
                    <dd data-testid={`privacy-count-${kind}`}>{found.counts[kind]}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <button type="button" className="btn btn--ghost-danger" onClick={openDialog} data-testid="privacy-erase">
                  <Icon name="trash" size={16} />
                  <span>{t('privacy.erase')}</span>
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <dialog ref={dialog} className="dialog dialog--form" aria-labelledby={`${uid}-title`} onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
        <form className="dialog__body form" onSubmit={erase} noValidate>
          <h2 id={`${uid}-title`} className="dialog__title">{t('privacy.confirmTitle')}</h2>
          <p className="dialog__text">{t('privacy.confirmText')}</p>
          <div className="field">
            <label htmlFor={`${uid}-confirm`}>{t('privacy.confirmLabel')}</label>
            <input id={`${uid}-confirm`} className="input" type="email" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={254} required data-testid="privacy-confirm" />
          </div>
          <div className="form__error" role="alert" aria-live="assertive">
            {dialogError ? (
              <>
                <Icon name="alert" size={18} />
                <span>{dialogError}</span>
              </>
            ) : null}
          </div>
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={() => dialog.current?.close()}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--danger" disabled={busy} aria-busy={busy || undefined} data-testid="privacy-confirm-submit">
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              <span>{t('privacy.erase')}</span>
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
