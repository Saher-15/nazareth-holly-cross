// Pure helpers for the shop: search, sort, pagination, URL state, product variants
// and stock. No React and no imports, so server and client code can both use it
// and every rule is unit-tested in tests/unit/shop-catalog.test.ts.

export const SORT_KEYS = ['rating', 'name', 'priceAsc', 'priceDesc'] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const DEFAULT_SORT: SortKey = 'rating';
export const PAGE_SIZE = 12; // fills 2, 3 and 4 columns without a ragged last row

/** What the shop grid needs from a product (the price is formatted on the server). */
export type ShopItem = {
  _id: string;
  name: string;
  description: string;
  price: number;
  priceLabel: string;
  img: string;
  rate: number;
};

export type BrowseState = { query: string; sort: SortKey; page: number };
export const DEFAULT_BROWSE: BrowseState = { query: '', sort: DEFAULT_SORT, page: 1 };

// Lower-case and drop accents, so "creche" finds "Crèche".
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase();

/** Every word of the query must appear in the product's name or description. */
export function filterProducts<T extends { name: string; description?: string }>(items: T[], query: string): T[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((item) => {
    const haystack = normalize(`${item.name} ${item.description ?? ''}`);
    return words.every((word) => haystack.includes(word));
  });
}

export function sortProducts<T extends { name: string; price: number; rate: number }>(
  items: T[],
  sort: SortKey,
  locale = 'en',
): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const byName = (a: T, b: T) => collator.compare(a.name, b.name);
  const copy = [...items];
  switch (sort) {
    case 'name':
      return copy.sort(byName);
    case 'priceAsc':
      return copy.sort((a, b) => a.price - b.price || byName(a, b));
    case 'priceDesc':
      return copy.sort((a, b) => b.price - a.price || byName(a, b));
    default:
      // Highest rated first; the sort is stable, so ties keep the API's order.
      return copy.sort((a, b) => b.rate - a.rate);
  }
}

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (current - 1) * size;
  const pageItems = items.slice(start, start + size);
  return {
    items: pageItems,
    page: current,
    totalPages,
    total: items.length,
    from: pageItems.length ? start + 1 : 0,
    to: start + pageItems.length,
  };
}

/** Search, then sort, then cut out one page. */
export function browse<T extends { name: string; description?: string; price: number; rate: number }>(
  items: T[],
  state: BrowseState,
  locale = 'en',
) {
  return paginate(sortProducts(filterProducts(items, state.query), state.sort, locale), state.page);
}

const isSortKey = (value: string | null): value is SortKey => SORT_KEYS.includes(value as SortKey);

/** Reads ?q=&sort=&page= from the URL; anything unknown falls back to the default. */
export function parseBrowseState(search: string): BrowseState {
  const params = new URLSearchParams(search);
  const sort = params.get('sort');
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    query: (params.get('q') ?? '').slice(0, 100),
    sort: isSortKey(sort) ? sort : DEFAULT_SORT,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** The query string for a state, leaving out defaults so the plain /shop URL stays clean. */
export function browseStateToSearch(state: BrowseState): string {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set('q', state.query);
  if (state.sort !== DEFAULT_SORT) params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  const search = params.toString();
  return search ? `?${search}` : '';
}

// ---- product variants ----

const HEX = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const COLOUR_FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;
const NAMED = /^[a-z]{3,20}$/i; // CSS named colours are plain words ("tomato", "dodgerblue")

export const isCssColour = (value: string) => {
  const v = value.trim();
  return HEX.test(v) || COLOUR_FUNCTION.test(v) || NAMED.test(v);
};

/**
 * A product's `color` list holds real colours ("tomato", "#194696") for most items,
 * but numbered designs ("1", "2" …) for the puzzle. Colours get swatches, designs get labels.
 */
export function variantKind(values: string[]): 'colour' | 'design' | null {
  if (!values.length) return null;
  return values.every(isCssColour) ? 'colour' : 'design';
}

/** The photo that shows a variant: additional image N belongs to variant N. */
export const imageForVariant = (product: { img: string; additionalImageUrls: string[] }, index: number | null) =>
  index === null ? product.img : (product.additionalImageUrls[index] ?? product.img);

// ---- stock ----

/** `stock` is null when the shop does not track it; that counts as available. */
export const isInStock = (stock: number | null) => stock === null || stock > 0;

/**
 * How many more of a product can go into the cart, given what is already there.
 * `lineLimit` is the cart's per-line cap (MAX_LINE_QUANTITY in lib/cart).
 */
export function maxAddable(stock: number | null, inCart: number, lineLimit: number) {
  const limit = stock === null ? lineLimit : Math.min(stock, lineLimit);
  return Math.max(0, limit - inCart);
}

export const isProductId = (id: string) => /^[a-f\d]{24}$/i.test(id);
