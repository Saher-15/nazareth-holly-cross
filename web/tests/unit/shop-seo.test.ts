import { describe, expect, it } from 'vitest';
import { productSchema } from '@/lib/api';
import { jsonLdHtml, localeAlternates, productAlternates, productJsonLd, shopJsonLd, summarize } from '@/components/shop/seo';

const product = productSchema.parse({
  _id: '66eb4665c7e03262956c8d1d',
  name: 'Olive oil',
  price: 10,
  img: 'https://firebasestorage.googleapis.com/a.jpg',
  additionalImageUrls: ['https://firebasestorage.googleapis.com/b.jpg'],
  description: 'The olive tree symbolizes peace.',
});

describe('productJsonLd', () => {
  it('describes the product with a USD offer and its canonical (English) page URL, in any language', () => {
    const ld = productJsonLd(product, 'he');
    expect(ld).toMatchObject({
      '@type': 'Product',
      name: 'Olive oil',
      sku: product._id,
      image: [product.img, product.additionalImageUrls[0]],
      url: expect.stringMatching(/\/en\/shop\/66eb4665c7e03262956c8d1d$/),
      offers: { price: '10.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    });
  });

  it('marks a product with no stock left as out of stock', () => {
    expect(productJsonLd({ ...product, stock: 0 }, 'en').offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('leaves out an empty description', () => {
    expect(productJsonLd({ ...product, description: '' }, 'en')).not.toHaveProperty('description');
  });

  it('adds aggregateRating and up to five reviews once the product has reviews', () => {
    const reviews = Array.from({ length: 7 }, (_, i) => ({
      name: `R${i}`,
      rating: 5 - (i % 2),
      title: i === 0 ? 'Lovely' : '',
      comment: `Comment ${i}`,
      createdAt: '2026-10-01T10:00:00.000Z',
    }));
    const ld: ReturnType<typeof productJsonLd> & { review?: Record<string, unknown>[] } = productJsonLd(product, 'en', {
      rating: { avg: 4.6, count: 7 },
      reviews,
    });
    expect(ld).toMatchObject({
      aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.6, reviewCount: 7, bestRating: 5 },
    });
    expect(ld.review).toHaveLength(5);
    expect(ld.review?.[0]).toMatchObject({
      '@type': 'Review',
      author: { '@type': 'Person', name: 'R0' },
      name: 'Lovely',
      reviewBody: 'Comment 0',
      datePublished: '2026-10-01',
      reviewRating: { ratingValue: 5 },
    });
    expect(ld.review?.[1]).not.toHaveProperty('name');
  });

  it('claims no rating for a product nobody reviewed', () => {
    const ld = productJsonLd(product, 'en', { rating: { avg: 0, count: 0 }, reviews: [] });
    expect(ld).not.toHaveProperty('aggregateRating');
    expect(ld).not.toHaveProperty('review');
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

describe('productAlternates', () => {
  it('names the English page as canonical and lists no language versions (the product text is English only)', () => {
    const alt = productAlternates('66eb4665c7e03262956c8d1d');
    expect(alt?.canonical).toBe('/en/shop/66eb4665c7e03262956c8d1d');
    expect(alt).not.toHaveProperty('languages');
  });

  it('the shop list links every product by its canonical page', () => {
    const ld = shopJsonLd([product], 'he', { title: 't', description: 'd' });
    expect(ld.mainEntity.itemListElement[0].url).toMatch(/\/en\/shop\/66eb4665c7e03262956c8d1d$/);
  });
});
