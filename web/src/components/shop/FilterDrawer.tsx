'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import ShopIcon from './ShopIcon';
import styles from './FilterDrawer.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Number of products the current filters give, for the "Show N results" button. */
  total: number;
  canClear: boolean;
  onClear: () => void;
  children: ReactNode;
};

// The phone/tablet filter drawer: a native modal <dialog>, so the browser keeps focus
// inside it, closes it on Escape and gives focus back to the "Filters" button.
// Filters apply as they are changed (the grid updates behind the drawer); the main
// button closes the drawer and says how many products are now shown.
export default function FilterDrawer({ open, onClose, total, canClear, onClear, children }: Props) {
  const t = useTranslations('shopFeatures.filters');
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => ref.current?.close();

  return (
    // A click on the dimmed area beside the panel (the dialog itself) closes it.
    <dialog
      ref={ref}
      className={styles.drawer}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && close()}
      data-testid="filter-drawer"
    >
      <div className={styles.panel}>
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            <ShopIcon name="filter" className={styles.titleIcon} />
            {t('title')}
          </h2>
          <button type="button" className={styles.close} onClick={close} aria-label={t('close')}>
            <ShopIcon name="close" />
          </button>
        </div>
        <div className={styles.body}>{open && children}</div>
        <div className={styles.foot}>
          <button
            type="button"
            className={`ui-btn ui-btn--ghost ${styles.clear}`}
            onClick={onClear}
            aria-disabled={!canClear}
          >
            {t('clearAll')}
          </button>
          <button type="button" className={`ui-btn ui-btn--gold ${styles.apply}`} onClick={close}>
            {t('apply', { count: total })}
          </button>
        </div>
      </div>
    </dialog>
  );
}
