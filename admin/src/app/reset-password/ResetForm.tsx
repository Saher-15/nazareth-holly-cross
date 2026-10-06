'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import { passwordProblem } from '@/lib/password';
import type { PolicyReason } from '@/lib/password-reset';

type Phase = 'form' | 'done' | 'link';

// Forgotten password, step 2: choose a new password with the one-time link from the e-mail. Posts to this app's
// /api/session/reset. The token is kept only in this component's memory: it is removed from the address bar on the
// first render (so it is not in the history, a bookmark or a screenshot of the address) and never stored.

export function ResetForm({ token: initialToken }: { token: string | null }) {
  const { t } = useI18n();
  // Read once: a later refresh of the page (the language switcher) renders it without the token in the address.
  const [token] = useState(initialToken);
  const [phase, setPhase] = useState<Phase>(initialToken ? 'form' : 'link');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (phase !== 'form') resultRef.current?.focus();
  }, [phase]);

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    setCaps(event.getModifierState?.('CapsLock') ?? false);
  }

  function fail(message: string) {
    setError(message);
    passwordRef.current?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !token) return;
    const problem = passwordProblem(password, '');
    if (problem) return fail(t(`password.${problem}`));
    if (password !== confirm) return fail(t('password.mismatch'));
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/session/reset', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (res.status === 204) {
        setPassword('');
        setConfirm('');
        setPhase('done');
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string; reason?: PolicyReason | null; message?: string; retryAfter?: number };
      if (res.status === 400 && body.error === 'link') {
        setPassword('');
        setConfirm('');
        setPhase('link');
      } else if (res.status === 400 && body.error === 'policy') {
        fail(body.reason ? t(`password.${body.reason}`) : body.message || t('password.policy'));
      } else if (res.status === 429) {
        fail(t('reset.rateLimited', { minutes: Math.max(1, Math.ceil((body.retryAfter ?? 900) / 60)) }));
      } else if (res.status === 403) {
        fail(t('login.blocked'));
      } else {
        fail(t('reset.unavailable'));
      }
    } catch {
      fail(t('reset.unavailable'));
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'done') {
    return (
      <div className="form login__form">
        <div ref={resultRef} className="alert alert--info" role="status" tabIndex={-1}>
          <Icon name="check" size={18} />
          <span>{t('reset.done')}</span>
        </div>
        <Link href="/login" className="btn btn--gold btn--block">
          <Icon name="lock" size={18} />
          <span>{t('login.submit')}</span>
        </Link>
      </div>
    );
  }

  if (phase === 'link') {
    return (
      <div className="form login__form">
        <div ref={resultRef} className="alert alert--warn" role="alert" tabIndex={-1}>
          <Icon name="alert" size={18} />
          <span>{t('reset.badLink')}</span>
        </div>
        <Link href="/forgot-password" className="btn btn--gold btn--block">
          <Icon name="mail" size={18} />
          <span>{t('reset.newLink')}</span>
        </Link>
        <Link href="/login" className="btn btn--ghost btn--block">{t('forgot.backToSignIn')}</Link>
      </div>
    );
  }

  const describedBy = (...ids: (string | false)[]) => ids.filter(Boolean).join(' ') || undefined;

  return (
    <form className="form login__form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="new-password">{t('reset.newPassword')}</label>
        <div className="input-group">
          <input
            ref={passwordRef}
            id="new-password"
            name="new-password"
            className="input"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            dir="ltr"
            required
            maxLength={200}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKey}
            onKeyUp={onKey}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy('reset-policy', !!error && 'reset-error', caps && 'caps-hint')}
            autoFocus
          />
          <button type="button" className="icon-btn input-group__btn" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? t('login.hidePassword') : t('login.showPassword')}>
            <Icon name={show ? 'eyeOff' : 'eye'} />
          </button>
        </div>
        <p id="reset-policy" className="hint">{t('password.policy')}</p>
      </div>
      <div className="field">
        <label htmlFor="confirm-password">{t('reset.confirmPassword')}</label>
        <input
          id="confirm-password"
          name="confirm-password"
          className="input"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          dir="ltr"
          required
          maxLength={200}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={onKey}
          onKeyUp={onKey}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(!!error && 'reset-error', caps && 'caps-hint')}
        />
        {caps ? (
          <p id="caps-hint" className="hint hint--warn" role="status">
            <Icon name="alert" size={16} /> {t('login.capsLock')}
          </p>
        ) : null}
      </div>

      <div id="reset-error" className="form__error" role="alert" aria-live="assertive">
        {error ? (
          <>
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </>
        ) : null}
      </div>

      <button type="submit" className="btn btn--gold btn--block" disabled={busy || !password || !confirm} aria-busy={busy || undefined}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="lock" size={18} />}
        <span>{busy ? t('reset.saving') : t('reset.submit')}</span>
      </button>
      <Link href="/login" className="btn btn--ghost btn--block">{t('forgot.backToSignIn')}</Link>
    </form>
  );
}
