// Product documents store the main photo in `img` and extras in
// `additionalImageUrls`. Older stored URLs contain "&amp;" (HTML-escaped).
const clean = (u) => (typeof u === 'string' ? u.replace(/&amp;/g, '&') : u);

export function getProductImages(product) {
  if (!product) return [];
  const list = [product.img, ...(product.additionalImageUrls || []), ...(product.images || [])]
    .filter(Boolean)
    .map(clean);
  return [...new Set(list)];
}
