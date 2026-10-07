'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent } from 'react';
import { closeOnBackdrop } from '@/components/ui/closeOnBackdrop';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import { isApiError } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';
import { isUsername, passwordProblem } from '@/lib/password';
import { ROLES, type Role } from '@/lib/roles';

/** One mailbox, as the API accepts it (server/utils/validate.js isEmail, simplified: the API has the last word). */
export const looksLikeEmail = (value: string) => value.length <= 254 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/.test(value);

export function CreateUser() {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const typed = Boolean(username || password || email);

  function openDialog() {
    setUsername('');
    setPassword('');
    setEmail('');
    setRole('editor');
    setError(null);
    setShow(false);
    dialog.current?.showModal();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const clean = username.trim().toLowerCase();
    if (!isUsername(clean)) return setError(t('users.errUsername'));
    const address = email.trim().toLowerCase();
    if (address && !looksLikeEmail(address)) return setError(t('users.errEmail'));
    const problem = passwordProblem(password, clean);
    if (problem) return setError(t(`password.${problem}` as 'password.short'));
    setBusy(true);
    setError(null);
    try {
      await proxyCall({ method: 'POST', path: 'users', body: { username: clean, password, role, ...(address ? { email: address } : {}) } });
      toast(t('users.createdToast', { name: clean }), 'success');
      dialog.current?.close();
      router.refresh();
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      setError(isApiError(e) && e.status === 409 && /mail/i.test(e.message) ? t('users.errEmailTaken') : isApiError(e) && e.status < 500 && e.status !== 429 ? e.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn--gold" onClick={openDialog} data-testid="add-user">
        <Icon name="plus" size={18} />
        <span>{t('users.add')}</span>
      </button>
      <dialog ref={dialog} className="dialog dialog--form" aria-labelledby={`${uid}-title`} onClick={closeOnBackdrop(typed)}>
        <form className="dialog__body form" onSubmit={submit} noValidate>
          <h2 id={`${uid}-title`} className="dialog__title">{t('users.add')}</h2>
          <div className="field">
            <label htmlFor={`${uid}-u`}>{t('users.username')}</label>
            <input id={`${uid}-u`} className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={40} required aria-describedby={`${uid}-uh`} dir="ltr" />
            <p id={`${uid}-uh`} className="hint">{t('users.usernameHint')}</p>
          </div>
          <div className="field">
            <label htmlFor={`${uid}-e`}>{t('users.emailOptional')}</label>
            <input id={`${uid}-e`} className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={254} aria-describedby={`${uid}-eh`} dir="ltr" />
            <p id={`${uid}-eh`} className="hint">{t('users.emailHint')}</p>
          </div>
          <div className="field">
            <label htmlFor={`${uid}-p`}>{t('users.password')}</label>
            <div className="input-group">
              <input id={`${uid}-p`} className="input" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={200} required aria-describedby={`${uid}-ph`} dir="ltr" />
              <button type="button" className="icon-btn input-group__btn" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? t('login.hidePassword') : t('login.showPassword')}>
                <Icon name={show ? 'eyeOff' : 'eye'} />
              </button>
            </div>
            <p id={`${uid}-ph`} className="hint">{t('password.policy')}</p>
          </div>
          <div className="field">
            <label htmlFor={`${uid}-r`}>{t('users.role')}</label>
            <select id={`${uid}-r`} className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{t(`role.${r}`)} - {t(`role.${r}Desc`)}</option>
              ))}
            </select>
          </div>
          <div className="form__error" role="alert" aria-live="assertive">
            {error ? (
              <>
                <Icon name="alert" size={18} />
                <span>{error}</span>
              </>
            ) : null}
          </div>
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={() => dialog.current?.close()}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--gold" disabled={busy} aria-busy={busy || undefined}>
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              <span>{t('users.create')}</span>
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** Set, change or remove an account's e-mail address: where "Forgot your password?" sends the link (docs/ADMIN.md 5.1). */
export function UserEmail({ id, username, email }: { id: string; username: string; email: string }) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [value, setValue] = useState(email);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openDialog() {
    setValue(email);
    setError(null);
    dialog.current?.showModal();
  }

  async function save(next: string) {
    if (busy) return;
    const address = next.trim().toLowerCase();
    if (address && !looksLikeEmail(address)) return setError(t('users.errEmail'));
    setBusy(true);
    setError(null);
    try {
      await proxyCall({ method: 'PATCH', path: `users/${id}`, body: { email: address } });
      toast(address ? t('users.emailSavedToast', { name: username }) : t('users.emailRemovedToast', { name: username }), 'success');
      dialog.current?.close();
      router.refresh();
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      setError(isApiError(e) && e.status === 409 ? t('users.errEmailTaken') : isApiError(e) && e.status < 500 && e.status !== 429 ? e.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn--ghost btn--sm" onClick={openDialog} aria-label={t('users.emailFor', { name: username })} data-testid="user-email">
        <Icon name="mail" size={16} />
        <span>{email ? t('users.emailChange') : t('users.emailAdd')}</span>
      </button>
      <dialog ref={dialog} className="dialog dialog--form" aria-labelledby={`${uid}-title`} onClick={closeOnBackdrop(value.trim() !== email)}>
        <form className="dialog__body form" onSubmit={(e) => { e.preventDefault(); void save(value); }} noValidate>
          <h2 id={`${uid}-title`} className="dialog__title">{t('users.emailTitle', { name: username })}</h2>
          <div className="field">
            <label htmlFor={`${uid}-e`}>{t('common.email')}</label>
            <input id={`${uid}-e`} className="input" type="email" inputMode="email" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={254} aria-describedby={`${uid}-eh`} dir="ltr" />
            <p id={`${uid}-eh`} className="hint">{t('users.emailHint')}</p>
          </div>
          <div className="form__error" role="alert" aria-live="assertive">
            {error ? (
              <>
                <Icon name="alert" size={18} />
                <span>{error}</span>
              </>
            ) : null}
          </div>
          <div className="dialog__actions">
            {email ? (
              <button type="button" className="btn btn--ghost-danger" onClick={() => void save('')} disabled={busy}>{t('users.emailRemove')}</button>
            ) : null}
            <button type="button" className="btn btn--ghost" onClick={() => dialog.current?.close()}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--gold" disabled={busy} aria-busy={busy || undefined}>
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              <span>{t('common.save')}</span>
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function RoleSelect({ id, username, role, disabled }: { id: string; username: string; role: Role; disabled?: boolean }) {
  const { t } = useI18n();
  const { toast, confirm } = useFeedback();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // The select shows the role the server sent; it changes after router.refresh() brings the new value.
  async function change(next: Role) {
    if (next === role) return;
    const demote = role === 'owner' && next !== 'owner';
    if (!(await confirm({ title: t('users.confirmRoleTitle'), message: t('users.confirmRoleText', { name: username, role: t(`role.${next}`) }), confirmLabel: t('common.confirm'), tone: demote ? 'danger' : 'primary' }))) return;
    setBusy(true);
    try {
      await proxyCall({ method: 'PATCH', path: `users/${id}`, body: { role: next } });
      toast(t('users.roleToast', { name: username, role: t(`role.${next}`) }), 'success');
      router.refresh();
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      toast(isApiError(e) && e.status < 500 && e.status !== 429 ? e.message : t('error.generic'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label className="visually-hidden" htmlFor={`role-${id}`}>{t('users.roleFor', { name: username })}</label>
      <select id={`role-${id}`} className="select select--compact" value={role} disabled={disabled || busy} onChange={(e) => void change(e.target.value as Role)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>{t(`role.${r}`)}</option>
        ))}
      </select>
    </>
  );
}
