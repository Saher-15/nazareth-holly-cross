'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';

// Forgotten password, step 1. Posts to this app's /api/session/forgot. The answer is the same whether or not the
// address has an account, so the page always shows the same neutral confirmation (never "no such address").

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const address = email.trim();
    if (address.length > 254 || !EMAIL.test(address)) {
      setError(t('forgot.invalidEmail'));
      emailRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/session/forgot', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: address }),
      });
      if (res.status === 202) {
        setSent(true);
        return;
      }
      if (res.status === 429) {
        const body = (await res.json().catch(() => ({}))) as { retryAfter?: number };
        const minutes = Math.max(1, Math.ceil((body.retryAfter ?? 900) / 60));
        setError(t('forgot.rateLimited', { minutes }));
      } else if (res.status === 400) {
        setError(t('forgot.invalidEmail'));
      } else if (res.status === 403) {
        setError(t('login.blocked'));
      } else {
        setError(t('forgot.unavailable'));
      }
    } catch {
      setError(t('forgot.unavailable'));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="form login__form">
        <div ref={doneRef} className="alert alert--info" role="status" tabIndex={-1}>
          <Icon name="mail" size={18} />
          <span>{t('forgot.sent')}</span>
        </div>
        <p className="hint">{t('forgot.sentHint')}</p>
        <Link href="/login" className="btn btn--gold btn--block">
          <Icon name="lock" size={18} />
          <span>{t('forgot.backToSignIn')}</span>
        </Link>
      </div>
    );
  }

  return (
    <form className="form login__form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="email">{t('forgot.email')}</label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'forgot-hint forgot-error' : 'forgot-hint'}
          autoFocus
        />
        <p id="forgot-hint" className="hint">{t('forgot.hint')}</p>
      </div>

      <div id="forgot-error" className="form__error" role="alert" aria-live="assertive">
        {error ? (
          <>
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </>
        ) : null}
      </div>

      <button type="submit" className="btn btn--gold btn--block" disabled={busy || !email.trim()} aria-busy={busy || undefined}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="mail" size={18} />}
        <span>{busy ? t('forgot.sending') : t('forgot.submit')}</span>
      </button>
      <Link href="/login" className="btn btn--ghost btn--block">{t('forgot.backToSignIn')}</Link>
    </form>
  );
}
