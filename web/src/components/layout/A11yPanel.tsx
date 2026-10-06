'use client';

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { AccessibilityIcon, CloseIcon } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import {
  A11Y_ATTRIBUTES,
  applySettings,
  commitSettings,
  DEFAULT_SETTINGS,
  isDefault,
  parseSettings,
  readStoredSettings,
  subscribeSettings,
  SWITCHES,
  TEXT_SIZES,
  type A11ySettings,
  type SwitchName,
  type TextSize,
} from '@/lib/a11y';
import { subscribeMotion, systemReducesMotion } from '@/lib/motion';
import styles from './A11yPanel.module.css';


// The accessibility settings: a round button with the international accessibility sign, floating in the bottom
// corner of every page at the start of the line (left in English, right in Hebrew and Arabic; the back-to-top button
// has the other corner), that opens a small non-modal dialog above itself with the text size, high contrast,
// underlined links, stopped animations, a readable font, text spacing, a strong focus ring and a large pointer
// (lib/a11y.ts applies and stores them; the CSS lives in tokens.css and globals.css). It is rendered right after the
// site header (app/[locale]/layout.tsx), so the keyboard reaches it early, inside its own labelled landmark.
// Keyboard: the button opens it and the focus moves to the text size; Tab walks through the controls; Escape or
// the close button closes it and gives the focus back to the button; moving the focus or clicking elsewhere closes
// it too. Every control is a real radio button or check box (a switch), so screen readers announce their state.
export default function A11yPanel() {
  const t = useTranslations('ux.a11y');
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const rootRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();

  // The stored settings are the source of truth (also across tabs); the server and the first render see the defaults.
  const raw = useSyncExternalStore(subscribeSettings, readStoredSettings, () => null);
  const settings = useMemo(() => parseSettings(raw), [raw]);
  const systemMotion = useSyncExternalStore(subscribeMotion, systemReducesMotion, () => false);

  // The pre-paint script put the settings on <html> before React started. When React renders <html> itself instead
  // of hydrating it (the not-found page does), it drops attributes it does not know; put them back whenever that
  // happens.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => applySettings(root, parseSettings(readStoredSettings()));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: A11Y_ATTRIBUTES });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    // The focus goes to the chosen text size, the first control.
    panelRef.current?.querySelector<HTMLInputElement>('input[name="a11y-text"]:checked')?.focus();
    const outside = (target: EventTarget | null) => !!rootRef.current && !rootRef.current.contains(target as Node);
    const onDown = (e: PointerEvent) => outside(e.target) && setOpen(false);
    const onFocusIn = (e: FocusEvent) => outside(e.target) && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const update = (next: A11ySettings) => {
    setAnnouncement('');
    commitSettings(next);
  };

  const reset = () => {
    commitSettings({ ...DEFAULT_SETTINGS });
    setAnnouncement(t('resetDone'));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  const labels: Record<SwitchName, string> = {
    contrast: t('contrast'),
    links: t('links'),
    motion: t('motion'),
    font: t('font'),
    spacing: t('spacing'),
    focus: t('focus'),
    cursor: t('cursor'),
  };
  // A one-line explanation under some switches; the motion one says so when the device already stops animations.
  const hints: Partial<Record<SwitchName, string>> = {
    contrast: t('contrastHint'),
    motion: systemMotion ? t('motionSystem') : t('motionHint'),
    font: t('fontHint'),
    spacing: t('spacingHint'),
    focus: t('focusHint'),
  };

  const percent = (size: TextSize) => format.number(size / 100, { style: 'percent', numberingSystem: 'latn' });

  return (
    // data-floating: the phone menu makes it inert while it covers the page (SiteHeader.tsx).
    <aside className={styles.root} ref={rootRef} onKeyDown={onKeyDown} aria-label={t('title')} data-floating="" data-print="hide">
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        aria-label={t('open')}
        data-a11y-active={isDefault(settings) ? undefined : 'true'}
        onClick={() => setOpen((v) => !v)}
      >
        <AccessibilityIcon size={26} />
      </button>

      {open && (
        <div ref={panelRef} id={panelId} role="dialog" aria-labelledby={titleId} className={styles.panel}>
          <div className={styles.head}>
            <h2 id={titleId} className={styles.title}>
              {t('title')}
            </h2>
            <button type="button" className={styles.close} aria-label={t('close')} onClick={close}>
              <CloseIcon size={20} />
            </button>
          </div>
          <p className={styles.intro}>{t('intro')}</p>

          <fieldset className={styles.sizes}>
            <legend className={styles.legend}>{t('textSize')}</legend>
            <div className={styles.sizeRow}>
              {TEXT_SIZES.map((size) => (
                <label key={size} className={styles.size}>
                  <input
                    type="radio"
                    name="a11y-text"
                    value={size}
                    checked={settings.text === size}
                    onChange={() => update({ ...settings, text: size })}
                  />
                  <span className="ui-ltr">{percent(size)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <ul className={styles.switches}>
            {SWITCHES.map((name) => {
              const hintId = `${panelId}-${name}-hint`;
              const hint = hints[name];
              return (
                <li key={name}>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={settings[name]}
                      aria-describedby={hint ? hintId : undefined}
                      onChange={(e) => update({ ...settings, [name]: e.target.checked })}
                    />
                    <span className={styles.track} aria-hidden="true" />
                    <span className={styles.label}>{labels[name]}</span>
                  </label>
                  {hint && (
                    <p id={hintId} className={styles.hint}>
                      {hint}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className={styles.foot}>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={reset}>
              {t('reset')}
            </button>
            <Link href="/accessibility" className={`ui-link ${styles.statement}`} onClick={() => setOpen(false)}>
              {t('statement')}
            </Link>
          </div>
          <p className="visually-hidden" role="status">
            {announcement}
          </p>
        </div>
      )}
    </aside>
  );
}
