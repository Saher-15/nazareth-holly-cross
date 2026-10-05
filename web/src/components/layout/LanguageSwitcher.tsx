'use client';

import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { locales, localeNames, type Locale } from '@/i18n/routing';
import styles from './LanguageSwitcher.module.css';

const FOCUS_KEY = 'nhc.lang-switch-focus';

// The language menu. Every language is a real link to the same page in that language (so it works
// without JavaScript, can be opened in a new tab and is found by search engines); next-intl remembers
// the choice in the NEXT_LOCALE cookie when one is followed. With JavaScript a plain click is handled
// in place so the query string and the section of the page (#hash) are kept too.
export default function LanguageSwitcher() {
  const t = useTranslations('site');
  const current = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: globalThis.MouseEvent) => {
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

  const choose = (event: MouseEvent<HTMLAnchorElement>, locale: Locale) => {
    setOpen(false);
    // A modified click (new tab, new window, download) is the browser's business: follow the link.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    triggerRef.current?.focus(); // the option being clicked disappears; focus must not fall to <body>
    try {
      sessionStorage.setItem(FOCUS_KEY, '1');
      // If the page is not rendered again (no new element), the wish must not linger.
      setTimeout(() => sessionStorage.removeItem(FOCUS_KEY), 5000);
    } catch {
      // see above
    }
    // Same page in the other language: /en/shop/123?page=2#top -> /he/shop/123?page=2#top
    // (`pathname` is already the real path, so no route params are needed).
    router.replace(`${pathname}${window.location.search}${window.location.hash}`, { locale });
  };

  return (
    <div className={styles.root} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${t('language')}: ${localeNames[current]}`}
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">🌐</span>
        <span className={styles.code}>{current.toUpperCase()}</span>
      </button>
      {open && (
        <ul id={menuId} className={styles.menu} aria-label={t('language')}>
          {locales.map((locale) => (
            <li key={locale}>
              <Link
                href={pathname}
                locale={locale}
                lang={locale}
                hrefLang={locale}
                prefetch={false}
                className={styles.option}
                aria-current={locale === current ? 'true' : undefined}
                onClick={(event) => choose(event, locale)}
              >
                {localeNames[locale]}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
