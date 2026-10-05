import { describe, expect, it } from 'vitest';
import { imageForVariant, isCssColour, isInStock, isProductId, maxAddable, variantKind } from '@/components/shop/catalog';

// Search, sorting and paging are tested with the query system in shop-query.test.ts.

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
