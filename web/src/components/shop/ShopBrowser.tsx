'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import CartPill from './CartPill';
import ProductCard from './ProductCard';
import ShopIcon from './ShopIcon';
import StateCard from './StateCard';
import {
  browse,
  browseStateToSearch,
  DEFAULT_BROWSE,
  parseBrowseState,
  SORT_KEYS,
  type BrowseState,
  type ShopItem,
  type SortKey,
} from './catalog';
import styles from './ShopBrowser.module.css';

// The search / sort / page state lives in the URL (?q=&sort=&page=), so a filtered view
// can be shared and the back button returns to the page the visitor came from.
// The server renders the default view (good for search engines); the URL is read
// after hydration through useSyncExternalStore, which needs no setState in an effect.
const URL_EVENT = 'nhc:shop-url';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(URL_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(URL_EVENT, onChange);
  };
}
const readSearch = () => window.location.search;
const serverSearch = () => '';

const sortLabelKey: Record<SortKey, { ns: 'shopPage' | 'shop'; key: string }> = {
  rating: { ns: 'shopPage', key: 'sortRating' },
  name: { ns: 'shopPage', key: 'sortName' },
  priceAsc: { ns: 'shop', key: 'sortLowToHigh' },
  priceDesc: { ns: 'shop', key: 'sortHighToLow' },
};

export default function ShopBrowser({ products }: { products: ShopItem[] }) {
  const t = useTranslations('shopPage');
  const tShop = useTranslations('shop');
  const tPager = useTranslations('pagination');
  const format = useFormatter();
  const locale = useLocale();

  const search = useSyncExternalStore(subscribe, readSearch, serverSearch);
  const state = useMemo(() => parseBrowseState(search), [search]);
  const result = useMemo(() => browse(products, state, locale), [products, state, locale]);

  const countRef = useRef<HTMLParagraphElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  // Purely visual: the filter bar gets a solid backdrop once it sticks under the header.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    // The site header is about 68px tall; the bar sticks right under it.
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 72), {
      rootMargin: '-72px 0px 0px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const update = (next: Partial<BrowseState>, mode: 'replace' | 'push' = 'replace') => {
    const merged = { ...state, ...next };
    const url = `${window.location.pathname}${browseStateToSearch(merged)}${window.location.hash}`;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event(URL_EVENT));
  };

  const onSearch = (e: ChangeEvent<HTMLInputElement>) => update({ query: e.target.value, page: 1 });
  const onSort = (e: ChangeEvent<HTMLSelectElement>) => update({ sort: e.target.value as SortKey, page: 1 });
  const reset = () => update(DEFAULT_BROWSE);

  const goToPage = (page: number) => {
    if (page < 1 || page > result.totalPages || page === result.page) return;
    update({ page }, 'push');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    countRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    countRef.current?.focus({ preventScroll: true });
  };

  const isFiltered = state.query.trim() !== '' || state.sort !== DEFAULT_BROWSE.sort;
  const pages = Array.from({ length: result.totalPages }, (_, i) => i + 1);
  const atFirst = result.page <= 1;
  const atLast = result.page >= result.totalPages;

  return (
    <>
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      <div className={styles.barWrap} data-stuck={stuck}>
        <div className="ui-container">
          <form role="search" aria-label={t('filtersLabel')} className={styles.bar} onSubmit={(e) => e.preventDefault()}>
            <div className={styles.search}>
              <label htmlFor="shop-search" className="visually-hidden">
                {t('searchLabel')}
              </label>
              <ShopIcon name="search" className={styles.searchIcon} />
              <input
                id="shop-search"
                type="search"
                className={`ui-input ${styles.input}`}
                placeholder={tShop('searchPlaceholder')}
                value={state.query}
                onChange={onSearch}
                autoComplete="off"
                enterKeyHint="search"
                maxLength={100}
              />
              {state.query && (
                <button
                  type="button"
                  className={styles.clear}
                  onClick={() => update({ query: '', page: 1 })}
                  aria-label={t('clearSearch')}
                >
                  <ShopIcon name="close" />
                </button>
              )}
            </div>
            <div className={styles.tools}>
              <label htmlFor="shop-sort" className={styles.sortLabel}>
                {t('sortLabel')}
              </label>
              <select id="shop-sort" className={`ui-select ${styles.select}`} value={state.sort} onChange={onSort}>
                {SORT_KEYS.map((key) => {
                  const { ns, key: msg } = sortLabelKey[key];
                  return (
                    <option key={key} value={key}>
                      {ns === 'shop' ? tShop(msg) : t(msg)}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                className={styles.reset}
                onClick={reset}
                aria-disabled={!isFiltered}
                title={tShop('resetFilters')}
              >
                <ShopIcon name="reset" className={styles.resetIcon} />
                <span className={styles.resetText}>{tShop('resetFilters')}</span>
              </button>
              <CartPill className={styles.cart} />
            </div>
          </form>
        </div>
      </div>

      <section className={`ui-container ${styles.results}`} aria-labelledby="shop-results-heading">
        <h2 id="shop-results-heading" className="visually-hidden">
          {t('productsHeading')}
        </h2>
        <p ref={countRef} className={styles.count} tabIndex={-1} aria-live="polite" data-testid="shop-count">
          {result.total > 0 ? t('showing', { from: result.from, to: result.to, total: result.total }) : ''}
        </p>

        {result.total === 0 ? (
          <StateCard icon="search" title={tShop('noProducts')} role="status">
            <button type="button" className="ui-btn ui-btn--ghost" onClick={reset}>
              <ShopIcon name="reset" />
              {tShop('resetFilters')}
            </button>
          </StateCard>
        ) : (
          <>
            <ul className={styles.grid}>
              {result.items.map((item, i) => (
                <li key={item._id} className={styles.cell}>
                  <ProductCard item={item} index={i} eager={result.page === 1 && i < 4} />
                </li>
              ))}
            </ul>

            {result.totalPages > 1 && (
              <nav className={styles.pager} aria-label={t('pagesLabel')}>
                <button
                  type="button"
                  className={`ui-btn ui-btn--glass ${styles.step}`}
                  onClick={() => goToPage(result.page - 1)}
                  aria-disabled={atFirst}
                >
                  <ShopIcon name="arrowBack" />
                  <span>{tPager('prev')}</span>
                </button>
                <ol className={styles.pages}>
                  {pages.map((page) => (
                    <li key={page}>
                      <button
                        type="button"
                        className={styles.page}
                        onClick={() => goToPage(page)}
                        aria-current={page === result.page ? 'page' : undefined}
                        aria-label={t('pageLabel', { page })}
                      >
                        {format.number(page)}
                      </button>
                    </li>
                  ))}
                </ol>
                <span className={styles.pageStatus}>
                  {tShop('pagination', { currentPage: result.page, totalPages: result.totalPages })}
                </span>
                <button
                  type="button"
                  className={`ui-btn ui-btn--glass ${styles.step}`}
                  onClick={() => goToPage(result.page + 1)}
                  aria-disabled={atLast}
                >
                  <span>{tPager('next')}</span>
                  <ShopIcon name="arrowNext" />
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </>
  );
}
