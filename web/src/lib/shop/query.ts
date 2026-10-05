import { CATEGORIES, MATERIALS, type CatalogProduct, type Category, type Material } from '@/lib/api';

// Shop filtering, sorting and paging as pure functions, so the URL is the single source of
// truth (/shop?category=rosaries&material=gold&sort=bestselling) and every view is shareable.

export const SORTS = ['featured', 'bestselling', 'rating', 'newest', 'priceAsc', 'priceDesc', 'name'] as const;
export type Sort = (typeof SORTS)[number];

export const PAGE_SIZE = 12;

/** Minimum-star options offered by the rating filter. */
export const RATING_STEPS = [4, 3, 2, 1] as const;

export type ShopQuery = {
  q: string;
  category: Category | null;
  materials: Material[];
  min: number | null;
  max: number | null;
  rating: number | null; // minimum stars, 1-5
  inStock: boolean;
  sort: Sort;
  page: number;
};

/** What the query needs from a product; the full CatalogProduct and the shop's slimmer items both fit. */
export type QueryProduct = Pick<
  CatalogProduct,
  '_id' | 'name' | 'description' | 'price' | 'stock' | 'category' | 'materials' | 'featured' | 'sold' | 'rating' | 'createdAt'
>;

export const DEFAULT_QUERY: ShopQuery = {
  q: '',
  category: null,
  materials: [],
  min: null,
  max: null,
  rating: null,
  inStock: false,
  sort: 'featured',
  page: 1,
};

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

const read = (params: Params, key: string): string[] => {
  if (params instanceof URLSearchParams) return params.getAll(key);
  const v = params[key];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
};

