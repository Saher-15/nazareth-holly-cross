import { describe, expect, it } from 'vitest';
import { productSchema } from '@/lib/api';
import { jsonLdHtml, localeAlternates, productJsonLd, shopJsonLd, summarize } from '@/components/shop/seo';

const product = productSchema.parse({
  _id: '66eb4665c7e03262956c8d1d',
  name: 'Olive oil',
  price: 10,
  img: 'https://firebasestorage.googleapis.com/a.jpg',
  additionalImageUrls: ['https://firebasestorage.googleapis.com/b.jpg'],
  description: 'The olive tree symbolizes peace.',
});

describe('productJsonLd', () => {
  it('describes the product with a USD offer and its page URL', () => {
    const ld = productJsonLd(product, 'he');
    expect(ld).toMatchObject({
      '@type': 'Product',
      name: 'Olive oil',
      sku: product._id,
      image: [product.img, product.additionalImageUrls[0]],
      url: expect.stringMatching(/\/he\/shop\/66eb4665c7e03262956c8d1d$/),
      offers: { price: '10.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    });
  });

  it('marks a product with no stock left as out of stock', () => {
    expect(productJsonLd({ ...product, stock: 0 }, 'en').offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('leaves out an empty description', () => {
    expect(productJsonLd({ ...product, description: '' }, 'en')).not.toHaveProperty('description');
  });
});

describe('shopJsonLd', () => {
  it('lists every product in order', () => {
    const ld = shopJsonLd([product, { ...product, _id: 'x', name: 'Rosary' }], 'en', { title: 't', description: 'd' });
    expect(ld.mainEntity.numberOfItems).toBe(2);
    expect(ld.mainEntity.itemListElement[1]).toMatchObject({ position: 2, name: 'Rosary' });
  });
});

describe('jsonLdHtml', () => {
  it('cannot close the surrounding script tag', () => {
    const html = jsonLdHtml({ name: '</script><script>alert(1)</script>' });
    expect(html).not.toContain('<');
    expect(JSON.parse(html).name).toBe('</script><script>alert(1)</script>');
  });
});

describe('summarize', () => {
  it('keeps short text and squeezes whitespace', () => {
    expect(summarize('  Olive \n oil ')).toBe('Olive oil');
  });

  it('shortens long text on a word boundary', () => {
    const text = 'word '.repeat(60);
    const short = summarize(text, 40);
    expect(short.length).toBeLessThanOrEqual(40);
    expect(short.endsWith('word…')).toBe(true);
  });
});

describe('localeAlternates', () => {
  it('points the canonical URL at the page and lists every language', () => {
    const alt = localeAlternates('fr', '/shop');
    expect(alt?.canonical).toBe('/fr/shop');
    expect(alt?.languages).toMatchObject({ he: '/he/shop', ar: '/ar/shop', 'x-default': '/en/shop' });
  });
});
