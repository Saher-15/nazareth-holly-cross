'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { QrCode } from '@/components/ui/QrCode';
import { useI18n } from '@/i18n/client';
import { isApiError, totpSetupSchema, type TotpSetup } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';
import { passwordProblem } from '@/lib/password';

function PasswordInput({ id, label, value, onChange, autoComplete, describedBy }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; describedBy?: string }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-group">
        <input id={id} className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} maxLength={200} required aria-describedby={describedBy} dir="ltr" />
        <button type="button" className="icon-btn input-group__btn" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? t('login.hidePassword') : t('login.showPassword')}>
          <Icon name={show ? 'eyeOff' : 'eye'} />
        </button>
      </div>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  return (
    <div className="form__error" role="alert" aria-live="assertive">
      {message ? (
        <>
          <Icon name="alert" size={18} />
          <span>{message}</span>
        </>
      ) : null}
    </div>
  );
}

/** The API's own wording is English; the cases a person can fix get a translated text, keyed by the status. */
function errorText(error: unknown, generic: string, byStatus: Record<number, string> = {}): string {
  if (!isApiError(error)) return generic;
  if (byStatus[error.status]) return byStatus[error.status];
  return error.status < 500 && error.status !== 429 ? error.message : generic;
}

export function ChangePasswordForm({ username }: { username: string }) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const uid = useId();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const problem = passwordProblem(next, username);
    if (problem) return setError(t(`password.${problem}`));
    if (next !== confirm) return setError(t('password.mismatch'));
    if (next === current) return setError(t('password.same'));
    setBusy(true);
    setError(null);
    try {
      await proxyCall({ method: 'POST', path: 'auth/password', body: { currentPassword: current, newPassword: next } });
      setCurrent('');
      setNext('');
      setConfirm('');
      toast(t('settings.passwordChanged'), 'success');
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      setError(errorText(e, t('error.generic'), { 403: t('settings.wrongCurrent') }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form form--narrow" onSubmit={submit} noValidate>
      {/* Lets password managers file the new password under this account. */}
      <input type="text" name="username" value={username} autoComplete="username" readOnly hidden aria-hidden="true" tabIndex={-1} />
      <PasswordInput id={`${uid}-c`} label={t('settings.currentPassword')} value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordInput id={`${uid}-n`} label={t('settings.newPassword')} value={next} onChange={setNext} autoComplete="new-password" describedBy={`${uid}-hint`} />
      <p id={`${uid}-hint`} className="hint">{t('password.policy')}</p>
      <PasswordInput id={`${uid}-m`} label={t('settings.confirmPassword')} value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <FormError message={error} />
      <button type="submit" className="btn btn--gold" disabled={busy || !current || !next || !confirm} aria-busy={busy || undefined}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="lock" size={18} />}
        <span>{t('settings.changePassword')}</span>
      </button>
    </form>
  );
}

function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

export function TotpPanel({ enabled, username }: { enabled: boolean; username: string }) {
  const { t } = useI18n();
  const { toast, confirm } = useFeedback();
  const router = useRouter();
  const uid = useId();
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Setting up asks for the current password again (the API refuses without it): a session left open on a shared
  // computer must not be enough to tie the account to a stranger's authenticator app.
  async function start(event: FormEvent) {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      setSetup(await proxyCall({ method: 'POST', path: 'auth/totp/setup', body: { currentPassword: password }, schema: totpSetupSchema }));
      setPassword('');
      setCode('');
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      setError(errorText(e, t('error.generic'), { 403: t('settings.wrongCurrent') }));
    } finally {
      setBusy(false);
    }
  }

  async function enable(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) return setError(t('totp.codeFormat'));
    setBusy(true);
    setError(null);
    try {
      await proxyCall({ method: 'POST', path: 'auth/totp/enable', body: { code } });
      setSetup(null);
      setCode('');
      toast(t('totp.enabledToast'), 'success');
      router.refresh();
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      setError(errorText(e, t('error.generic'), { 400: t('totp.wrongCode') }));
    } finally {
      setBusy(false);
    }
  }

  async function disable(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) return setError(t('totp.codeFormat'));
    if (!(await confirm({ title: t('totp.confirmDisableTitle'), message: t('totp.confirmDisableText'), confirmLabel: t('totp.disable') }))) return;
    setBusy(true);
    setError(null);
    try {
      await proxyCall({ method: 'POST', path: 'auth/totp/disable', body: { password, code } });
      setPassword('');
      setCode('');
      toast(t('totp.disabledToast'), 'success');
      router.refresh();
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      setError(errorText(e, t('error.generic'), { 403: t('totp.wrongCodeOrPassword') }));
    } finally {
      setBusy(false);
    }
  }

  if (enabled) {
    return (
      <div className="stack">
        <p className="status-line"><Icon name="check" size={18} /> <span>{t('totp.isOn')}</span></p>
        <form className="form form--narrow" onSubmit={disable} noValidate>
          <p className="hint">{t('totp.disableHint')}</p>
          <PasswordInput id={`${uid}-p`} label={t('settings.currentPassword')} value={password} onChange={setPassword} autoComplete="current-password" />
          <div className="field">
            <label htmlFor={`${uid}-c`}>{t('totp.code')}</label>
            <input id={`${uid}-c`} className="input input--code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
          </div>
          <FormError message={error} />
          <button type="submit" className="btn btn--ghost-danger" disabled={busy || !password || code.length !== 6} aria-busy={busy || undefined}>
            <span>{t('totp.disable')}</span>
          </button>
        </form>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="stack">
        <p className="status-line status-line--off"><Icon name="alert" size={18} /> <span>{t('totp.isOff')}</span></p>
        <p className="hint">{t('totp.intro')}</p>
        <form className="form form--narrow" onSubmit={start} noValidate>
          <p id={`${uid}-sh`} className="hint">{t('totp.setupHint')}</p>
          <PasswordInput id={`${uid}-sp`} label={t('settings.currentPassword')} value={password} onChange={setPassword} autoComplete="current-password" describedBy={`${uid}-sh`} />
          <FormError message={error} />
          <div>
            <button type="submit" className="btn btn--gold" disabled={busy || !password} aria-busy={busy || undefined} data-testid="totp-start">
              {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="lock" size={18} />}
              <span>{t('totp.setup')}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <form className="totp-setup" onSubmit={enable} noValidate>
      <div className="totp-setup__qr">
        <QrCode value={setup.otpauthUrl} label={t('totp.qrLabel')} />
      </div>
      <div className="totp-setup__steps">
        <ol className="steps">
          <li>{t('totp.step1')}</li>
          <li>{t('totp.step2')}</li>
          <li>{t('totp.step3')}</li>
        </ol>
        <p className="hint">{t('totp.manual')}</p>
        <p className="secret" dir="ltr"><code data-testid="totp-secret">{groupSecret(setup.secret)}</code></p>
        <p className="hint"><a className="link" href={setup.otpauthUrl}>{t('totp.openApp')}</a></p>
        <div className="field">
          <label htmlFor={`${uid}-e`}>{t('totp.code')}</label>
          <input id={`${uid}-e`} className="input input--code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
        </div>
        <FormError message={error} />
        <div className="row-actions">
          <button type="submit" className="btn btn--gold" disabled={busy || code.length !== 6} aria-busy={busy || undefined}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" size={18} />}
            <span>{t('totp.enable')}</span>
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => { setSetup(null); setError(null); }}>{t('common.cancel')}</button>
        </div>
        <p className="visually-hidden">{username}</p>
      </div>
    </form>
  );
}
