'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { CATEGORIES, MATERIALS, type Category, type Material } from '@/lib/shop/terms';
import type { runQuery, ShopQuery } from '@/lib/shop/query';
import styles from './FilterPanel.module.css';

type Facets = ReturnType<typeof runQuery>['facets'];
export type FilterChange = (patch: Partial<ShopQuery>) => void;

type Props = {
  query: ShopQuery;
  facets: Facets;
  onChange: FilterChange;
};

// The shop's filters: category, material, price range, minimum rating and stock. Every
// option shows how many products it would give with the other filters kept. The same
// panel sits in the desktop sidebar and in the phone drawer.
export default function FilterPanel({ query, facets, onChange }: Props) {
  const t = useTranslations('shopFeatures');
  const format = useFormatter();
  const id = useId();
  const count = (n: number) => (
    <span className={styles.count} data-testid="facet-count">
      {format.number(n)}
    </span>
  );

  // The selected option stays listed even when the other filters leave it with no products.
  const categoryCounts = new Map(facets.categories.map((c) => [c.key, c.count]));
  const categories = CATEGORIES.filter((key) => categoryCounts.has(key) || key === query.category);
  const materialCounts = new Map(facets.materials.map((m) => [m.key, m.count]));
  const materials = MATERIALS.filter((key) => materialCounts.has(key) || query.materials.includes(key));

  const toggleMaterial = (key: Material, on: boolean) =>
    onChange({ materials: on ? [...query.materials, key] : query.materials.filter((m) => m !== key) });

  return (
    <div className={styles.panel}>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t('filters.category')}</legend>
        <ul className={styles.options}>
          <li>
            <label className={styles.option}>
              <input
                type="radio"
                name={`${id}-category`}
                className={styles.control}
                checked={query.category === null}
                onChange={() => onChange({ category: null })}
              />
              <span className={styles.text}>{t('filters.allCategories')}</span>
              {count(facets.allCategories)}
            </label>
          </li>
          {categories.map((key: Category) => (
            <li key={key}>
              <label className={styles.option}>
                <input
                  type="radio"
                  name={`${id}-category`}
                  value={key}
                  className={styles.control}
                  checked={query.category === key}
                  onChange={() => onChange({ category: key })}
                />
                <span className={styles.text}>{t(`categories.${key}`)}</span>
                {count(categoryCounts.get(key) ?? 0)}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {materials.length > 0 && (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('filters.material')}</legend>
          <ul className={styles.options}>
            {materials.map((key) => (
              <li key={key}>
                <label className={styles.option}>
                  <input
                    type="checkbox"
                    value={key}
                    className={styles.control}
                    checked={query.materials.includes(key)}
                    onChange={(e) => toggleMaterial(key, e.target.checked)}
                  />
                  <span className={styles.text}>{t(`materials.${key}`)}</span>
                  {count(materialCounts.get(key) ?? 0)}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <PriceRange
        key={`${query.min}-${query.max}`}
        min={query.min}
        max={query.max}
        bounds={facets.price}
        onCommit={(min, max) => onChange({ min, max })}
      />

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t('filters.rating')}</legend>
        <ul className={styles.options}>
          <li>
            <label className={styles.option}>
              <input
                type="radio"
                name={`${id}-rating`}
                className={styles.control}
                checked={query.rating === null}
                onChange={() => onChange({ rating: null })}
              />
              <span className={styles.text}>{t('filters.anyRating')}</span>
            </label>
          </li>
          {facets.ratings.map(({ min, count: n }) => (
            <li key={min}>
              <label className={styles.option}>
                <input
                  type="radio"
                  name={`${id}-rating`}
                  value={min}
                  className={styles.control}
                  checked={query.rating === min}
                  onChange={() => onChange({ rating: min })}
                />
                <span className={styles.text}>
                  <span className={styles.stars} aria-hidden="true">
                    <span className={styles.on}>{'★'.repeat(min)}</span>
                    {'★'.repeat(5 - min)}
                  </span>
                  <span>{t('filters.ratingAtLeast', { stars: min })}</span>
                </span>
                {count(n)}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t('filters.availability')}</legend>
        <label className={styles.option}>
          <input
            type="checkbox"
            className={styles.control}
            checked={query.inStock}
            onChange={(e) => onChange({ inStock: e.target.checked })}
          />
          <span className={styles.text}>{t('filters.inStock')}</span>
          {count(facets.inStock)}
        </label>
      </fieldset>
    </div>
  );
}

type PriceProps = {
  min: number | null;
  max: number | null;
  bounds: { min: number; max: number };
  onCommit: (min: number | null, max: number | null) => void;
};

const toNumber = (value: string) => {
  const n = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

// Two number fields. What is typed is applied when the field is left or Enter is pressed,
// so the grid does not jump while a price is still being typed.
function PriceRange({ min, max, bounds, onCommit }: PriceProps) {
  const t = useTranslations('shopFeatures.filters');
  const id = useId();
  const [draft, setDraft] = useState({ min: min?.toString() ?? '', max: max?.toString() ?? '' });

  const commit = () => {
    let lo = toNumber(draft.min);
    let hi = toNumber(draft.max);
    if (lo !== null && hi !== null && lo > hi) [lo, hi] = [hi, lo];
    if (lo !== min || hi !== max) onCommit(lo, hi);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  };

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{t('price')}</legend>
      <div className={styles.price}>
        <div className={styles.priceField}>
          <label htmlFor={`${id}-min`} className={styles.priceLabel}>
            {t('minPrice')}
          </label>
          <input
            id={`${id}-min`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            className={`ui-input ${styles.priceInput}`}
            placeholder={String(bounds.min)}
            value={draft.min}
            onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))}
            onBlur={commit}
            onKeyDown={onKeyDown}
          />
        </div>
        <span className={styles.dash} aria-hidden="true">
          –
        </span>
        <div className={styles.priceField}>
          <label htmlFor={`${id}-max`} className={styles.priceLabel}>
            {t('maxPrice')}
          </label>
          <input
            id={`${id}-max`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            className={`ui-input ${styles.priceInput}`}
            placeholder={String(bounds.max)}
            value={draft.max}
            onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))}
            onBlur={commit}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
    </fieldset>
  );
}
