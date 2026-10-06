import mongoose from 'mongoose';
import Order from '../model/order.js';
import Candle from '../model/candle.js';
import Contact from '../model/contact.js';
import Product from '../model/product.js';
import Review from '../model/review.js';
import ProductReview from '../model/productReview.js';
import Prayer from '../model/prayer.js';
import { unfulfilledSummary } from './payments.js';

// The numbers behind GET /admin/dashboard, computed by the database (aggregations and counts), never by loading
// collections into memory, and cached for 30 seconds (one computation at a time, however many admins refresh).
//
// Revenue = the sum of `totalPrice` over all orders (USD). Orders have no per-line price, so a product's revenue in
// `topProducts` is units sold x the product's CURRENT price: an estimate that drifts if prices change.

export const TIME_ZONE = 'Asia/Jerusalem'; // days are Nazareth days
export const CACHE_MS = 30_000;
export const LOW_STOCK_AT = 5; // stock tracked and at or below this
export const DAYS = 30;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
export const dayKey = (date) => dayFormat.format(date); // 'YYYY-MM-DD'

// The last `days` calendar days (oldest first), ending with today in Nazareth time.
export function lastDays(now = new Date(), days = DAYS) {
  const [y, m, d] = dayKey(now).split('-').map(Number);
  return Array.from({ length: days }, (_, i) => new Date(Date.UTC(y, m - 1, d - (days - 1 - i))).toISOString().slice(0, 10));
}

// Merges the per-day rows of two aggregations into exactly `days` entries, zero where nothing happened.
export function zeroFill(dayList, orderRows, candleRows) {
  const orders = new Map(orderRows.map((r) => [r._id, r]));
  const candles = new Map(candleRows.map((r) => [r._id, r]));
  return dayList.map((date) => ({
    date,
    orders: orders.get(date)?.orders ?? 0,
    revenue: round2(orders.get(date)?.revenue ?? 0),
    candles: candles.get(date)?.candles ?? 0,
  }));
}

const perDay = (extra) => (from) => [
  { $match: { createdAt: { $gte: from } } },
  { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIME_ZONE }, }, ...extra } },
];
const ordersPerDay = perDay({ orders: { $sum: 1 }, revenue: { $sum: '$totalPrice' } });
const candlesPerDay = perDay({ candles: { $sum: 1 } });

const orderTotals = () => [
  {
    $group: {
      _id: null,
      orders: { $sum: 1 },
      ordersPending: { $sum: { $cond: [{ $eq: ['$done', true] }, 0, 1] } },
      revenue: { $sum: '$totalPrice' },
    },
  },
];

const topProducts = (limit = 5) => [
  { $unwind: '$products' },
  { $match: { 'products.productID': { $ne: null } } },
  { $group: { _id: '$products.productID', name: { $last: '$products.productName' }, sold: { $sum: '$products.quantity' } } },
  { $sort: { sold: -1, _id: 1 } },
  { $limit: limit },
  { $lookup: { from: Product.collection?.name ?? 'product', localField: '_id', foreignField: '_id', as: 'product' } },
  {
    $project: {
      _id: 0,
      productId: '$_id',
      name: { $ifNull: [{ $arrayElemAt: ['$product.name', 0] }, '$name'] },
      sold: 1,
      revenue: { $multiply: ['$sold', { $ifNull: [{ $arrayElemAt: ['$product.price', 0] }, 0] }] },
    },
  },
];

const recent = (Model, fields) => Model.find().sort({ createdAt: -1 }).limit(5).select(fields).lean();

export async function buildDashboard(now = new Date()) {
  const days = lastDays(now);
  const from = new Date(now.getTime() - (DAYS + 1) * 24 * 60 * 60 * 1000); // a day of slack; zeroFill keeps only the 30 days

  const [
    totalsRows, orderDays, candleDays, top, low,
    candles, candlesPending, contacts, contactsOpen, products, productReviews, prayers, reviews,
    recentOrders, recentCandles, recentContacts, unfulfilled,
  ] = await Promise.all([
    Order.aggregate(orderTotals()),
    Order.aggregate(ordersPerDay(from)),
    Candle.aggregate(candlesPerDay(from)),
    Order.aggregate(topProducts()),
    Product.find({ stock: mongoose.trusted({ $lte: LOW_STOCK_AT }) }).sort({ stock: 1, name: 1 }).limit(20).select('name stock').lean(),
    Candle.countDocuments(),
    Candle.countDocuments({ done: false }),
    Contact.countDocuments(),
    Contact.countDocuments({ done: false }),
    Product.countDocuments(),
    ProductReview.countDocuments(),
    Prayer.countDocuments(),
    Review.countDocuments(),
    recent(Order, 'firstName lastName email totalPrice done paymentVerified createdAt'),
    recent(Candle, 'firstName lastName email prayer done createdAt'),
    recent(Contact, 'fullName email msg done createdAt'),
    unfulfilledSummary(now.getTime()),
  ]);

  const t = totalsRows[0] ?? {};
  return {
    generatedAt: now.toISOString(),
    totals: {
      orders: t.orders ?? 0,
      ordersPending: t.ordersPending ?? 0,
      revenue: round2(t.revenue),
      candles,
      candlesPending,
      contacts,
      contactsOpen,
      products,
      productReviews,
      prayers,
      reviews,
    },
    last30Days: zeroFill(days, orderDays, candleDays),
    topProducts: top.map((p) => ({ productId: String(p.productId), name: p.name ?? '', sold: p.sold ?? 0, revenue: round2(p.revenue) })),
    lowStock: low.map((p) => ({ productId: String(p._id), name: p.name, stock: p.stock })),
    recent: { orders: recentOrders, candles: recentCandles, contacts: recentContacts },
    // Customers who paid but whose order or candle request was never saved (docs/ADMIN.md, Payments). Shown as an alert.
    alerts: { unfulfilledPayments: { count: unfulfilled.count, amount: unfulfilled.amount } },
  };
}

let cache = null; // { at, value }
let inFlight = null;

export function resetDashboardCache() {
  cache = null;
  inFlight = null;
}

export async function getDashboard(now = Date.now()) {
  if (cache && now - cache.at < CACHE_MS) return cache.value;
  inFlight ??= buildDashboard(new Date(now))
    .then((value) => { cache = { at: now, value }; return value; })
    .finally(() => { inFlight = null; });
  return inFlight;
}
