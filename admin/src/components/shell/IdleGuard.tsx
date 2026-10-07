'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import { formatCountdown } from '@/lib/format';
import { clearAllDrafts, markLeavingForSignIn } from '@/lib/drafts';
import { onSessionEnded, onSessionHoldChange, sessionHeld } from '@/lib/session-hold';

// Signs the admin out after 30 minutes without activity, with a warning dialog for the last two minutes.
// It also leaves when the 60-minute API token ends, so nobody keeps a page open on a dead session.
//
// Except while a live broadcast is on air or a recording is uploading (lib/session-hold.ts): leaving the page then would
// end the broadcast or stop the upload. Idle time does not count while held; if the sign-in ends while held, the page
// stays and says so (sign in again in another tab: the new cookie serves this tab too), and reloads once the hold ends.

export const IDLE_MS = 30 * 60_000;
export const WARN_BEFORE_MS = 2 * 60_000;

export type IdleState = { now: number; expiresAt: number | null; lastActivity: number; held: boolean; expiredWhileHeld: boolean };
export type IdleVerdict = 'none' | 'warn' | 'signOutIdle' | 'signOutExpired' | 'heldExpired' | 'reload';

/** What the guard does at one tick (pure, tested in tests/unit/session-hold.test.ts). */
export function idleVerdict({ now, expiresAt, lastActivity, held, expiredWhileHeld }: IdleState): IdleVerdict {
  if (expiresAt && now >= expiresAt) {
    if (held) return 'heldExpired';
    return expiredWhileHeld ? 'reload' : 'signOutExpired';
  }
  if (held) return 'none';
  const idle = now - lastActivity;
  if (idle >= IDLE_MS) return 'signOutIdle';
  if (idle >= IDLE_MS - WARN_BEFORE_MS) return 'warn';
  return 'none';
}

export async function signOut(reason: 'idle' | 'expired' | 'manual' = 'manual') {
  try {
    await fetch('/api/session/logout', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } });
  } catch {
    // Offline: the cookie is cleared by /api/session/expire on the next request anyway.
  }
  // After an idle or expired sign-out the sign-in page brings the admin back to the same page, where a form finds what
  // was typed (lib/drafts.ts); a manual sign-out forgets it (the next person on this tab must not see it).
  if (reason === 'manual') clearAllDrafts();
  else markLeavingForSignIn();
  const here = `${window.location.pathname}${window.location.search}`;
  const next = reason !== 'manual' && here !== '/' ? `&next=${encodeURIComponent(here)}` : '';
  window.location.assign(reason === 'manual' ? '/login' : `/login?reason=${reason}${next}`);
}

export function IdleGuard({ expiresAt }: { expiresAt: number | null }) {
  const { t } = useI18n();
  const lastActivity = useRef(0); // set to "now" when the timer starts (an effect, not during render)
  const warningOpen = useRef(false);
  const expiredWhileHeld = useRef(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [heldExpired, setHeldExpired] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    lastActivity.current = Date.now();
    const touch = () => {
      if (!warningOpen.current) lastActivity.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, touch, { passive: true }));

    const check = () => {
      const now = Date.now();
      const held = sessionHeld();
      if (held) {
        // Broadcasting or uploading counts as activity; a warning that was open goes away.
        lastActivity.current = now;
        if (warningOpen.current) {
          warningOpen.current = false;
          setRemaining(null);
        }
      }
      const verdict = idleVerdict({ now, expiresAt, lastActivity: lastActivity.current, held, expiredWhileHeld: expiredWhileHeld.current });
      if (verdict === 'heldExpired') {
        expiredWhileHeld.current = true;
        setHeldExpired(true);
      } else if (verdict === 'reload') {
        // Released after the sign-in ended: reload rather than sign out, in case the admin signed in again in another
        // tab (signing out would end that new session too). A dead session goes to the sign-in page by itself.
        window.location.reload();
      } else if (verdict === 'signOutExpired') {
        void signOut('expired');
      } else if (verdict === 'signOutIdle') {
        void signOut('idle');
      } else if (verdict === 'warn') {
        warningOpen.current = true;
        setRemaining(Math.ceil((IDLE_MS - (now - lastActivity.current)) / 1000));
      }
    };
    const tick = window.setInterval(check, 1000);
    const stopHold = onSessionHoldChange(() => {
      if (!sessionHeld()) lastActivity.current = Date.now(); // a fresh 30 minutes after the broadcast or the upload
      check();
    });
    // The API said 401 while held (a call from the page): the same notice, the page stays (lib/client-api.ts).
    const stopEnded = onSessionEnded(() => {
      expiredWhileHeld.current = true;
      setHeldExpired(true);
    });

    return () => {
      events.forEach((name) => window.removeEventListener(name, touch));
      window.clearInterval(tick);
      stopHold();
      stopEnded();
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
    <>
      {heldExpired ? (
        <div className="alert alert--warn session-held" role="alert" data-testid="session-held-expired">
          <Icon name="alert" size={18} />
          <p className="alert__body">
            <span>{t('idle.heldExpired')}</span>
            <a href="/login" target="_blank" rel="noopener noreferrer" className="link link--strong">
              {t('idle.signInNewTab')}
            </a>
          </p>
        </div>
      ) : null}
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
    </>
  );
}
