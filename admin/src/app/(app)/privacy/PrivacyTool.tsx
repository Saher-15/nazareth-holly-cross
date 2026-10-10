'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import { isApiError, privacyEraseSchema, privacyLookupSchema, type PrivacyCounts, type PrivacyNotErased } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';
import { isApiEmail } from '@/lib/email';

const KINDS = ['orders', 'candles', 'contacts', 'reviews', 'payments', 'prayers', 'productReviews'] as const;
const total = (counts: PrivacyCounts) => KINDS.reduce((sum, kind) => sum + counts[kind], 0);

type Person = { email: string; name: string; country: string };
type Report = { counts: PrivacyCounts; notErased: PrivacyNotErased[] };

// Look up what is stored about a person, then (after typing the address again) erase it. The e-mail address finds
// orders, candle requests, messages, site reviews and payments; prayers and product reviews keep no address, so they are
// found only by the name (and, for prayers, the country) they were published under, exactly as written. The numbers are
// counts only: no personal data is shown, and neither the address nor the name goes into the audit log. After an erase,
// the report lists what could NOT be erased here (Gmail's sent copies, backups, recordings...), to be done by hand.
export function PrivacyTool() {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const uid = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [found, setFound] = useState<{ person: Person; counts: PrivacyCounts; notSearched: PrivacyNotErased[] } | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const message = (e: unknown) => (isApiError(e) && e.status < 500 && e.status !== 429 ? e.message : t('error.generic'));
  const personBody = (person: Person) => ({
    ...(person.name ? { name: person.name } : {}),
    ...(person.name && person.country ? { country: person.country } : {}),
  });

  async function find(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const person: Person = { email: email.trim().toLowerCase(), name: name.trim().replace(/\s+/g, ' '), country: country.trim().replace(/\s+/g, ' ') };
    // The API's own checks (it would refuse anything else with an English message).
    if (!isApiEmail(person.email)) return setError(t('privacy.errInvalid'));
    if (person.name && person.name.length < 2) return setError(t('privacy.errName'));
    if (person.country && !person.name) return setError(t('privacy.errCountryAlone'));
    setBusy(true);
    setError(null);
    setFound(null);
    setReport(null);
    try {
      const result = await proxyCall({ method: 'POST', path: 'privacy/lookup', body: { email: person.email, ...personBody(person) }, schema: privacyLookupSchema });
      setFound({ person, counts: result.found, notSearched: result.notSearched });
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
    if (confirm.trim().toLowerCase() !== found.person.email) return setDialogError(t('privacy.errMismatch'));
    setBusy(true);
    setDialogError(null);
    try {
      const result = await proxyCall({
        method: 'POST',
        path: 'privacy/erase',
        body: { email: found.person.email, confirm: confirm.trim(), ...personBody(found.person) },
        schema: privacyEraseSchema,
      });
      const c = result.erased;
      toast(t('privacy.erasedToast', { orders: c.orders, candles: c.candles, contacts: c.contacts, reviews: c.reviews, payments: c.payments, prayers: c.prayers, productReviews: c.productReviews }), 'success');
      dialog.current?.close();
      setReport({ counts: c, notErased: result.notErased });
      setFound(null);
      setEmail('');
      setName('');
      setCountry('');
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      setDialogError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const clearResults = () => {
    setFound(null);
    setReport(null);
  };

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{t('privacy.findTitle')}</h2>
      </div>
      <form className="form" onSubmit={find} noValidate>
        <div className="field">
          <label htmlFor={`${uid}-email`}>{t('privacy.emailLabel')}</label>
          <input id={`${uid}-email`} className="input" type="email" dir="ltr" value={email} onChange={(e) => { setEmail(e.target.value); clearResults(); }} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={254} required aria-describedby={`${uid}-hint ${uid}-err`} aria-invalid={error ? true : undefined} data-testid="privacy-email" />
          <p id={`${uid}-hint`} className="hint">{t('privacy.emailHint')}</p>
        </div>
        <div className="field">
          <label htmlFor={`${uid}-name`}>{t('privacy.nameLabel')}</label>
          <input id={`${uid}-name`} className="input" type="text" dir="auto" value={name} onChange={(e) => { setName(e.target.value); clearResults(); }} autoComplete="off" spellCheck={false} maxLength={200} aria-describedby={`${uid}-name-hint`} data-testid="privacy-name" />
          <p id={`${uid}-name-hint`} className="hint">{t('privacy.nameHint')}</p>
        </div>
        <div className="field">
          <label htmlFor={`${uid}-country`}>{t('privacy.countryLabel')}</label>
          <input id={`${uid}-country`} className="input" type="text" dir="auto" value={country} onChange={(e) => { setCountry(e.target.value); clearResults(); }} autoComplete="off" spellCheck={false} maxLength={100} aria-describedby={`${uid}-country-hint`} data-testid="privacy-country" />
          <p id={`${uid}-country-hint`} className="hint">{t('privacy.countryHint')}</p>
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
            </>
          )}
          {found.notSearched.length ? (
            <ul className="rules" data-testid="privacy-not-searched">
              {found.notSearched.map((code) => <li key={code}>{t(`privacy.not.${code}`)}</li>)}
            </ul>
          ) : null}
          {total(found.counts) > 0 ? (
            <div>
              <button type="button" className="btn btn--ghost-danger" onClick={openDialog} data-testid="privacy-erase">
                <Icon name="trash" size={16} />
                <span>{t('privacy.erase')}</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {report ? (
        <div className="stack" data-testid="privacy-report">
          <h3 className="drawer__subtitle">{t('privacy.reportTitle')}</h3>
          <dl className="counts">
            {KINDS.map((kind) => (
              <div key={kind}>
                <dt>{t(`privacy.kind.${kind}`)}</dt>
                <dd data-testid={`privacy-erased-${kind}`}>{report.counts[kind]}</dd>
              </div>
            ))}
          </dl>
          <h3 className="drawer__subtitle">{t('privacy.notErasedTitle')}</h3>
          <p className="hint">{t('privacy.notErasedLead')}</p>
          <ul className="rules" data-testid="privacy-not-erased">
            {report.notErased.map((code) => <li key={code} data-code={code}>{t(`privacy.not.${code}`)}</li>)}
          </ul>
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
