'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, localeNames, type Locale } from '@/i18n/routing';
import styles from './LanguageSwitcher.module.css';

export default function LanguageSwitcher() {
  const t = useTranslations('site');
  const current = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const menuId = useId();
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
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (locale: Locale) => {
    setOpen(false);
    startTransition(() => {
      // Same page in the other language: /en/shop/123 -> /he/shop/123
      router.replace(
        // @ts-expect-error -- the current route's params are passed through unchanged
        { pathname, params },
        { locale },
      );
    });
  };

  return (
    <div className={styles.root} ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${t('language')}: ${localeNames[current]}`}
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">🌐</span>
        <span className={styles.code}>{current.toUpperCase()}</span>
      </button>
      {open && (
        <ul id={menuId} className={styles.menu} aria-label={t('language')}>
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
