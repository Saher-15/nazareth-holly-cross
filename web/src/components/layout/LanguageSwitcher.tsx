'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDownIcon, CheckIcon, GlobeIcon } from '@/components/ui/icons';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { isRtl, locales, localeNames, type Locale } from '@/i18n/routing';
import styles from './LanguageSwitcher.module.css';

const COLUMNS = 2;
/** A language change rebuilds the page under the new language; this flag lets the new button take the focus back. */
const FOCUS_FLAG = 'nhc:focus-language-button';
const NAV_KEYS = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];

/** Index the arrow keys lead to from `index` in a grid of `COLUMNS` columns (mirrored in RTL). */
export function nextOptionIndex(index: number, key: string, count: number, rtl: boolean): number {
  const horizontal = rtl ? -1 : 1;
  switch (key) {
    case 'ArrowRight':
      return Math.min(count - 1, Math.max(0, index + horizontal));
    case 'ArrowLeft':
      return Math.min(count - 1, Math.max(0, index - horizontal));
    case 'ArrowDown':
      return index + COLUMNS < count ? index + COLUMNS : index;
    case 'ArrowUp':
      return index - COLUMNS >= 0 ? index - COLUMNS : index;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return index;
  }
}

// The language menu: a button that opens a grid of all the languages, each written in itself.
// Every language is a real link to the same page in that language (so it works without JavaScript, can
// be opened in a new tab and is found by search engines); next-intl remembers the choice in the
// NEXT_LOCALE cookie. With JavaScript a plain click is handled in place, so the query string and the
// section of the page (#hash) are kept too.
// Keyboard: the arrow keys, Home and End move between languages, Escape closes and the focus returns
// to the button (as it does after choosing).
export default function LanguageSwitcher() {
  const t = useTranslations('site');
  const tx = useTranslations('ux.language');
  const current = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const rtl = isRtl(current);

  // The page is rebuilt when the language changes, so the button that had the focus is a new element.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(FOCUS_FLAG)) {
        sessionStorage.removeItem(FOCUS_FLAG);
        triggerRef.current?.focus();
      }
    } catch {
      /* storage blocked: the focus simply starts from the top */
    }
  }, []);

  const options = () => Array.from(rootRef.current?.querySelectorAll<HTMLAnchorElement>('[data-locale]') ?? []);

  // Opening moves the focus to the current language; closing from outside needs no focus change.
  useEffect(() => {
    if (!open) return undefined;
    const list = options();
    (list.find((el) => el.dataset.locale === current) ?? list[0])?.focus();

    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onFocusIn = (e: FocusEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, current]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const choose = (event: MouseEvent<HTMLAnchorElement>, locale: Locale) => {
    // A modified click (new tab, new window) is the browser's business: let it follow the link.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      setOpen(false);
      return;
    }
    event.preventDefault();
    close(true);
    if (locale === current) return;
    try {
      sessionStorage.setItem(FOCUS_FLAG, '1');
      // If the page is not rebuilt (no new button), the wish must not linger.
      setTimeout(() => sessionStorage.removeItem(FOCUS_FLAG), 5000);
    } catch {
      /* storage blocked */
    }
    // Same page in the other language: /en/shop/123?page=2#top -> /he/shop/123?page=2#top
    // (`pathname` is already the real path, so no route params are needed).
    router.replace(`${pathname}${window.location.search}${window.location.hash}`, { locale });
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    const list = options();
    const index = list.indexOf(document.activeElement as HTMLAnchorElement);
    if (index < 0) return;
    if (!NAV_KEYS.includes(e.key)) return;
    e.preventDefault();
    list[nextOptionIndex(index, e.key, list.length, rtl)]?.focus();
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${t('language')}: ${localeNames[current]}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <GlobeIcon size={18} />
        <span className={styles.code} aria-hidden="true">
          {current.toUpperCase()}
        </span>
        <ChevronDownIcon size={14} className={`${styles.caret} ${open ? styles.caretOpen : ''}`} />
      </button>
      {open && (
        <ul id={menuId} className={styles.menu} aria-label={tx('choose')} onKeyDown={onMenuKeyDown}>
          {locales.map((locale) => (
            <li key={locale}>
              <Link
                href={pathname}
                locale={locale}
                lang={locale}
                hrefLang={locale}
                prefetch={false}
                data-locale={locale}
                className={styles.option}
                aria-current={locale === current ? 'true' : undefined}
                onClick={(event) => choose(event, locale)}
              >
                <span className={styles.name}>{localeNames[locale]}</span>
                {locale === current ? (
                  <CheckIcon size={16} className={styles.check} />
                ) : (
                  <span className={styles.tag} aria-hidden="true">
                    {locale.toUpperCase()}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
