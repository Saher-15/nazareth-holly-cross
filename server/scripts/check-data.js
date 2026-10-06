// Read-only integrity check of the database: STRUCTURAL problems only.
//
//   cd server
//   node scripts/check-data.js            a summary and the first examples of each problem
//   node scripts/check-data.js --json     the full report as JSON (ids and field names, never customer data)
//
// It reads every document of every collection and writes nothing. Exit code 0 = nothing found, 1 = problems found.
// It looks for:
//   - documents that fail their schema (missing required field, value outside its enum or its length / number
//     bounds, wrong type, bad e-mail format): the same rules the API enforces when it saves
//   - orders whose product ids are not in the product collection; product reviews of a product that is gone
//   - negative stock
//   - duplicate PayPal order ids (payments, orders, candle requests): a missing unique index shows up here
//   - payments that point at an order or candle that does not exist, or whose PayPal id differs from it
//   - orders / candles marked verified without a PayPal id, or the other way round
//   - two admin accounts whose names differ only by case; sessions of an account that does not exist
//   - collections no model knows about (a notice, not a failure)
// It does NOT judge business facts (a customer's address, a price that "looks wrong").
//
// The report names collections, ids, fields and kinds of problem, never the values (no e-mail address or name is
// printed). The address comes from DATABASEURL (environment, server/.env) or a hidden prompt.

import { askHidden } from './create-admin.js';
import { isMain, openDatabase, readArgs, readDatabaseUrl } from './lib/cli.js';
import { MODELS, collectionNameOf } from '../services/indexes.js';

const KIND = {
  required: 'missing-required',
  enum: 'bad-enum',
  minlength: 'out-of-range',
  maxlength: 'out-of-range',
  min: 'out-of-range',
  max: 'out-of-range',
  regexp: 'bad-format',
  'user defined': 'invalid-value',
};
const kindOf = (error) => KIND[error.kind] ?? (error.name === 'CastError' ? 'bad-type' : 'invalid-value');

const id = (value) => (value === undefined || value === null ? '' : String(value));

