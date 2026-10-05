import { describe, expect, it } from 'vitest';
import type { CatalogProduct } from '@/lib/api';
import {
  activeFilterCount,
  badgesFor,
  clearFilters,
  DEFAULT_QUERY,
  filterChips,
  PAGE_SIZE,
  parseQuery,
  runQuery,
  toSearch,
  toSearchParams,
  withoutChip,
} from '@/lib/shop/query';

const make = (over: Partial<CatalogProduct> & { _id: string; name: string }): CatalogProduct => ({
  price: 10,
  img: 'x',
  additionalImageUrls: [],
  description: '',
  color: [],
  stock: null,
  category: 'gifts',
  materials: [],
  featured: 0,
  sold: 0,
  rating: { avg: 0, count: 0 },
  createdAt: null,
  ...over,
});

const PRODUCTS = [
  make({ _id: '1', name: 'Golden rosary', category: 'rosaries', materials: ['gold'], price: 15, sold: 3, rating: { avg: 4.5, count: 2 } }),
  make({ _id: '2', name: 'Wood rosary', category: 'rosaries', materials: ['wood'], price: 7, sold: 9 }),
  make({ _id: '3', name: 'Silver necklace', category: 'necklaces', materials: ['silver'], price: 40, stock: 0 }),
  make({ _id: '4', name: 'Olive oil', category: 'holy-land', price: 10, featured: 12, description: 'Oil from Nazareth' }),
  make({ _id: '5', name: 'Crème bracelet', category: 'bracelets', materials: ['gold', 'silver'], price: 12, stock: 3 }),
];

describe('parseQuery / toSearchParams', () => {
  it('reads a shared URL and writes it back the same way', () => {
    const url = 'q=rosary&category=rosaries&material=gold,wood&min=5&max=20&rating=4&stock=1&sort=priceAsc&page=2';
    const q = parseQuery(new URLSearchParams(url));
    expect(q).toEqual({
      q: 'rosary',
      category: 'rosaries',
      materials: ['gold', 'wood'],
      min: 5,
      max: 20,
      rating: 4,
      inStock: true,
      sort: 'priceAsc',
      page: 2,
    });
    expect(toSearchParams(q).toString()).toBe(url.replace('material=gold,wood', 'material=gold%2Cwood'));
  });

  it('ignores junk and keeps defaults', () => {
    const q = parseQuery({ category: 'spaceships', sort: 'random', rating: '9', page: '-3', min: 'abc', material: 'plastic' });
    expect(q).toEqual(DEFAULT_QUERY);
    expect(toSearchParams(q).toString()).toBe('');
  });

  it('swaps a reversed price range', () => {
    const q = parseQuery({ min: '50', max: '10' });
    expect([q.min, q.max]).toEqual([10, 50]);
  });
});

describe('runQuery', () => {
  const run = (over: Partial<typeof DEFAULT_QUERY>) => runQuery(PRODUCTS, { ...DEFAULT_QUERY, ...over });

  it('searches name, description, category and materials, ignoring accents and case', () => {
    expect(run({ q: 'nazareth' }).items.map((p) => p._id)).toEqual(['4']);
    expect(run({ q: 'CREME' }).items.map((p) => p._id)).toEqual(['5']);
    expect(run({ q: 'gold rosaries' }).items.map((p) => p._id)).toEqual(['1']);
  });

  it('combines category, material, price, rating and stock filters', () => {
    expect(run({ category: 'rosaries' }).total).toBe(2);
    expect(run({ materials: ['silver'] }).items.map((p) => p._id).sort()).toEqual(['3', '5']);
    expect(run({ min: 10, max: 15 }).items.map((p) => p._id).sort()).toEqual(['1', '4', '5']);
    expect(run({ rating: 4 }).items.map((p) => p._id)).toEqual(['1']);
    expect(run({ inStock: true }).items.map((p) => p._id)).not.toContain('3');
  });

  it('sorts by best selling, price and featured', () => {
    expect(run({ sort: 'bestselling' }).items[0]._id).toBe('2');
    expect(run({ sort: 'priceDesc' }).items[0]._id).toBe('3');
    expect(run({ sort: 'featured' }).items[0]._id).toBe('4');
  });

  it('counts facets with the other filters applied', () => {
    const { facets } = run({ materials: ['gold'] });
    expect(facets.categories).toEqual([
      { key: 'rosaries', count: 1 },
      { key: 'bracelets', count: 1 },
    ]);
    // the material facet ignores its own selection, so other materials stay visible
    expect(facets.materials.map((m) => m.key)).toEqual(['gold', 'silver', 'wood']);
    expect(facets.price).toEqual({ min: 7, max: 40 });
  });

  it('pages results and clamps an out-of-range page', () => {
    const many = Array.from({ length: PAGE_SIZE + 3 }, (_, i) => make({ _id: `p${i}`, name: `Item ${i}` }));
    const last = runQuery(many, { ...DEFAULT_QUERY, page: 99 });
    expect(last.pages).toBe(2);
    expect(last.page).toBe(2);
    expect(last.items).toHaveLength(3);
  });
});

