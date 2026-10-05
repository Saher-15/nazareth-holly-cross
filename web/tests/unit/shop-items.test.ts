import { describe, expect, it } from 'vitest';
import type { CatalogProduct } from '@/lib/api';
import { bestSellerIds, cardItems, pickStrip, resolveIds, shopItems, toCardItem } from '@/lib/shop/items';

const make = (over: Partial<CatalogProduct> & { _id: string; name: string }): CatalogProduct => ({
  price: 10,
  img: 'https://firebasestorage.googleapis.com/x.jpg',
  additionalImageUrls: ['https://firebasestorage.googleapis.com/y.jpg'],
  description: 'A souvenir',
  color: [],
  stock: null,
  category: 'gifts',
  materials: [],
  featured: 1,
  sold: 0,
  rating: { avg: 0, count: 0 },
  createdAt: null,
  ...over,
});

describe('bestSellerIds', () => {
  it('takes the top sellers, and only products that sold', () => {
    const products = Array.from({ length: 10 }, (_, i) => make({ _id: `p${i}`, name: `P${i}`, sold: i }));
    const ids = bestSellerIds(products);
    expect(ids.size).toBe(8);
    expect(ids.has('p9')).toBe(true);
    expect(ids.has('p0')).toBe(false); // sold nothing
    expect(bestSellerIds([make({ _id: 'a', name: 'A' })]).size).toBe(0);
  });
});

describe('card and shop items', () => {
  it('formats the price on the server and counts the variants', () => {
    const card = toCardItem(make({ _id: 'a', name: 'Fish', price: 50, color: ['red', 'blue'] }), {
      locale: 'en',
      bestSellers: new Set(),
    });
    expect(card).toMatchObject({ priceLabel: '$50.00', variants: 2, badges: [] });
    expect(card).not.toHaveProperty('description');
    expect(card).not.toHaveProperty('additionalImageUrls');
  });

  it('adds the badges, and a best-seller badge only for real sales', () => {
    const now = Date.parse('2026-10-05');
    const products = [
      make({ _id: 'a', name: 'A', sold: 3, stock: 2 }),
      make({ _id: 'b', name: 'B', createdAt: '2026-10-01', stock: 0 }),
    ];
    const [a, b] = cardItems(products, 'he', now);
    expect(a.badges).toEqual(['bestseller', 'lowStock']);
    expect(b.badges).toEqual(['new', 'soldOut']);
  });

  it('keeps what search and filters need for the shop grid', () => {
    const [item] = shopItems([make({ _id: 'a', name: 'A', materials: ['gold'], featured: 4 })], 'en');
    expect(item).toMatchObject({ description: 'A souvenir', materials: ['gold'], featured: 4, sold: 0 });
  });
});

describe('pickStrip', () => {
  const products = [
    make({ _id: 'a', name: 'A', featured: 1 }),
    make({ _id: 'b', name: 'B', featured: 9 }),
    make({ _id: 'c', name: 'C', featured: 5 }),
  ];

  it('shows the favourites in the featured order when nothing sold (no sales claim)', () => {
    expect(pickStrip(products, products)).toEqual({ kind: 'favourites', ids: ['b', 'c', 'a'] });
    expect(pickStrip(products, null)).toEqual({ kind: 'favourites', ids: ['b', 'c', 'a'] });
  });

  it('shows best sellers in the API order, only those that sold and still exist', () => {
    const sold = [
      { _id: 'c', sold: 7 },
      { _id: 'gone', sold: 5 },
      { _id: 'a', sold: 2 },
      { _id: 'b', sold: 0 },
    ];
    expect(pickStrip(products, sold)).toEqual({ kind: 'bestsellers', ids: ['c', 'a'] });
  });

  it('ranks by units sold itself when the best-seller request failed', () => {
    const withSales = products.map((p) => (p._id === 'a' ? { ...p, sold: 4 } : p));
    expect(pickStrip(withSales, null)).toEqual({ kind: 'bestsellers', ids: ['a'] });
  });
});

describe('resolveIds', () => {
  it('keeps the order of the ids and skips unknown ones', () => {
    const items = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }];
    expect(resolveIds(['c', 'x', 'a'], items)).toEqual([{ _id: 'c' }, { _id: 'a' }]);
  });
});