// Runs every check against `db` (a driver Db). Returns { ok, total, checked, counts, problems, unknownCollections }.
export async function checkData({ db, models = MODELS, maxExamples = 10 }) {
  const problems = [];
  const counts = {};
  const perKey = new Map();
  const report = (collection, docId, kind, detail = '') => {
    const key = `${collection}|${kind}`;
    counts[key] = (counts[key] ?? 0) + 1;
    const seen = perKey.get(key) ?? 0;
    perKey.set(key, seen + 1);
    if (seen < maxExamples) problems.push({ collection, id: docId, kind, detail });
  };

  // ---- pass 1: every document against its schema, collecting what the cross checks need ----
  const known = { products: new Set(), orders: new Map(), candles: new Map() }; // id -> paypalOrderId ('' when none)
  const seenPayPal = { payment: new Map(), order: new Map(), candle: new Map() }; // paypalOrderId -> times
  const usernames = new Map();
  const adminIds = new Set();
  const sessions = [];
  const orders = [];
  const reviews = [];
  const payments = [];
  const checked = {};

  for (const [modelName, Model] of Object.entries(models)) {
    const collection = collectionNameOf(Model);
    checked[collection] = 0;
    for await (const raw of db.collection(collection).find({})) {
      checked[collection] += 1;
      const docId = id(raw._id);

      const error = new Model(raw).validateSync();
      if (error) for (const [path, detail] of Object.entries(error.errors)) report(collection, docId, kindOf(detail), path);

      switch (modelName) {
        case 'Product':
          known.products.add(docId);
          if (typeof raw.stock === 'number' && raw.stock < 0) report(collection, docId, 'negative-stock', 'stock');
          break;
        case 'Order':
          known.orders.set(docId, id(raw.paypalOrderId));
          orders.push({ docId, products: raw.products, paypalOrderId: id(raw.paypalOrderId), paymentVerified: raw.paymentVerified === true });
          if (raw.paypalOrderId) seenPayPal.order.set(id(raw.paypalOrderId), (seenPayPal.order.get(id(raw.paypalOrderId)) ?? 0) + 1);
          break;
        case 'Candle':
          known.candles.set(docId, id(raw.paypalOrderId));
          if (raw.paypalOrderId) seenPayPal.candle.set(id(raw.paypalOrderId), (seenPayPal.candle.get(id(raw.paypalOrderId)) ?? 0) + 1);
          if (raw.paypalOrderId && raw.paymentVerified !== true) report(collection, docId, 'payment-id-not-verified', 'paymentVerified');
          if (!raw.paypalOrderId && raw.paymentVerified === true) report(collection, docId, 'verified-without-payment-id', 'paypalOrderId');
          break;
        case 'Payment':
          payments.push({ docId, paypalOrderId: id(raw.paypalOrderId), kind: raw.linkedTo?.kind, linkedId: id(raw.linkedTo?.id) });
          seenPayPal.payment.set(id(raw.paypalOrderId), (seenPayPal.payment.get(id(raw.paypalOrderId)) ?? 0) + 1);
          break;
        case 'ProductReview':
          reviews.push({ docId, product: id(raw.product) });
          break;
        case 'Admin': {
          adminIds.add(docId);
          const lower = String(raw.username ?? '').toLowerCase();
          usernames.set(lower, [...(usernames.get(lower) ?? []), docId]);
          break;
        }
        case 'AdminSession':
          sessions.push({ docId, admin: id(raw.admin) });
          break;
        default:
      }
    }
  }

  // ---- pass 2: references between collections ----
  const orderName = collectionNameOf(models.Order);
  const reviewName = collectionNameOf(models.ProductReview);
  const paymentName = collectionNameOf(models.Payment);

  for (const order of orders) {
    for (const [index, line] of (Array.isArray(order.products) ? order.products : []).entries()) {
      const productId = id(line?.productID);
      if (productId && !known.products.has(productId)) report(orderName, order.docId, 'unknown-product-id', `products.${index}.productID`);
    }
    if (order.paypalOrderId && !order.paymentVerified) report(orderName, order.docId, 'payment-id-not-verified', 'paymentVerified');
    if (!order.paypalOrderId && order.paymentVerified) report(orderName, order.docId, 'verified-without-payment-id', 'paypalOrderId');
  }
  for (const review of reviews) {
    if (review.product && !known.products.has(review.product)) report(reviewName, review.docId, 'orphan-product', 'product');
  }
  for (const payment of payments) {
    if (!payment.linkedId) continue;
    const table = payment.kind === 'candle' ? known.candles : known.orders;
    if (!table.has(payment.linkedId)) report(paymentName, payment.docId, 'orphan-link', 'linkedTo.id');
    else if (table.get(payment.linkedId) !== payment.paypalOrderId) report(paymentName, payment.docId, 'link-mismatch', 'linkedTo.id');
  }
  for (const [where, table] of Object.entries(seenPayPal)) {
    const collection = collectionNameOf(models[{ payment: 'Payment', order: 'Order', candle: 'Candle' }[where]]);
    for (const [payPalId, times] of table) if (times > 1) report(collection, payPalId, 'duplicate-paypal-order-id', 'paypalOrderId');
  }
  for (const [, ids] of usernames) if (ids.length > 1) report(collectionNameOf(models.Admin), ids.join(','), 'duplicate-username', 'username');
  for (const session of sessions) {
    if (session.admin && !adminIds.has(session.admin)) report(collectionNameOf(models.AdminSession), session.docId, 'orphan-session', 'admin');
  }

  // ---- collections no model knows ----
  const modelCollections = new Set(Object.values(models).map(collectionNameOf));
  const present = await db.listCollections({}, { nameOnly: true }).toArray();
  const unknownCollections = present.filter((c) => (c.type ?? 'collection') === 'collection' && !c.name.startsWith('system.') && !modelCollections.has(c.name)).map((c) => c.name);

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return {
    ok: total === 0,
    total,
    checked,
    counts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([key, n]) => [key.replace('|', ': '), n])),
    problems,
    unknownCollections,
  };
}

export function printReport(result, log = console.log) {
  log('Documents checked:');
  for (const [collection, n] of Object.entries(result.checked)) log(`  ${collection.padEnd(14)} ${String(n).padStart(7)}`);
  if (result.unknownCollections.length) log(`\nNotice: collections no model knows about: ${result.unknownCollections.join(', ')}`);
  if (result.ok) {
    log('\nNo structural problems found.');
    return;
  }
  log(`\n${result.total} problem(s):`);
  for (const [what, n] of Object.entries(result.counts)) log(`  ${String(n).padStart(6)}  ${what}`);
  log('\nFirst examples (collection, document id, problem, field):');
  for (const p of result.problems) log(`  ${p.collection}  ${p.id}  ${p.kind}  ${p.detail}`);
}

const OPTIONS = {
  json: { type: 'boolean', default: false },
  'max-examples': { type: 'string', default: '10' },
  help: { type: 'boolean', short: 'h', default: false },
};

async function main() {
  const { values } = readArgs(OPTIONS);
  if (values.help) {
    console.log('node scripts/check-data.js [--json] [--max-examples N]   (read-only)');
    return;
  }
  const maxExamples = Math.max(1, Math.min(1000, Number.parseInt(values['max-examples'], 10) || 10));
  if (!process.env.DATABASEURL) (await import('dotenv')).default.config();
  const { default: mongoose } = await import('mongoose');
  const url = await readDatabaseUrl({ askHidden });
  const database = await openDatabase({ url, mongoose, appName: 'nhc-check-data' });
  try {
    if (!values.json) console.log(`Database: ${database.label}\n`);
    const result = await checkData({ db: database.db, maxExamples });
    if (values.json) console.log(JSON.stringify(result, null, 2));
    else printReport(result);
    if (!result.ok) process.exitCode = 1;
  } finally {
    await database.close();
  }
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
