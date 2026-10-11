import mongoose from 'mongoose';
import Product from '../model/product.js';
import { HttpError } from '../utils/httpError.js';
import { decodeEntities } from '../utils/schema.js';
import { clip, isObjectId } from '../utils/validate.js';

// Business rules (mirrors what the cart page shows).
export const SHIPPING_FEE = 5;
export const ORDER_DISCOUNT = 0.9; // 10% off the items
// The DEFAULT candle price; the price charged is the owner's setting (services/siteSettings.js).
export { CANDLE_PRICE_DEFAULT as CANDLE_PRICE } from './siteSettings.js';
import { getCandlePrice } from './siteSettings.js';
export const DONATION_MIN = 1;
export const DONATION_MAX = 5000;
export const MAX_QUANTITY = 50;

const round2 = (n) => Math.round(n * 100) / 100;

// Compare paid lines without looking up today's catalog or trusting browser prices/names.
export function quoteSignature(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new HttpError(400, 'Order items are required');
  const totals = new Map();
  for (const item of items) {
    const id = String(item?.productID ?? item?._id ?? '');
    const quantity = Number(item?.quantity);
    if (!isObjectId(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new HttpError(400, 'Invalid order item');
    const key = JSON.stringify([id, clip(item?.color, 50) ?? '']);
    totals.set(key, (totals.get(key) ?? 0) + quantity);
  }
  return JSON.stringify([...totals].sort(([a], [b]) => a.localeCompare(b)));
}

// Prices a shop order from the product prices stored in the database and returns
// { total, lines }: the amount to charge and the order lines as the database knows them
// (product id and name from the database, quantity from the request, colour checked against the product's own list).
// items: [{ _id | productID, quantity, color? }]
// `afterPayment`: the money has already moved (a payment made by a client that stored no quote): the price is still
// computed here, but the order is not refused for stock or for a colour that is no longer offered; both are reported in
// `warnings` for the log instead.
export async function quoteShopOrder(items, { afterPayment = false } = {}) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new HttpError(400, 'Order items are required');
  }

  const wanted = new Map();
  const requested = [];
  for (const item of items) {
    const id = String(item?._id ?? item?.productID ?? '');
    const quantity = Number(item?.quantity);
    if (!isObjectId(id)) throw new HttpError(400, 'Invalid product id');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new HttpError(400, 'Invalid quantity');
    }
    wanted.set(id, (wanted.get(id) || 0) + quantity);
    requested.push({ id, quantity, color: clip(item?.color, 50) ?? '' });
  }

  // mongoose.trusted: this $in is ours; the sanitizeFilter setting (index.js) would otherwise neutralise it.
  const products = await Product.find({ _id: mongoose.trusted({ $in: [...wanted.keys()] }) }).select('price stock name color');
  if (products.length !== wanted.size) throw new HttpError(400, 'Unknown product in order');
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const warnings = [];

  // The colour (or design) must be one the product offers today: a product with variants needs one of them, a product
  // without variants takes none. The browser's text is never saved as it came.
  for (const { id, color } of requested) {
    const product = byId.get(id);
    // Compared with HTML entities decoded on both sides: the request passes the input sanitiser ("&" arrives as
    // "&amp;"), and a colour stored before the sanitiser existed may hold the raw character.
    const offered = (product.color ?? []).map((c) => decodeEntities(String(c)).trim()).filter(Boolean);
    if (offered.length ? !offered.includes(decodeEntities(color).trim()) : color !== '') {
      if (!afterPayment) throw new HttpError(409, `This colour or design is not available for ${product.name}`);
      warnings.push(`colour "${color}" is not offered for ${product.name}`);
    }
  }

  let subtotal = 0;
  for (const product of products) {
    const quantity = wanted.get(String(product._id));
    if (product.stock !== null && product.stock !== undefined && quantity > product.stock) {
      if (!afterPayment) throw new HttpError(409, `Not enough stock for ${product.name}`);
      warnings.push(`${quantity} of ${product.name} ordered, ${product.stock} in stock`);
    }
    subtotal += product.price * quantity;
  }
  return {
    total: round2(subtotal * ORDER_DISCOUNT + SHIPPING_FEE),
    warnings,
    lines: requested.map(({ id, quantity, color }) => ({
      productID: id,
      productName: byId.get(id).name,
      quantity,
      color,
    })),
  };
}

// The units of a saved order leave the stock (audit 2026-10-10, F01: stock was checked when quoting and never
// changed, so the last unit could be sold again and again). Only products whose stock is tracked (a number) change.
// Each product is one atomic update that never goes below zero. The order is already paid when this runs, so a
// product that no longer has enough units (two customers paid for the last one between their quotes and their
// payments) is set to 0 and returned in `oversold` for the owner to see: it is not refused.
// lines: [{ productID, quantity }]. Returns { changed, oversold: [{ productID, productName, missing }] }.
export async function takeFromStock(lines) {
  const wanted = new Map();
  for (const line of lines ?? []) {
    const id = String(line?.productID ?? '');
    const quantity = Number(line?.quantity);
    if (!isObjectId(id) || !Number.isInteger(quantity) || quantity < 1) continue;
    wanted.set(id, (wanted.get(id) ?? 0) + quantity);
  }
  let changed = 0;
  const oversold = [];
  for (const [id, quantity] of wanted) {
    const taken = await Product.updateOne({ _id: id, stock: mongoose.trusted({ $gte: quantity }) }, { $inc: { stock: -quantity } });
    if (taken.modifiedCount) {
      changed += 1;
      continue;
    }
    // Not enough units, or the stock is not tracked (null). One conditional write empties a tracked stock that is
    // still too small at this moment (a restock or another order in between is never overwritten); `$lt` matches
    // numbers only, so an untracked product is left alone.
    const before = await Product.findOneAndUpdate({ _id: id, stock: mongoose.trusted({ $lt: quantity }) }, { $set: { stock: 0 } }).select('stock name').lean();
    if (!before || typeof before.stock !== 'number') continue;
    changed += 1;
    oversold.push({ productID: id, productName: before.name, missing: quantity - before.stock });
  }
  return { changed, oversold };
}

// Price of a shop order (see quoteShopOrder).
export async function priceShopOrder(items) {
  return (await quoteShopOrder(items)).total;
}

// Amount (USD) to charge for a create_order request.
//   type 'order'    -> computed from `items` and the database
//   type 'candle'   -> the owner's candle price (services/siteSettings.js)
//   type 'donation' -> chosen by the donor, within limits
//   no type (legacy clients) -> the amount sent by the browser, logged as deprecated
export async function priceFor({ type, items, amount }) {
  switch (type) {
    case 'order':
      return priceShopOrder(items);
    case 'candle':
      return getCandlePrice();
    case 'donation': {
      const value = Number(amount);
      if (!Number.isFinite(value) || value < DONATION_MIN || value > DONATION_MAX) {
        throw new HttpError(400, `Donation must be between ${DONATION_MIN} and ${DONATION_MAX}`);
      }
      return round2(value);
    }
    case undefined: {
      const value = parseFloat(amount);
      if (!value || Number.isNaN(value) || value <= 0) throw new HttpError(400, 'Invalid amount');
      console.warn('[deprecated] create_order called without a type; trusting the client amount');
      return round2(value);
    }
    default:
      throw new HttpError(400, 'Invalid order type');
  }
}
