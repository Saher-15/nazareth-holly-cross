'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '@/i18n/client';
import { Icon } from './Icon';

// A side panel built on the native <dialog> element: opens modal (focus trapped, Escape closes, the page behind is
// inert), slides in from the end edge, and closes by navigating to `closeHref` (the list without ?open=...),
// so the open record is a shareable URL and the browser Back button closes it.
//
// Focus goes back where it came from when it closes (WCAG 2.4.3; review 03 finding 2: it fell to <body>): to the link or
// button that opened it, or, when the drawer was opened from its address (a shared link, a reload), to the row's own
// link (`a[href*="open=<id>"]`), else to the page's heading.

/** Where focus returns after the drawer of record `openId` closed (exported for the tests). */
export function returnFocus(opener: HTMLElement | null, openId: string | null, doc: Document = document) {
  const target =
    (opener && opener.isConnected && opener !== doc.body ? opener : null) ??
    (openId ? doc.querySelector<HTMLElement>(`main a[href*="open=${CSS.escape(openId)}"]`) : null) ??
    doc.getElementById('page-title');
  target?.focus({ preventScroll: false });
}

export function Drawer({ title, closeHref, children, footer }: { title: string; closeHref: string; children: ReactNode; footer?: ReactNode }) {
  const router = useRouter();
  const openId = useSearchParams().get('open');
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // Before the dialog takes focus: remember who had it (the clicked link keeps focus during a client navigation).
  useLayoutEffect(() => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const from = opener.current;
    return () => {
      if (dialog?.open) dialog.close();
      // After the list re-rendered without the drawer: the opener, the row's link, or the heading.
      window.requestAnimationFrame(() => returnFocus(from, openId));
    };
  }, [openId]);

  function close() {
    router.replace(closeHref, { scroll: false });
  }

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby="drawer-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="drawer__panel">
        <header className="drawer__head">
          <h2 id="drawer-title" className="drawer__title">{title}</h2>
          <button type="button" className="icon-btn" onClick={close} aria-label={t('common.close')}>
            <Icon name="x" />
          </button>
        </header>
        <div className="drawer__body">{children}</div>
        {footer ? <footer className="drawer__foot">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
