import { describe, expect, it } from 'vitest';
import type { CatalogProduct } from '@/lib/api';
import {
  activeFilterCount,
  badgesFor,
  DEFAULT_QUERY,
  PAGE_SIZE,
  parseQuery,
  runQuery,
  toSearchParams,
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
    const url = 'q=rosary&category=rosaries&material=gold,wood&min=5&max=20&rating=4&stock=1&sort=price-asc&page=2';
    const q = parseQuery(new URLSearchParams(url));
    expect(q).toEqual({
      q: 'rosary',
      category: 'rosaries',
      materials: ['gold', 'wood'],
      min: 5,
      max: 20,
      rating: 4,
      inStock: true,
      sort: 'price-asc',
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
    expect(run({ sort: 'price-desc' }).items[0]._id).toBe('3');
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
