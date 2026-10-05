import { cache } from 'react';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { api, ApiError, type CatalogProduct, type ProductReviews } from '@/lib/api';

// Server-side reads for the shop pages. The live API allows a limited number of requests
// per visitor (the site's own server is one visitor), so pages share these reads: one
// catalogue request serves the shop, every product page, the wishlist and the sitemap.
//
// What happens when a read fails:
// - while `next build` prerenders, the page is built with a clear error state (and is
//   rebuilt on a later visit) instead of failing the whole build;
// - when a cached page is refreshed later (ISR), the error is thrown on purpose: Next then
//   keeps serving the last good page and tries again on the next visit, so a short API
//   outage or rate limit never replaces a working shop with an error page;
// - optional extras (best sellers, similar products) just disappear.

const report = (what: string, error: unknown) => console.error(`[shop] could not load ${what}`, error);
const building = () => process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;

/** Logs a failed read; rethrows it outside the build (see above). */
function failed(what: string, error: unknown) {
  report(what, error);
  if (!building()) throw error;
}

type CatalogResult = { ok: true; data: { products: CatalogProduct[] } } | { ok: false; status: number };

/** The catalogue read, keeping the failure's status (429 = the API's request allowance is used up). */
export const loadCatalogResult = cache(async (): Promise<CatalogResult> => {
  try {
    return { ok: true, data: await api.catalog() };
  } catch (error) {
    failed('the catalog', error);
    return { ok: false, status: error instanceof ApiError ? error.status : 0 };
  }
});

/** Every product with category, materials, units sold and rating (cached by Next for two minutes). */
export const loadCatalog = cache(async (): Promise<{ products: CatalogProduct[] } | null> => {
  const result = await loadCatalogResult();
  return result.ok ? result.data : null;
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
    failed(`the reviews of ${id}`, error);
    return null;
  }
}