describe('runQuery extras', () => {
  const run = (over: Partial<typeof DEFAULT_QUERY>) => runQuery(PRODUCTS, { ...DEFAULT_QUERY, ...over });

  it('reports the range shown, for the "Showing 1–12 of 30" line', () => {
    expect(run({})).toMatchObject({ from: 1, to: 5, total: 5 });
    expect(run({ q: 'no such thing' })).toMatchObject({ from: 0, to: 0, total: 0 });
  });

  it('counts the rating and stock options with the other filters kept', () => {
    const { facets } = run({ category: 'rosaries' });
    expect(facets.ratings).toEqual([
      { min: 4, count: 1 },
      { min: 3, count: 1 },
      { min: 2, count: 1 },
      { min: 1, count: 1 },
    ]);
    expect(facets.inStock).toBe(2);
    expect(run({ inStock: true }).facets.inStock).toBe(4);
    expect(facets.allCategories).toBe(5);
  });

  it('sorts names naturally and ignores case', () => {
    const names = ['Cross 10', 'cross 2', 'Angel'].map((name, i) => make({ _id: String(i), name }));
    expect(runQuery(names, { ...DEFAULT_QUERY, sort: 'name' }).items.map((p) => p.name)).toEqual([
      'Angel',
      'cross 2',
      'Cross 10',
    ]);
  });

  it('sorts the newest first and keeps undated products last', () => {
    const dated = [
      make({ _id: 'a', name: 'A', createdAt: null }),
      make({ _id: 'b', name: 'B', createdAt: '2026-09-01' }),
      make({ _id: 'c', name: 'C', createdAt: '2026-10-01' }),
    ];
    expect(runQuery(dated, { ...DEFAULT_QUERY, sort: 'newest' }).items.map((p) => p._id)).toEqual(['c', 'b', 'a']);
  });
});

describe('filter chips', () => {
  const query = parseQuery({ q: 'olive', category: 'rosaries', material: 'gold,wood', max: '20', rating: '4', stock: '1', sort: 'name', page: '3' });

  it('lists one chip per active filter', () => {
    expect(filterChips(query)).toEqual([
      { kind: 'q', value: 'olive' },
      { kind: 'category', value: 'rosaries' },
      { kind: 'material', value: 'gold' },
      { kind: 'material', value: 'wood' },
      { kind: 'price', min: null, max: 20 },
      { kind: 'rating', value: 4 },
      { kind: 'stock' },
    ]);
    expect(filterChips(DEFAULT_QUERY)).toEqual([]);
  });

  it('removes exactly one filter and goes back to page 1', () => {
    const next = withoutChip(query, { kind: 'material', value: 'gold' });
    expect(next.materials).toEqual(['wood']);
    expect(next.page).toBe(1);
    expect(next.category).toBe('rosaries');
    expect(withoutChip(query, { kind: 'price', min: null, max: 20 })).toMatchObject({ min: null, max: null });
  });

  it('clears every filter but keeps the sort order', () => {
    expect(clearFilters(query)).toEqual({ ...DEFAULT_QUERY, sort: 'name' });
    expect(toSearch(clearFilters(query))).toBe('?sort=name');
    expect(toSearch(DEFAULT_QUERY)).toBe('');
  });

  it('ignores a repeated material', () => {
    expect(parseQuery({ material: ['gold', 'gold,wood'] }).materials).toEqual(['gold', 'wood']);
  });
});

describe('activeFilterCount / badgesFor', () => {
  it('counts active filters', () => {
    expect(activeFilterCount({ ...DEFAULT_QUERY, q: 'x', materials: ['gold', 'wood'], min: 5 })).toBe(4);
  });

  it('labels best sellers, new, low stock and sold out', () => {
    const now = Date.parse('2026-10-05');
    const fresh = make({ _id: 'n', name: 'New', createdAt: '2026-09-30', stock: 2 });
    expect(badgesFor(fresh, new Set(['n']), now)).toEqual(['bestseller', 'new', 'lowStock']);
    expect(badgesFor(PRODUCTS[2], new Set(), now)).toEqual(['soldOut']);
  });
});
