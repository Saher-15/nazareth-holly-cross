import Product from '../model/product.js';
import Order from '../model/order.js';
import ProductReview from '../model/productReview.js';

// The shop "catalog": every product enriched with what the storefront needs to filter,
// rank and recommend — category, materials, units sold and star rating.

// Ordered rules: the first match wins ("Bracelet with silver cross" is a bracelet, not a cross).
const CATEGORY_RULES = [
  ['stained-glass', /vitrage|stained glass|\bglass\b/i],
  ['rosaries', /rosary/i],
  ['necklaces', /necklace/i],
  ['bracelets', /bracelet/i],
  ['bibles', /bible/i],
  ['crosses', /cross/i],
  ['holy-land', /olive|oil|wine|incense|soil|water|puzzle/i],
];
export const CATEGORIES = [...CATEGORY_RULES.map(([key]) => key), 'gifts'];

const MATERIAL_RULES = [
  ['gold', /gold/i],
  ['silver', /silver/i],
  ['wood', /wood/i],
  ['glass', /vitrage|glass|crystal|chrystal/i],
];
export const MATERIALS = MATERIAL_RULES.map(([key]) => key);

// A category stored on the product wins; otherwise it is inferred from the name.
export function categorize(product) {
  if (product.category && CATEGORIES.includes(product.category)) return product.category;
  const name = product.name || '';
  const match = CATEGORY_RULES.find(([, re]) => re.test(name));
  return match ? match[0] : 'gifts';
}

export function materialsOf(product) {
  const name = product.name || '';
  return MATERIAL_RULES.filter(([, re]) => re.test(name)).map(([key]) => key);
}

const round1 = (n) => Math.round(n * 10) / 10;

async function soldByProduct() {
  const rows = await Order.aggregate([
    { $unwind: '$products' },
    { $group: { _id: '$products.productID', sold: { $sum: '$products.quantity' } } },
  ]);
  return new Map(rows.filter((r) => r._id).map((r) => [String(r._id), r.sold]));
}

async function ratingsByProduct() {
  const rows = await ProductReview.aggregate([
    { $match: { approved: true } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { avg: round1(r.avg), count: r.count }]));
}

const CACHE_MS = 5 * 60 * 1000;
let cache = null; // { at, products }

export function invalidateCatalog() {
  cache = null;
}

export async function getCatalog() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.products;

  const [products, sold, ratings] = await Promise.all([
    Product.find().lean(),
    soldByProduct(),
    ratingsByProduct(),
  ]);

  const enriched = products.map((p) => {
    const id = String(p._id);
    return {
      _id: id,
      name: p.name,
      price: p.price,
      img: p.img,
      additionalImageUrls: p.additionalImageUrls || [],
      description: p.description || '',
      color: p.color || [],
      stock: p.stock ?? null,
      createdAt: p.createdAt || null,
      category: categorize(p),
      materials: materialsOf(p),
      featured: p.rate || 0, // the admin's manual "rate" field: a featuring weight, not stars
      sold: sold.get(id) || 0,
      rating: ratings.get(id) || { avg: 0, count: 0 },
    };
  });

  cache = { at: Date.now(), products: enriched };
  return enriched;
}

export function categoryCounts(products) {
  return CATEGORIES.map((key) => ({ key, count: products.filter((p) => p.category === key).length })).filter(
    (c) => c.count > 0,
  );
}

// Most units sold first; ties broken by reviews, then by the admin's featuring weight.
export function rankBestSellers(products, limit = 8) {
  return [...products]
    .sort(
      (a, b) =>
        b.sold - a.sold ||
        b.rating.count * b.rating.avg - a.rating.count * a.rating.avg ||
        b.featured - a.featured ||
        a.price - b.price,
    )
    .slice(0, limit);
}

// Same category matters most, then shared materials and a similar price. Exact name twins
// (the catalogue has a few duplicates) are pushed down so the suggestions stay varied.
export function rankSimilar(products, target, limit = 4) {
  const maxPrice = Math.max(...products.map((p) => p.price), 1);
  return products
    .filter((p) => p._id !== target._id)
    .map((p) => {
      let score = 0;
      if (p.category === target.category) score += 3;
      score += p.materials.filter((m) => target.materials.includes(m)).length;
      score += 1 - Math.abs(p.price - target.price) / maxPrice;
      if (p.name.trim().toLowerCase() === target.name.trim().toLowerCase()) score -= 2;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score || b.p.sold - a.p.sold)
    .slice(0, limit)
    .map(({ p }) => p);
}
