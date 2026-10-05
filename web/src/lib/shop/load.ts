import { cache } from 'react';
import { api, type CatalogProduct, type ProductReviews } from '@/lib/api';

// Server-side reads for the shop pages. Each one turns an API failure into null, so a
// page can show what it has (or a clear error) instead of crashing. The live API allows
// a limited number of requests per visitor, so pages share these reads: one catalogue
// request serves the shop, every product page, the wishlist and the sitemap.

const report = (what: string, error: unknown) => console.error(`[shop] could not load ${what}`, error);

/** Every product with category, materials, units sold and rating (cached by Next for two minutes). */
export const loadCatalog = cache(async (): Promise<{ products: CatalogProduct[] } | null> => {
  try {
    return await api.catalog();
  } catch (error) {
    report('the catalog', error);
    return null;
  }
});

export async function loadBestSellers(limit = 8): Promise<CatalogProduct[] | null> {
  try {
    return await api.bestSellers(limit);
  } catch (error) {
    report('the best sellers', error);
    return null;
  }
}

export async function loadSimilar(id: string, limit = 4): Promise<CatalogProduct[] | null> {
  try {
    return await api.similar(id, limit);
  } catch (error) {
    report(`products similar to ${id}`, error);
    return null;
  }
}

export const EMPTY_REVIEWS: ProductReviews = {
  summary: { avg: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
  reviews: [],
};

/**
 * A product's reviews. When the catalogue already says it has none, the request is
 * skipped (one request fewer per product page while most products have no reviews).
 */
export async function loadReviews(id: string, knownCount: number | null): Promise<ProductReviews | null> {
  if (knownCount === 0) return EMPTY_REVIEWS;
  try {
    return await api.productReviews(id);
  } catch (error) {
    report(`the reviews of ${id}`, error);
    return null;
  }
}
