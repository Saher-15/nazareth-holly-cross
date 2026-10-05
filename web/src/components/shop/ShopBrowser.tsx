'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { resolveIds, type ShopItem, type Strip } from '@/lib/shop/items';
import {
  activeFilterCount,
  clearFilters,
  filterChips,
  parseQuery,
  runQuery,
  SORTS,
  toSearch,
  withoutChip,
  type FilterChip,
  type ShopQuery,
  type Sort,
} from '@/lib/shop/query';
import { formatUsd } from '@/lib/pricing';
import CartPill from './CartPill';
import FilterDrawer from './FilterDrawer';
import FilterPanel from './FilterPanel';
import ProductCard from './ProductCard';
import ProductStrip from './ProductStrip';
import ShopIcon from './ShopIcon';
import StateCard from './StateCard';
import WishlistLink from './WishlistLink';
import styles from './ShopBrowser.module.css';

// Search, filters, sort and page live in the URL (/shop?category=rosaries&material=gold&sort=name),
// so any view can be shared and Back steps through the filters the visitor tried.
// The server renders the default view (good for search engines); the URL is read after
// hydration through useSyncExternalStore, which needs no setState in an effect.
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

type Props = { products: ShopItem[]; strip: Strip };

export default function ShopBrowser({ products, strip }: Props) {
  const t = useTranslations('shopPage');
  const tf = useTranslations('shopFeatures');
  const tShop = useTranslations('shop');
  const tPager = useTranslations('pagination');
  const format = useFormatter();
  const locale = useLocale();

  const search = useSyncExternalStore(subscribe, readSearch, serverSearch);
  const query = useMemo(() => parseQuery(new URLSearchParams(search)), [search]);
  const result = useMemo(() => runQuery(products, query, locale), [products, query, locale]);
  const stripItems = useMemo(() => resolveIds(strip.ids, products), [strip.ids, products]);
  const filters = activeFilterCount(query);
  const chips = filterChips(query);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const countRef = useRef<HTMLParagraphElement>(null);
  const chipsRef = useRef<HTMLUListElement>(null);
  const focusChip = useRef<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  // Purely visual: the search bar gets a solid backdrop once it sticks under the header.
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

  // After a chip was removed, focus moves to the chip that took its place (or "Clear all"
  // / the result count), so keyboard users are not dropped at the top of the page.
  useEffect(() => {
    const index = focusChip.current;
    if (index === null) return;
    focusChip.current = null;
    const buttons = chipsRef.current?.querySelectorAll<HTMLButtonElement>('button');
    const next = buttons?.length ? buttons[Math.min(index, buttons.length - 1)] : null;
    (next ?? countRef.current)?.focus();
  }, [search]);

  /** Writes a query to the URL: "push" for a deliberate change (Back undoes it), "replace" while typing. */
  const go = (next: ShopQuery, mode: 'push' | 'replace' = 'push') => {
    const url = `${window.location.pathname}${toSearch(next)}${window.location.hash}`;
    if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event(URL_EVENT));
  };
  const change = (patch: Partial<ShopQuery>, mode?: 'push' | 'replace') => go({ ...query, page: 1, ...patch }, mode);

  const onSearch = (e: ChangeEvent<HTMLInputElement>) => change({ q: e.target.value }, 'replace');
  const onSort = (e: ChangeEvent<HTMLSelectElement>) => change({ sort: e.target.value as Sort });
  const clearAll = () => go(clearFilters(query));

  const removeChip = (chip: FilterChip, index: number) => {
    focusChip.current = index;
    go(withoutChip(query, chip));
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > result.pages || page === result.page) return;
    go({ ...query, page });
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    countRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    countRef.current?.focus({ preventScroll: true });
  };

  const money = (n: number) => formatUsd(n, locale);
  const chipLabel = (chip: FilterChip) => {
    switch (chip.kind) {
      case 'q':
        return tf('filters.chipSearch', { query: chip.value });
      case 'category':
        return tf(`categories.${chip.value}`);
      case 'material':
        return tf(`materials.${chip.value}`);
      case 'price':
        if (chip.min !== null && chip.max !== null)
          return tf('filters.chipPriceRange', { min: money(chip.min), max: money(chip.max) });
        return chip.min !== null
          ? tf('filters.chipPriceMin', { min: money(chip.min) })
          : tf('filters.chipPriceMax', { max: money(chip.max ?? 0) });
      case 'rating':
        return tf('filters.ratingAtLeast', { stars: chip.value });
      case 'stock':
        return tf('filters.inStock');
    }
  };

  const showStrip = filters === 0 && result.page === 1 && stripItems.length > 0;
  const pages = Array.from({ length: result.pages }, (_, i) => i + 1);
  const atFirst = result.page <= 1;
  const atLast = result.page >= result.pages;

  return (
    <>
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      <div className={styles.barWrap} data-stuck={stuck}>
        <div className="ui-container">
          <div className={styles.bar}>
            <form role="search" aria-label={t('searchLabel')} className={styles.search} onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="shop-search" className="visually-hidden">
                {t('searchLabel')}
              </label>
              <ShopIcon name="search" className={styles.searchIcon} />
              <input
                id="shop-search"
                type="search"
                className={`ui-input ${styles.input}`}
                placeholder={tShop('searchPlaceholder')}
                value={query.q}
                onChange={onSearch}
                autoComplete="off"
                enterKeyHint="search"
                maxLength={80}
              />
              {query.q && (
                <button type="button" className={styles.clear} onClick={() => change({ q: '' })} aria-label={t('clearSearch')}>
                  <ShopIcon name="close" />
                </button>
              )}
            </form>
            <div className={styles.saved}>
              <WishlistLink />
              <CartPill />
            </div>
            <div className={styles.tools}>
              <button
                type="button"
                className={styles.filtersButton}
                onClick={() => setDrawerOpen(true)}
                aria-haspopup="dialog"
                aria-label={tf('filters.openAria', { count: filters })}
                data-testid="filters-button"
              >
                <ShopIcon name="filter" className={styles.filtersIcon} />
                <span>{tf('filters.title')}</span>
                {filters > 0 && (
                  <span className={styles.filtersCount} aria-hidden="true">
                    {format.number(filters)}
                  </span>
                )}
              </button>
              <label htmlFor="shop-sort" className={styles.sortLabel}>
                {t('sortLabel')}
              </label>
              <select id="shop-sort" className={`ui-select ${styles.select}`} value={query.sort} onChange={onSort}>
                {SORTS.map((key) => (
                  <option key={key} value={key}>
                    {tf(`sort.${key}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className={`ui-container ${styles.layout}`}>
        <aside className={styles.sidebar} aria-labelledby="shop-filters-title">
          <div className={styles.sidebarHead}>
            <h2 id="shop-filters-title" className={styles.sidebarTitle}>
              <ShopIcon name="filter" className={styles.filtersIcon} />
              {tf('filters.title')}
            </h2>
            {filters > 0 && (
              <button type="button" className={styles.textButton} onClick={clearAll}>
                {tf('filters.clearAll')}
              </button>
            )}
          </div>
          <FilterPanel query={query} facets={result.facets} onChange={(patch) => change(patch)} />
        </aside>

        <section className={styles.results} aria-labelledby="shop-results-heading">
          {showStrip && (
            <ProductStrip
              id="shop-strip"
              title={strip.kind === 'bestsellers' ? tf('strip.bestTitle') : tf('strip.favTitle')}
              lead={strip.kind === 'bestsellers' ? tf('strip.bestLead') : tf('strip.favLead')}
              items={stripItems}
            />
          )}

          <h2 id="shop-results-heading" className={showStrip ? styles.resultsTitle : 'visually-hidden'}>
            {showStrip ? tf('allProducts') : t('productsHeading')}
          </h2>

          <div className={styles.resultsHead}>
            <p ref={countRef} className={styles.count} tabIndex={-1} aria-live="polite" data-testid="shop-count">
              {result.total > 0 ? t('showing', { from: result.from, to: result.to, total: result.total }) : ''}
            </p>
            {chips.length > 0 && (
              <div className={styles.chips}>
                <ul ref={chipsRef} className={styles.chipList} aria-label={tf('filters.active')}>
                  {chips.map((chip, i) => {
                    const label = chipLabel(chip);
                    return (
                      <li key={`${chip.kind}-${'value' in chip ? chip.value : ''}`}>
                        <button
                          type="button"
                          className={styles.chip}
                          onClick={() => removeChip(chip, i)}
                          aria-label={tf('filters.remove', { label })}
                          data-testid="filter-chip"
                        >
                          <bdi>{label}</bdi>
                          <ShopIcon name="close" className={styles.chipIcon} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button type="button" className={styles.textButton} onClick={clearAll}>
                  {tf('filters.clearAll')}
                </button>
              </div>
            )}
          </div>

          {result.total === 0 ? (
            <StateCard icon="search" title={tShop('noProducts')} text={tf('filters.noneText')} role="status">
              <button type="button" className="ui-btn ui-btn--ghost" onClick={clearAll}>
                <ShopIcon name="reset" />
                {tf('filters.clearAll')}
              </button>
            </StateCard>
          ) : (
            <>
              <ul className={styles.grid} data-testid="shop-grid">
                {result.items.map((item, i) => (
                  <li key={item._id} className={styles.cell}>
                    <ProductCard item={item} index={i} eager={result.page === 1 && !showStrip && i < 3} />
                  </li>
                ))}
              </ul>

              {result.pages > 1 && (
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
                    {tShop('pagination', { currentPage: result.page, totalPages: result.pages })}
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
      </div>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        total={result.total}
        canClear={filters > 0}
        onClear={clearAll}
      >
        <FilterPanel query={query} facets={result.facets} onChange={(patch) => change(patch)} />
      </FilterDrawer>
    </>
  );
}
