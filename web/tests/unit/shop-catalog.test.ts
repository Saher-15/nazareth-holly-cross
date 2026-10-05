import { describe, expect, it } from 'vitest';
import {
  browse,
  browseStateToSearch,
  DEFAULT_BROWSE,
  filterProducts,
  imageForVariant,
  isCssColour,
  isInStock,
  isProductId,
  maxAddable,
  paginate,
  parseBrowseState,
  sortProducts,
  variantKind,
} from '@/components/shop/catalog';

const item = (name: string, price: number, rate = 1, description = '') => ({ name, price, rate, description });

const products = [
  item('Olive oil', 10, 12, 'The olive tree symbolizes peace.'),
  item('Cana red wine', 10, 11),
  item('Olive wood cross', 50, 1, 'Hand carved in Nazareth.'),
  item('Crèche', 65, 1),
  item('Mary’s well water', 8, 10),
];

describe('filterProducts', () => {
  it('matches every word in the name or description, ignoring case', () => {
    expect(filterProducts(products, 'OLIVE').map((p) => p.name)).toEqual(['Olive oil', 'Olive wood cross']);
    expect(filterProducts(products, 'peace olive').map((p) => p.name)).toEqual(['Olive oil']);
    expect(filterProducts(products, 'carved').map((p) => p.name)).toEqual(['Olive wood cross']);
  });

  it('ignores accents', () => {
    expect(filterProducts(products, 'creche').map((p) => p.name)).toEqual(['Crèche']);
  });

  it('returns everything for an empty or blank query', () => {
    expect(filterProducts(products, '   ')).toHaveLength(products.length);
  });
});

describe('sortProducts', () => {
  it('sorts by rating (highest first) and keeps the API order on ties', () => {
    const sorted = sortProducts([item('b', 1, 1), item('a', 1, 5), item('c', 1, 1)], 'rating');
    expect(sorted.map((p) => p.name)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by price both ways, then by name', () => {
    expect(sortProducts(products, 'priceAsc').map((p) => p.price)).toEqual([8, 10, 10, 50, 65]);
    expect(sortProducts(products, 'priceAsc')[1].name).toBe('Cana red wine');
    expect(sortProducts(products, 'priceDesc').map((p) => p.price)).toEqual([65, 50, 10, 10, 8]);
  });

  it('sorts by name with natural numbers', () => {
    const sorted = sortProducts([item('Cross 10', 1), item('Cross 2', 1), item('angel', 1)], 'name');
    expect(sorted.map((p) => p.name)).toEqual(['angel', 'Cross 2', 'Cross 10']);
  });

  it('does not change the input array', () => {
    const input = [item('b', 2), item('a', 1)];
    sortProducts(input, 'name');
    expect(input.map((p) => p.name)).toEqual(['b', 'a']);
  });
});

describe('paginate', () => {
  const many = Array.from({ length: 30 }, (_, i) => i + 1);

  it('cuts one page and reports the range shown', () => {
    expect(paginate(many, 2, 12)).toMatchObject({ items: many.slice(12, 24), page: 2, totalPages: 3, from: 13, to: 24 });
    expect(paginate(many, 3, 12)).toMatchObject({ from: 25, to: 30, total: 30 });
  });

  it('keeps the page inside the valid range', () => {
    expect(paginate(many, 99, 12).page).toBe(3);
    expect(paginate(many, -4, 12).page).toBe(1);
    expect(paginate(many, Number.NaN, 12).page).toBe(1);
  });

  it('reports an empty result as page 1 of 1 showing nothing', () => {
    expect(paginate([], 1)).toMatchObject({ items: [], page: 1, totalPages: 1, from: 0, to: 0, total: 0 });
  });
});

describe('browse', () => {
  it('searches, sorts and paginates in that order', () => {
    const result = browse(products, { query: 'olive', sort: 'priceDesc', page: 1 });
    expect(result.items.map((p) => p.name)).toEqual(['Olive wood cross', 'Olive oil']);
    expect(result.total).toBe(2);
  });
});

describe('URL state', () => {
  it('reads the query, sort and page', () => {
    expect(parseBrowseState('?q=cross&sort=priceAsc&page=3')).toEqual({ query: 'cross', sort: 'priceAsc', page: 3 });
  });

  it('falls back to defaults for missing or unknown values', () => {
    expect(parseBrowseState('')).toEqual(DEFAULT_BROWSE);
    expect(parseBrowseState('?sort=hack&page=-2')).toEqual(DEFAULT_BROWSE);
    expect(parseBrowseState('?page=abc')).toEqual(DEFAULT_BROWSE);
  });

  it('writes only what differs from the default, and round-trips', () => {
    expect(browseStateToSearch(DEFAULT_BROWSE)).toBe('');
    const state = { query: 'olive oil', sort: 'name' as const, page: 2 };
    const search = browseStateToSearch(state);
    expect(search).toBe('?q=olive+oil&sort=name&page=2');
    expect(parseBrowseState(search)).toEqual(state);
  });
});

describe('variants', () => {
  it('recognises CSS colours', () => {
    for (const c of ['tomato', 'dodgerblue', '#194696', '#C46004', '#fff', 'rgb(1, 2, 3)', 'oklch(70% 0.1 200)']) {
      expect(isCssColour(c)).toBe(true);
    }
    for (const c of ['1', '11', '#12', 'red stripes', '']) expect(isCssColour(c)).toBe(false);
  });

  it('tells colour swatches from numbered designs', () => {
    expect(variantKind([])).toBeNull();
    expect(variantKind(['tomato', 'green', '#194696'])).toBe('colour');
    expect(variantKind(['1', '2', '3'])).toBe('design');
  });

  it('shows the photo that belongs to a variant, else the main photo', () => {
    const product = { img: 'main', additionalImageUrls: ['red', 'blue'] };
    expect(imageForVariant(product, null)).toBe('main');
    expect(imageForVariant(product, 1)).toBe('blue');
    expect(imageForVariant(product, 5)).toBe('main');
  });
});

describe('stock', () => {
  it('treats an untracked stock (null) as available', () => {
    expect(isInStock(null)).toBe(true);
    expect(isInStock(0)).toBe(false);
    expect(isInStock(3)).toBe(true);
  });

  it('limits what can still be added by stock and the per-line cap', () => {
    expect(maxAddable(null, 0, 50)).toBe(50);
    expect(maxAddable(null, 48, 50)).toBe(2);
    expect(maxAddable(3, 1, 50)).toBe(2);
    expect(maxAddable(3, 5, 50)).toBe(0);
  });
});

describe('isProductId', () => {
  it('accepts only 24-character hex ids', () => {
    expect(isProductId('66eb4665c7e03262956c8d1d')).toBe(true);
    expect(isProductId('not-an-id')).toBe(false);
    expect(isProductId('66eb4665c7e03262956c8d1d0')).toBe(false);
  });
});
