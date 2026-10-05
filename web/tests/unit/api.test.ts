import { describe, expect, it } from 'vitest';
import { productSchema } from '@/lib/api';

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
