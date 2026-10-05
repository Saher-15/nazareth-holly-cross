import type { CatalogProduct } from '@/lib/api';

/**
 * "You may also like": the same ranking as the API's GET /product/:id/similar
 * (server/services/catalog.js rankSimilar), run on the catalogue the page already has.
 * The API allows a limited number of requests per visitor, and the site's own server is
 * one visitor; asking the API once per product page on every refresh would use most of
 * that allowance, so the API endpoint is only the fallback when the catalogue is missing.
 *
 * Same category matters most, then shared materials and a similar price. Exact name twins
 * (the catalogue has a few duplicates) are pushed down so the suggestions stay varied.
 */
export function rankSimilar<T extends Pick<CatalogProduct, '_id' | 'name' | 'price' | 'category' | 'materials' | 'sold'>>(
  products: T[],
  target: Pick<CatalogProduct, '_id' | 'name' | 'price' | 'category' | 'materials'>,
  limit = 4,
): T[] {
  const maxPrice = Math.max(...products.map((p) => p.price), 1);
  const name = target.name.trim().toLowerCase();
  return products
    .filter((p) => p._id !== target._id)
    .map((p) => {
      let score = 0;
      if (p.category === target.category) score += 3;
      score += p.materials.filter((m) => target.materials.includes(m)).length;
      score += 1 - Math.abs(p.price - target.price) / maxPrice;
      if (p.name.trim().toLowerCase() === name) score -= 2;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score || b.p.sold - a.p.sold)
    .slice(0, limit)
    .map(({ p }) => p);
}
