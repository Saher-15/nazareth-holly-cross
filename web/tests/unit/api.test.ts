import { describe, expect, it } from 'vitest';
import { catalogProductSchema, productSchema } from '@/lib/api';

describe('productSchema', () => {
  const raw = {
    _id: '66eb4665c7e03262956c8d1d',
    name: 'Olive oil',
    price: 10,
    img: 'https://firebasestorage.googleapis.com/v0/b/x/o/a?alt=media&amp;token=abc',
    additionalImageUrls: ['https://firebasestorage.googleapis.com/v0/b/x/o/b?alt=media&amp;token=def'],
  };

  it('repairs HTML-escaped image URLs stored by the old sanitiser', () => {
    const product = productSchema.parse(raw);
    expect(product.img).toBe('https://firebasestorage.googleapis.com/v0/b/x/o/a?alt=media&token=abc');
    expect(product.additionalImageUrls[0]).not.toContain('&amp;');
  });

  it('fills optional fields with safe defaults', () => {
    const product = productSchema.parse({ ...raw, additionalImageUrls: undefined });
    expect(product.additionalImageUrls).toEqual([]);
    expect(product.color).toEqual([]);
    expect(product.stock).toBeNull();
  });

  it('rejects a product without a price', () => {
    expect(() => productSchema.parse({ ...raw, price: undefined })).toThrow();
  });
});

describe('null-tolerant schemas (live records hold null in optional fields)', () => {
  const raw = { _id: 'x', name: 'Rosary', price: 15, img: 'https://a/b' };

  it('accepts null colour, images, description and stock', () => {
    const p = productSchema.parse({ ...raw, color: null, additionalImageUrls: null, description: null, stock: null });
    expect(p).toMatchObject({ color: [], additionalImageUrls: [], description: '', stock: null });
  });

  it('normalises catalog fields and maps unknown categories to gifts', () => {
    const p = catalogProductSchema.parse({ ...raw, category: 'spaceships', materials: ['gold', 'plastic'], rating: null });
    expect(p.category).toBe('gifts');
    expect(p.materials).toEqual(['gold']);
    expect(p.rating).toEqual({ avg: 0, count: 0 });
  });
});
