import { describe, expect, it } from 'vitest';
import type { CatalogProduct } from '@/lib/api';
import { rankSimilar } from '@/lib/shop/similar';

type P = Pick<CatalogProduct, '_id' | 'name' | 'price' | 'category' | 'materials' | 'sold'>;
const p = (over: Partial<P> & { _id: string }): P => ({
  name: over._id,
  price: 10,
  category: 'gifts',
  materials: [],
  sold: 0,
  ...over,
});

describe('rankSimilar (same rule as the API)', () => {
  const target = p({ _id: 't', name: 'Golden rosary', category: 'rosaries', materials: ['gold'], price: 15 });

  it('puts the same category first, then shared materials and a close price', () => {
    const products = [
      target,
      p({ _id: 'other-cat-gold', category: 'necklaces', materials: ['gold'], price: 15 }),
      p({ _id: 'rosary-wood', category: 'rosaries', materials: ['wood'], price: 7 }),
      p({ _id: 'rosary-gold', category: 'rosaries', materials: ['gold'], price: 15 }),
      p({ _id: 'far', category: 'stained-glass', price: 65 }),
    ];
    expect(rankSimilar(products, target).map((x) => x._id)).toEqual(['rosary-gold', 'rosary-wood', 'other-cat-gold', 'far']);
  });

  it('never suggests the product itself and pushes exact name twins down', () => {
    const products = [
      target,
      p({ _id: 'twin', name: ' golden ROSARY ', category: 'rosaries', materials: ['gold'], price: 15 }),
      p({ _id: 'cousin', name: 'Silver rosary', category: 'rosaries', price: 15 }),
    ];
    const ids = rankSimilar(products, target).map((x) => x._id);
    expect(ids).not.toContain('t');
    expect(ids).toEqual(['cousin', 'twin']);
  });

  it('breaks ties by units sold and honours the limit', () => {
    const products = [target, ...['a', 'b', 'c', 'd', 'e'].map((id, i) => p({ _id: id, category: 'rosaries', price: 15, sold: i }))];
    expect(rankSimilar(products, target, 3).map((x) => x._id)).toEqual(['e', 'd', 'c']);
  });
});
