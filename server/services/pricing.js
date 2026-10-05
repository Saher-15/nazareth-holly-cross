import mongoose from 'mongoose';
import Product from '../model/product.js';
import { HttpError } from '../utils/httpError.js';
import { clip, isObjectId } from '../utils/validate.js';

// Business rules (mirrors what the cart page shows).
export const SHIPPING_FEE = 5;
export const ORDER_DISCOUNT = 0.9; // 10% off the items
export const CANDLE_PRICE = 3;
export const DONATION_MIN = 1;
export const DONATION_MAX = 5000;
export const MAX_QUANTITY = 50;

const round2 = (n) => Math.round(n * 100) / 100;

// Prices a shop order from the product prices stored in the database and returns
// { total, lines }: the amount to charge and the order lines as the database knows them
// (product id and name from the database, quantity and colour from the request).
// items: [{ _id | productID, quantity, color? }]
export async function quoteShopOrder(items) {
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
  const products = await Product.find({ _id: mongoose.trusted({ $in: [...wanted.keys()] }) }).select('price stock name');
  if (products.length !== wanted.size) throw new HttpError(400, 'Unknown product in order');
  const byId = new Map(products.map((p) => [String(p._id), p]));

  let subtotal = 0;
  for (const product of products) {
    const quantity = wanted.get(String(product._id));
    if (product.stock !== null && product.stock !== undefined && quantity > product.stock) {
      throw new HttpError(409, `Not enough stock for ${product.name}`);
    }
    subtotal += product.price * quantity;
  }
  return {
    total: round2(subtotal * ORDER_DISCOUNT + SHIPPING_FEE),
    lines: requested.map(({ id, quantity, color }) => ({
      productID: id,
      productName: byId.get(id).name,
      quantity,
      color,
    })),
  };
}

// Price of a shop order (see quoteShopOrder).
export async function priceShopOrder(items) {
  return (await quoteShopOrder(items)).total;
}

// Amount (USD) to charge for a create_order request.
//   type 'order'    -> computed from `items` and the database
//   type 'candle'   -> fixed price
//   type 'donation' -> chosen by the donor, within limits
//   no type (legacy clients) -> the amount sent by the browser, logged as deprecated
export async function priceFor({ type, items, amount }) {
  switch (type) {
    case 'order':
      return priceShopOrder(items);
    case 'candle':
      return CANDLE_PRICE;
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
