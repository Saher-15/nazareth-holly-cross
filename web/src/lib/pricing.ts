// Display-only copy of the shop's price rules. The API (server/services/pricing.js)
// computes the amount that is actually charged; keep the two in step.
export const SHIPPING_FEE = 5;
export const ORDER_DISCOUNT = 0.9; // 10% off the items
export const CANDLE_PRICE = 3;

export type PricedLine = { price: number; quantity: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function orderSummary(lines: PricedLine[]) {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));
  const discount = round2(subtotal * (1 - ORDER_DISCOUNT));
  const total = lines.length ? round2(subtotal - discount + SHIPPING_FEE) : 0;
  return { subtotal, discount, shipping: lines.length ? SHIPPING_FEE : 0, total };
}

export const formatUsd = (amount: number, locale = 'en') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(amount);
