// Pure helpers for product variants and stock. No React and no imports, so server and
// client code can both use it and every rule is unit-tested in tests/unit/shop-catalog.test.ts.
// Search, filters, sorting and paging live in lib/shop/query.ts.

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
