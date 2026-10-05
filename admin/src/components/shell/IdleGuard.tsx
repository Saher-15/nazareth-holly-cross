'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/client';
import { formatCountdown } from '@/lib/format';

// Signs the admin out after 30 minutes without activity, with a warning dialog for the last two minutes.
// It also leaves when the 60-minute API token ends, so nobody keeps a page open on a dead session.

export const IDLE_MS = 30 * 60_000;
export const WARN_BEFORE_MS = 2 * 60_000;

export async function signOut(reason: 'idle' | 'expired' | 'manual' = 'manual') {
  try {
    await fetch('/api/session/logout', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } });
  } catch {
    // Offline: the cookie is cleared by /api/session/expire on the next request anyway.
  }
  window.location.assign(reason === 'manual' ? '/login' : `/login?reason=${reason}`);
}

export function IdleGuard({ expiresAt }: { expiresAt: number | null }) {
  const { t } = useI18n();
  const lastActivity = useRef(0); // set to "now" when the timer starts (an effect, not during render)
  const warningOpen = useRef(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    lastActivity.current = Date.now();
    const touch = () => {
      if (!warningOpen.current) lastActivity.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, touch, { passive: true }));

    const tick = window.setInterval(() => {
      const now = Date.now();
      if (expiresAt && now >= expiresAt) {
        void signOut('expired');
        return;
      }
      const idle = now - lastActivity.current;
      if (idle >= IDLE_MS) {
        void signOut('idle');
        return;
      }
      if (idle >= IDLE_MS - WARN_BEFORE_MS) {
        warningOpen.current = true;
        setRemaining(Math.ceil((IDLE_MS - idle) / 1000));
      }
    }, 1000);

    return () => {
      events.forEach((name) => window.removeEventListener(name, touch));
      window.clearInterval(tick);
    };
  }, [expiresAt]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (remaining !== null && !dialog.open) dialog.showModal();
    if (remaining === null && dialog.open) dialog.close();
  }, [remaining]);

  const stay = useCallback(() => {
    lastActivity.current = Date.now();
    warningOpen.current = false;
    setRemaining(null);
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      role="alertdialog"
      aria-labelledby="idle-title"
      aria-describedby="idle-text"
      data-testid="idle-warning"
      onCancel={(event) => {
        event.preventDefault();
        stay();
      }}
    >
      <div className="dialog__body">
        <h2 id="idle-title" className="dialog__title">{t('idle.title')}</h2>
        <p id="idle-text" className="dialog__text">{t('idle.text', { time: formatCountdown(remaining ?? 0) })}</p>
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={() => void signOut('manual')}>{t('shell.signOut')}</button>
          <button type="button" className="btn btn--gold" onClick={stay} autoFocus>{t('idle.stay')}</button>
        </div>
      </div>
    </dialog>
  );
}