const positiveNumber = (value: string | undefined) => {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

export function parseQuery(params: Params): ShopQuery {
  const one = (key: string) => read(params, key)[0];
  const category = one('category');
  const sort = one('sort');
  const rating = Number(one('rating'));
  const page = Number(one('page'));
  let min = positiveNumber(one('min'));
  let max = positiveNumber(one('max'));
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return {
    q: (one('q') ?? '').slice(0, 80),
    category: (CATEGORIES as readonly string[]).includes(category ?? '') ? (category as Category) : null,
    materials: [
      ...new Set(
        read(params, 'material')
          .flatMap((m) => m.split(','))
          .filter((m): m is Material => (MATERIALS as readonly string[]).includes(m)),
      ),
    ],
    min,
    max,
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    inStock: one('stock') === '1',
    sort: (SORTS as readonly string[]).includes(sort ?? '') ? (sort as Sort) : 'featured',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

// Only non-default values go into the URL, in a stable order.
export function toSearchParams(query: Partial<ShopQuery>): URLSearchParams {
  const q = { ...DEFAULT_QUERY, ...query };
  const out = new URLSearchParams();
  if (q.q.trim()) out.set('q', q.q.trim());
  if (q.category) out.set('category', q.category);
  if (q.materials.length) out.set('material', [...q.materials].sort().join(','));
  if (q.min !== null) out.set('min', String(q.min));
  if (q.max !== null) out.set('max', String(q.max));
  if (q.rating !== null) out.set('rating', String(q.rating));
  if (q.inStock) out.set('stock', '1');
  if (q.sort !== 'featured') out.set('sort', q.sort);
  if (q.page > 1) out.set('page', String(q.page));
  return out;
}

/** "?category=rosaries&sort=name", or "" for the default view. */
export function toSearch(query: Partial<ShopQuery>) {
  const s = toSearchParams(query).toString();
  return s ? `?${s}` : '';
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

export function matchesSearch(product: QueryProduct, q: string) {
  const tokens = normalize(q).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = normalize(`${product.name} ${product.description} ${product.category} ${product.materials.join(' ')}`);
  return tokens.every((t) => haystack.includes(t));
}

export const inStock = (p: Pick<QueryProduct, 'stock'>) => p.stock === null || p.stock > 0;

type Facet = 'category' | 'materials' | 'price' | 'rating' | 'stock' | 'q';

// Applies every filter except the ones named in `skip` (used for facet counts).
function filter<T extends QueryProduct>(products: T[], q: ShopQuery, skip: Facet[] = []) {
  return products.filter(
    (p) =>
      (skip.includes('q') || matchesSearch(p, q.q)) &&
      (skip.includes('category') || !q.category || p.category === q.category) &&
      (skip.includes('materials') || !q.materials.length || q.materials.some((m) => p.materials.includes(m))) &&
      (skip.includes('price') || ((q.min === null || p.price >= q.min) && (q.max === null || p.price <= q.max))) &&
      (skip.includes('rating') || q.rating === null || p.rating.avg >= q.rating) &&
      (skip.includes('stock') || !q.inStock || inStock(p)),
  );
}

const collators = new Map<string, Intl.Collator>();
const collatorFor = (locale: string) => {
  let c = collators.get(locale);
  if (!c) {
    c = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
    collators.set(locale, c);
  }
  return c;
};

export function sortProducts<T extends QueryProduct>(products: T[], sort: Sort, locale = 'en'): T[] {
  const collator = collatorFor(locale);
  const byName = (a: T, b: T) => collator.compare(a.name, b.name);
  const list = [...products];
  switch (sort) {
    case 'bestselling':
      return list.sort((a, b) => b.sold - a.sold || b.featured - a.featured || byName(a, b));
    case 'rating':
      return list.sort((a, b) => b.rating.avg - a.rating.avg || b.rating.count - a.rating.count || byName(a, b));
    case 'newest':
      return list.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || byName(a, b));
    case 'priceAsc':
      return list.sort((a, b) => a.price - b.price || byName(a, b));
    case 'priceDesc':
      return list.sort((a, b) => b.price - a.price || byName(a, b));
    case 'name':
      return list.sort(byName);
    case 'featured':
    default:
      // The admin's featuring weight, then what sells, then reviews.
      return list.sort(
        (a, b) => b.featured - a.featured || b.sold - a.sold || b.rating.count - a.rating.count || byName(a, b),
      );
  }
}

export function runQuery<T extends QueryProduct>(products: T[], query: ShopQuery, locale = 'en') {
  const matching = sortProducts(filter(products, query), query.sort, locale);
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(query.page, pages);
  const items = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = items.length ? (page - 1) * PAGE_SIZE + 1 : 0;

  // Facet counts: how many results each option would give with the other filters kept.
  const forCategory = filter(products, query, ['category']);
  const forMaterial = filter(products, query, ['materials']);
  const forRating = filter(products, query, ['rating']);
  const forStock = filter(products, query, ['stock']);
  const prices = products.map((p) => p.price);

  return {
    items,
    total: matching.length,
    page,
    pages,
    from,
    to: from ? from + items.length - 1 : 0,
    facets: {
      categories: CATEGORIES.map((key) => ({ key, count: forCategory.filter((p) => p.category === key).length })).filter(
        (c) => c.count > 0,
      ),
      materials: MATERIALS.map((key) => ({ key, count: forMaterial.filter((p) => p.materials.includes(key)).length })).filter(
        (m) => m.count > 0,
      ),
      price: { min: prices.length ? Math.floor(Math.min(...prices)) : 0, max: prices.length ? Math.ceil(Math.max(...prices)) : 0 },
      ratings: RATING_STEPS.map((min) => ({ min, count: forRating.filter((p) => p.rating.avg >= min).length })),
      inStock: forStock.filter(inStock).length,
      allCategories: forCategory.length,
    },
  };
}

export function activeFilterCount(q: ShopQuery) {
  return (
    (q.q ? 1 : 0) +
    (q.category ? 1 : 0) +
    q.materials.length +
    (q.min !== null || q.max !== null ? 1 : 0) +
    (q.rating !== null ? 1 : 0) +
    (q.inStock ? 1 : 0)
  );
}

/** One removable chip per active filter, in the order the filter panel shows them. */
export type FilterChip =
  | { kind: 'q'; value: string }
  | { kind: 'category'; value: Category }
  | { kind: 'material'; value: Material }
  | { kind: 'price'; min: number | null; max: number | null }
  | { kind: 'rating'; value: number }
  | { kind: 'stock' };

export function filterChips(q: ShopQuery): FilterChip[] {
  const chips: FilterChip[] = [];
  if (q.q.trim()) chips.push({ kind: 'q', value: q.q.trim() });
  if (q.category) chips.push({ kind: 'category', value: q.category });
  q.materials.forEach((value) => chips.push({ kind: 'material', value }));
  if (q.min !== null || q.max !== null) chips.push({ kind: 'price', min: q.min, max: q.max });
  if (q.rating !== null) chips.push({ kind: 'rating', value: q.rating });
  if (q.inStock) chips.push({ kind: 'stock' });
  return chips;
}

/** The query with one chip's filter taken away (back to page 1). */
export function withoutChip(q: ShopQuery, chip: FilterChip): ShopQuery {
  const next = { ...q, page: 1 };
  switch (chip.kind) {
    case 'q':
      return { ...next, q: '' };
    case 'category':
      return { ...next, category: null };
    case 'material':
      return { ...next, materials: q.materials.filter((m) => m !== chip.value) };
    case 'price':
      return { ...next, min: null, max: null };
    case 'rating':
      return { ...next, rating: null };
    case 'stock':
      return { ...next, inStock: false };
  }
}

/** Every filter cleared; the sort order is kept because it is not a filter. */
export const clearFilters = (q: ShopQuery): ShopQuery => ({ ...DEFAULT_QUERY, sort: q.sort });

// Badges shown on product cards.
export type Badge = 'bestseller' | 'new' | 'lowStock' | 'soldOut';
const NEW_DAYS = 45;
export const LOW_STOCK = 5;
export function badgesFor(
  product: Pick<QueryProduct, '_id' | 'createdAt' | 'stock'>,
  bestSellerIds: Set<string>,
  now = Date.now(),
) {
  const badges: Badge[] = [];
  if (bestSellerIds.has(product._id)) badges.push('bestseller');
  if (product.createdAt && now - Date.parse(product.createdAt) < NEW_DAYS * 86_400_000) badges.push('new');
  if (product.stock !== null && product.stock <= 0) badges.push('soldOut');
  else if (product.stock !== null && product.stock <= LOW_STOCK) badges.push('lowStock');
  return badges;
}
