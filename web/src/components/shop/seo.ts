import type { Metadata } from 'next';
import type { Product, ProductReview } from '@/lib/api';
import { locales } from '@/i18n/routing';
import { SITE_URL } from '@/lib/config';
import { isInStock } from './catalog';

// Metadata and structured data shared by the shop, product and cart pages.

const BRAND = 'Nazareth Holy Cross';

/** Canonical URL plus every language version of a page (hreflang). */
export function localeAlternates(locale: string, path: string): Metadata['alternates'] {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, `/${l}${path}`])),
      'x-default': `/en${path}`,
    },
  };
}

export const absoluteUrl = (locale: string, path: string) => `${SITE_URL}/${locale}${path}`;

/** Shortens text for a meta description without cutting a word in half. */
export function summarize(text: string, max = 160) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max / 2)).trimEnd()}…`;
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so data cannot close the tag. */
export const jsonLdHtml = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

export const MAX_LD_REVIEWS = 5;

type LdReviews = {
  rating: { avg: number; count: number };
  reviews?: Pick<ProductReview, 'name' | 'rating' | 'title' | 'comment' | 'createdAt'>[];
};

/** aggregateRating and the newest reviews, only for a product that has been reviewed. */
function reviewsJsonLd(data: LdReviews | undefined) {
  if (!data || data.rating.count <= 0) return {};
  const reviews = (data.reviews ?? []).slice(0, MAX_LD_REVIEWS);
  return {
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: data.rating.avg,
      reviewCount: data.rating.count,
      bestRating: 5,
      worstRating: 1,
    },
    ...(reviews.length
      ? {
          review: reviews.map((r) => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: r.name },
            ...(r.createdAt ? { datePublished: r.createdAt.slice(0, 10) } : {}),
            ...(r.title ? { name: r.title } : {}),
            reviewBody: r.comment,
            reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
          })),
        }
      : {}),
  };
}

export function productJsonLd(
  product: Pick<Product, '_id' | 'name' | 'description' | 'img' | 'additionalImageUrls' | 'price' | 'stock'>,
  locale: string,
  reviews?: LdReviews,
) {
  const url = absoluteUrl(locale, `/shop/${product._id}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    image: [product.img, ...product.additionalImageUrls],
    sku: product._id,
    url,
    brand: { '@type': 'Brand', name: BRAND },
    ...reviewsJsonLd(reviews),
    offers: {
      '@type': 'Offer',
      url,
      price: product.price.toFixed(2),
      priceCurrency: 'USD',
      availability: isInStock(product.stock) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: BRAND, url: SITE_URL },
    },
  };
}

export function shopJsonLd(
  products: { _id: string; name: string }[],
  locale: string,
  page: { title: string; description: string },
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: page.title,
    description: page.description,
    url: absoluteUrl(locale, '/shop'),
    inLanguage: locale,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: absoluteUrl(locale, `/shop/${p._id}`),
        name: p.name,
      })),
    },
  };
}
