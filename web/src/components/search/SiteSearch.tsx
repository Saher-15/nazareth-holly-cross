'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { searchEntries, snippet, type SearchEntry, type SearchType } from '@/lib/search';
import { OPEN_SEARCH_EVENT } from './events';
import styles from './SiteSearch.module.css';

const TYPES: readonly SearchType[] = ['page', 'site', 'faq', 'gospel'];
// What to offer before anything is typed.
const SUGGESTED = ['page-plan', 'page-sites', 'page-visit', 'page-gospel', 'page-shop', 'page-candle'];

const indexes = new Map<string, Promise<SearchEntry[]>>();

/** One request per language and visit; a failed load is retried the next time the palette opens. */
function loadIndex(locale: string): Promise<SearchEntry[]> {
  let promise = indexes.get(locale);
  if (!promise) {
    promise = fetch(`/${locale}/search-index.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`search index ${res.status}`);
        return res.json() as Promise<SearchEntry[]>;
      })
      .catch((error) => {
        indexes.delete(locale);
        throw error;
      });
    indexes.set(locale, promise);
  }
  return promise;
}

// The command-palette search: Ctrl or Cmd + K (or the Search button in the footer) opens a dialog that finds
// pages, holy sites, FAQ answers and Gospel passages in the visitor's language. The index is a small static
// file loaded on first use. Combobox pattern: the input keeps focus, arrows move the highlighted result.
export default function SiteSearch() {
  const t = useTranslations('pilgrim.search');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);

  const show = useCallback(() => setOpen(true), []);

  // Ctrl/Cmd + K from anywhere; the footer button sends an event.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, show);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, show);
    };
  }, [show]);

  // Open and close the native modal dialog with the state.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Load the index the first time the palette opens (and again after a failure).
  useEffect(() => {
    if (!open || entries) return;
    let cancelled = false;
    loadIndex(locale).then(
      (data) => {
        if (!cancelled) {
          setEntries(data);
          setFailed(false);
        }
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, entries, locale]);

  // A page change closes the palette.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const results = useMemo(() => {
    if (!entries) return [];
    if (!query.trim()) return SUGGESTED.map((id) => entries.find((e) => e.id === id)).filter((e): e is SearchEntry => !!e);
    return searchEntries(entries, query, 10);
  }, [entries, query]);

  const grouped = useMemo(
    () => TYPES.map((type) => ({ type, items: results.filter((r) => r.type === type) })).filter((g) => g.items.length),
    [results],
  );
  // Results in display order (grouped by type), which is the order the arrow keys walk through.
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);
  const activeIndex = Math.min(active, Math.max(0, flat.length - 1));
  const optionId = (id: string) => `${listId}-${id}`;

  const go = (entry: SearchEntry) => {
    setOpen(false);
    router.push(entry.href);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!flat.length) return;
      setActive((activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length);
    } else if (e.key === 'Enter' && flat[activeIndex]) {
      e.preventDefault();
      go(flat[activeIndex]);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={t('label')}
      onClose={() => setOpen(false)}
      onClick={(e) => {
        // A click on the dimmed backdrop (the dialog element itself) closes it.
        if (e.target === dialogRef.current) setOpen(false);
      }}
    >
      <div className={styles.box}>
        <div className={styles.field}>
          <svg className={styles.icon} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            role="combobox"
            className={styles.input}
            placeholder={t('placeholder')}
            aria-label={t('label')}
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={flat[activeIndex] ? optionId(flat[activeIndex].id) : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <button type="button" className={styles.close} onClick={() => setOpen(false)}>
            {t('close')}
          </button>
        </div>

        <div className={styles.body}>
          <p className="visually-hidden" role="status">
            {entries && query.trim() ? t('count', { count: flat.length }) : ''}
          </p>
          {failed && <p className={styles.empty}>{t('error')}</p>}
          {!failed && !entries && <p className={styles.empty}>{t('loading')}</p>}
          {entries && !query.trim() && <p className={styles.heading}>{t('suggested')}</p>}
          {entries && query.trim() && flat.length === 0 && <p className={styles.empty}>{t('none', { query: query.trim() })}</p>}

          <ul id={listId} role="listbox" aria-label={t('results')} className={styles.list}>
            {grouped.map((group) => (
              <li key={group.type} role="presentation" className={styles.group}>
                {query.trim() && <p className={styles.heading}>{t(`types.${group.type}`)}</p>}
                <ul role="presentation" className={styles.groupList}>
                  {group.items.map((entry) => {
                    const selected = flat[activeIndex]?.id === entry.id;
                    return (
                      <li key={entry.id} role="presentation">
                        <Link
                          id={optionId(entry.id)}
                          role="option"
                          aria-selected={selected}
                          href={entry.href}
                          className={`${styles.option} ${selected ? styles.selected : ''}`}
                          onClick={() => setOpen(false)}
                          onMouseMove={() => setActive(flat.findIndex((f) => f.id === entry.id))}
                        >
                          <span className={styles.title}>{entry.title}</span>
                          {entry.text && <span className={styles.snippet}>{snippet(entry.text, query)}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
        <p className={styles.hint} aria-hidden="true">
          <kbd>↑</kbd> <kbd>↓</kbd> {t('hintMove')} · <kbd>Enter</kbd> {t('hintOpen')} · <kbd>Esc</kbd> {t('hintClose')}
        </p>
      </div>
    </dialog>
  );
}
