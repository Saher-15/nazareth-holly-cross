'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '@/i18n/client';
import { Icon } from './Icon';

// A side panel built on the native <dialog> element: opens modal (focus trapped, Escape closes, the page behind is
// inert), slides in from the end edge, and closes by navigating to `closeHref` (the list without ?open=...),
// so the open record is a shareable URL and the browser Back button closes it.

export function Drawer({ title, closeHref, children, footer }: { title: string; closeHref: string; children: ReactNode; footer?: ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

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
