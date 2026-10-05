'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';

type Step = 'credentials' | 'totp';

// Sign-in. The form posts to this app's own /api/session/login, never to the API: the token never reaches the
// browser. 401 is one message for every cause (no hint whether the user exists, the password was wrong or the
// account is locked). 428 means the account has two-factor sign-in: the code step appears.

export function LoginForm({ reason, next }: { reason?: 'expired' | 'idle'; next: string }) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const userRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'totp') codeRef.current?.focus();
  }, [step]);

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    setCaps(event.getModifierState?.('CapsLock') ?? false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/session/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, ...(step === 'totp' ? { totp: code.trim() } : {}) }),
      });
      if (res.ok) {
        // A full navigation: the server renders the first page with the new cookie.
        window.location.assign(next);
        return;
      }
      if (res.status === 428) {
        setStep('totp');
        setCode('');
        return;
      }
      if (res.status === 429) {
        const body = (await res.json().catch(() => ({}))) as { retryAfter?: number };
        const minutes = Math.max(1, Math.ceil((body.retryAfter ?? 900) / 60));
        setError(t('login.rateLimited', { minutes }));
      } else if (res.status === 401) {
        setError(step === 'totp' ? t('login.invalidCode') : t('login.invalid'));
        if (step === 'totp') {
          // Keep the password: the next try only needs a new code.
          setCode('');
          codeRef.current?.focus();
        } else {
          setPassword('');
          passwordRef.current?.focus();
        }
      } else if (res.status === 403) {
        setError(t('login.blocked'));
      } else {
        setError(t('login.unavailable'));
      }
    } catch {
      setError(t('login.unavailable'));
    } finally {
      setBusy(false);
    }
  }

  const banner = reason === 'idle' ? t('login.reasonIdle') : reason === 'expired' ? t('login.reasonExpired') : null;

  return (
    <form className="form login__form" onSubmit={submit} noValidate>
      {banner ? (
        <p className="alert alert--info" role="status">
          <Icon name="info" size={18} />
          <span>{banner}</span>
        </p>
      ) : null}

      {step === 'credentials' ? (
        <>
          <div className="field">
            <label htmlFor="username">{t('login.username')}</label>
            <input
              ref={userRef}
              id="username"
              name="username"
              className="input"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              maxLength={100}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t('login.password')}</label>
            <div className="input-group">
              <input
                ref={passwordRef}
                id="password"
                name="password"
                className="input"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKey}
                onKeyUp={onKey}
                aria-invalid={error ? true : undefined}
                aria-describedby={[error ? 'login-error' : '', caps ? 'caps-hint' : ''].filter(Boolean).join(' ') || undefined}
              />
              <button type="button" className="icon-btn input-group__btn" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? t('login.hidePassword') : t('login.showPassword')}>
                <Icon name={show ? 'eyeOff' : 'eye'} />
              </button>
            </div>
            {caps ? (
              <p id="caps-hint" className="hint hint--warn" role="status">
                <Icon name="alert" size={16} /> {t('login.capsLock')}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div className="field">
          <label htmlFor="totp">{t('login.code')}</label>
          <input
            ref={codeRef}
            id="totp"
            name="totp"
            className="input input--code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error totp-hint' : 'totp-hint'}
          />
          <p id="totp-hint" className="hint">{t('login.codeHint', { user: username })}</p>
        </div>
      )}

      <div id="login-error" className="form__error" role="alert" aria-live="assertive">
        {error ? (
          <>
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </>
        ) : null}
      </div>

      <button type="submit" className="btn btn--gold btn--block" disabled={busy || !username || !password || (step === 'totp' && code.length !== 6)} aria-busy={busy || undefined}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="lock" size={18} />}
        <span>{busy ? t('login.signingIn') : step === 'totp' ? t('login.verify') : t('login.submit')}</span>
      </button>
      {step === 'totp' ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => {
            setStep('credentials');
            setError(null);
            setCode('');
            setTimeout(() => passwordRef.current?.focus(), 0);
          }}
        >
          {t('common.back')}
        </button>
      ) : null}
    </form>
  );
}
