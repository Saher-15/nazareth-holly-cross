import type { CatalogProduct, Category } from '@/lib/api';
import { formatUsd } from '@/lib/pricing';
import { badgesFor, sortProducts, type Badge, type QueryProduct } from './query';

// The shape of a product once it leaves the server for the browser: only what a card,
// the filters and the cart need, with the price already formatted on the server so
// the server and the browser can never disagree about it.

/** What a product card shows (wishlist, recently viewed, similar products). */
export type CardItem = {
  _id: string;
  name: string;
  price: number;
  priceLabel: string;
  img: string;
  category: Category;
  rating: { avg: number; count: number };
  stock: number | null;
  /** Number of colours or designs to choose from; 0 means it can go straight into the cart. */
  variants: number;
  badges: Badge[];
};

/** A card plus what search, filters and sorting need (the shop grid). */
export type ShopItem = CardItem & Omit<QueryProduct, keyof CardItem>;

export const BEST_SELLER_COUNT = 8;

/**
 * The products that may be called best sellers: the top 8 by units sold, and only ones
 * that actually sold. With no sales at all this is empty, so nothing claims to be one.
 */
export function bestSellerIds(products: Pick<CatalogProduct, '_id' | 'sold'>[], limit = BEST_SELLER_COUNT) {
  return new Set(
    [...products]
      .filter((p) => p.sold > 0)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, limit)
      .map((p) => p._id),
  );
}

type ItemContext = { locale: string; bestSellers: Set<string>; now?: number };

export function toCardItem(p: CatalogProduct, { locale, bestSellers, now }: ItemContext): CardItem {
  return {
    _id: p._id,
    name: p.name,
    price: p.price,
    priceLabel: formatUsd(p.price, locale),
    img: p.img,
    category: p.category,
    rating: p.rating,
    stock: p.stock,
    variants: p.color.length,
    badges: badgesFor(p, bestSellers, now),
  };
}

export function toShopItem(p: CatalogProduct, context: ItemContext): ShopItem {
  return {
    ...toCardItem(p, context),
    description: p.description,
    materials: p.materials,
    featured: p.featured,
    sold: p.sold,
    createdAt: p.createdAt,
  };
}

/** Cards for the whole catalogue (best-seller badges worked out once for all of them). */
export function cardItems(products: CatalogProduct[], locale: string, now?: number): CardItem[] {
  const bestSellers = bestSellerIds(products);
  return products.map((p) => toCardItem(p, { locale, bestSellers, now }));
}

export function shopItems(products: CatalogProduct[], locale: string, now?: number): ShopItem[] {
  const bestSellers = bestSellerIds(products);
  return products.map((p) => toShopItem(p, { locale, bestSellers, now }));
}

export type Strip = { kind: 'bestsellers' | 'favourites'; ids: string[] };

/**
 * The strip above the shop grid. It is called "Best sellers" only when products really
 * sold (ranked by the API's /bestSellers when it answered); otherwise it shows the
 * shop's own favourites in the featured order and makes no sales claim.
 */
export function pickStrip(
  products: QueryProduct[],
  apiBestSellers: Pick<CatalogProduct, '_id' | 'sold'>[] | null,
  limit = BEST_SELLER_COUNT,
): Strip {
  const known = new Set(products.map((p) => p._id));
  const sold = (apiBestSellers ?? sortProducts(products, 'bestselling'))
    .filter((p) => p.sold > 0 && known.has(p._id))
    .slice(0, limit)
    .map((p) => p._id);
  if (sold.length) return { kind: 'bestsellers', ids: sold };
  return { kind: 'favourites', ids: sortProducts(products, 'featured').slice(0, limit).map((p) => p._id) };
}

/** The items for a list of ids, in the order of the ids, skipping ids that no longer exist. */
export function resolveIds<T extends { _id: string }>(ids: readonly string[], items: readonly T[]): T[] {
  const byId = new Map(items.map((item) => [item._id, item]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}
