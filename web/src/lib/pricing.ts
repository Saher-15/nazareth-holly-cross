// Display-only copy of the shop's price rules. The API (server/services/pricing.js)
// computes the amount that is actually charged; keep the two in step.
import { isRtl } from '@/i18n/routing';

export const SHIPPING_FEE = 5;
export const ORDER_DISCOUNT = 0.9; // 10% off the items
export const CANDLE_PRICE = 3;

export type PricedLine = { price: number; quantity: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

// The total is computed in ONE step, exactly as the API does it (round2(items * 0.9 + shipping)): rounding the
// discount first and subtracting it gave a total one cent away from the charged amount for prices such as $14.95
// (page $18.46, PayPal $18.45). The discount row is what makes the three rows add up to that total.
export function orderSummary(lines: PricedLine[]) {
  const items = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const subtotal = round2(items);
  const shipping = lines.length ? SHIPPING_FEE : 0;
  const total = lines.length ? round2(items * ORDER_DISCOUNT + SHIPPING_FEE) : 0;
  const discount = lines.length ? round2(subtotal + shipping - total) : 0;
  return { subtotal, discount, shipping, total };
}

// Western digits in every language. In Hebrew and Arabic the price is written the English way ("$3.00") and
// isolated as one left-to-right unit, because the locale's own pattern ("3.00 US$") comes out as "$US 3.00"
// when it sits in the middle of right-to-left text.
type Digits = { minimumFractionDigits: number; maximumFractionDigits: number };

function formatDollars(amount: number, locale: string, digits?: Digits) {
  if (isRtl(locale)) {
    const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', ...digits }).format(amount);
    return `⁦${price}⁩`;
  }
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', numberingSystem: 'latn', ...digits }).format(amount);
}

export const formatUsd = (amount: number, locale = 'en') => formatDollars(amount, locale);

/** "$25" rather than "$25.00": for round amounts such as the donation presets. */
export const formatUsdWhole = (amount: number, locale = 'en') =>
  formatDollars(amount, locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
