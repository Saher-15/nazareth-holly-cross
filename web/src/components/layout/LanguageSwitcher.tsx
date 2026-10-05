'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, localeNames, type Locale } from '@/i18n/routing';
import styles from './LanguageSwitcher.module.css';

const FOCUS_KEY = 'nhc.lang-switch-focus';

export default function LanguageSwitcher() {
  const t = useTranslations('site');
  const current = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      // Keep keyboard focus where the visitor was working instead of dropping it on <body>.
      if (ref.current?.contains(document.activeElement)) triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // A language change renders the whole page again, so the switcher is a new element: it takes the
  // keyboard focus back once (the previous one stored the wish just before navigating).
  useEffect(() => {
    try {
      if (sessionStorage.getItem(FOCUS_KEY)) {
        sessionStorage.removeItem(FOCUS_KEY);
        triggerRef.current?.focus();
      }
    } catch {
      // storage blocked: focus simply starts at the top of the new page
    }
  }, []);

  const choose = (locale: Locale) => {
    setOpen(false);
    triggerRef.current?.focus(); // the option being clicked disappears; focus must not fall to <body>
    try {
      sessionStorage.setItem(FOCUS_KEY, '1');
      // If the page is not rendered again (no new element), the wish must not linger.
      setTimeout(() => sessionStorage.removeItem(FOCUS_KEY), 5000);
    } catch {
      // see above
    }
    startTransition(() => {
      // Same page in the other language: /en/shop/123?page=2#top -> /he/shop/123?page=2#top
      // (`pathname` is already the real path, so no route params are needed).
      router.replace(`${pathname}${window.location.search}${window.location.hash}`, { locale });
    });
  };

  return (
    <div className={styles.root} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${t('language')}: ${localeNames[current]}`}
        ref={triggerRef}
        aria-busy={pending || undefined}
        onClick={() => !pending && setOpen((v) => !v)}
      >
        <span aria-hidden="true">🌐</span>
        <span className={styles.code}>{current.toUpperCase()}</span>
      </button>
      {open && (
        <ul className={styles.menu} aria-label={t('language')}>
          {locales.map((locale) => (
            <li key={locale}>
              <button
                type="button"
                lang={locale}
                className={styles.option}
                aria-current={locale === current ? 'true' : undefined}
                onClick={() => choose(locale)}
              >
                {localeNames[locale]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
