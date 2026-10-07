'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { isLiveAlertExcluded, LIVE_ALERT_DELAY_MS, liveAlertKey, markSeen, readSeen, shouldOpenLiveAlert } from '@/lib/liveAlert';
import { HEADER_POLL_MS } from '@/lib/liveStatusStore';
import { useLiveSnapshot, type LiveSeed } from '@/lib/useLiveStatus';
import styles from './LiveAlert.module.css';

/** While the visitor is busy (another dialog or the menu open, typing in a field) the window waits this long. */
const BUSY_RETRY_MS = 2_000;

/** Another dialog or the drawer is open, or the focus is in a field: opening a modal now would interrupt. */
function pageIsBusy(own: HTMLDialogElement | null): boolean {
  const otherDialog = [...document.querySelectorAll('dialog[open], [role="dialog"]')].some((el) => el !== own);
  const active = document.activeElement;
  const typing = active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
  return otherDialog || document.documentElement.dataset.menuOpen === 'true' || typing;
}

// "We are live now": the one pop-up the owner approved (docs/DESIGN-GUIDE.md 1.5 and 5.4). While a broadcast is live,
// a visitor on any page but /live and the payment pages sees, after 4 seconds on the page, a small centred modal
// window with the broadcast's title, "Watch now" (to /live, focused) and "Not now". Once per broadcast per browser
// (lib/liveAlert.ts). A native <dialog> opened with showModal(): the page behind is inert, Tab stays inside, Escape
// and a click on the dimmed page close it, and the focus goes back where it was. It follows the tab's one live-status
// poller (lib/liveStatusStore.ts), so it can open on a page that was already open when the broadcast began.
export default function LiveAlert({ seed }: { seed?: LiveSeed }) {
  const t = useTranslations('ux.liveAlert');
  const pathname = usePathname();
  const { status, checkedAt } = useLiveSnapshot(HEADER_POLL_MS, seed);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const openedOn = useRef<string | null>(null);
  // The page that has been on screen for 4 seconds (the window never flashes in while a page loads).
  const [settledPath, setSettledPath] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSettledPath(pathname), LIVE_ALERT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  const settled = settledPath === pathname;

  // Open it when every rule allows (and the visitor is not in the middle of something).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open || !settled || !status.live) return;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => {
      const check = { status, checkedAt, now: Date.now(), pathname, onPageMs: LIVE_ALERT_DELAY_MS, seen: readSeen() };
      if (!shouldOpenLiveAlert(check) || dialog.open) return;
      if (pageIsBusy(dialog)) {
        retry = setTimeout(attempt, BUSY_RETRY_MS);
        return;
      }
      markSeen(liveAlertKey(status)); // remembered as soon as it is shown: a reload does not show it again
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      openedOn.current = pathname;
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    };
    attempt();
    return () => clearTimeout(retry);
  }, [settled, status, checkedAt, pathname]);

  // The broadcast ended, or the page changed under it (the browser's back button): close it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog?.open && (!status.live || openedOn.current !== pathname || isLiveAlertExcluded(pathname))) dialog.close();
  }, [status.live, pathname]);

  const onClose = () => {
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target?.isConnected && target !== document.body) target.focus({ preventScroll: true });
  };

  // A click on the dimmed page around the window (the dialog element itself; its content fills it) closes it.
  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  };

  return (
    <dialog
      ref={dialogRef}
      className={`ui-glass ${styles.dialog}`}
      aria-labelledby="live-alert-title"
      aria-describedby="live-alert-broadcast live-alert-text"
      onClose={onClose}
      onClick={onDialogClick}
      data-testid="live-alert"
    >
      {status.live ? (
        <div className={styles.body}>
          <p className={styles.badge}>
            <span className={styles.dot} aria-hidden="true" />
            {t('badge')}
          </p>
          <h2 id="live-alert-title" className={styles.title}>
            {t('title')}
          </h2>
          <p id="live-alert-broadcast" className={styles.broadcast} dir="auto">
            {status.title}
          </p>
          <p id="live-alert-text" className={styles.text}>
            {t('text')}
          </p>
          <div className={styles.actions}>
            <Link
              href="/live"
              className="ui-btn ui-btn--gold"
              data-autofocus
              onClick={() => {
                returnFocus.current = null; // the new page takes the focus (RouteFocus)
                dialogRef.current?.close();
              }}
            >
              {t('watch')}
            </Link>
            <button type="button" className="ui-btn ui-btn--ghost" onClick={() => dialogRef.current?.close()}>
              {t('later')}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
