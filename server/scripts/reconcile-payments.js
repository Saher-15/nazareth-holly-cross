// Reconciles the payment ledger with the orders and candle requests. READ-ONLY report: it changes nothing and does
// not call PayPal.
//
//   cd server
//   node scripts/reconcile-payments.js                       since the first ledger row (the cut-over)
//   node scripts/reconcile-payments.js --since 2026-10-07    since a date (UTC), e.g. the day the ledger went live
//   node scripts/reconcile-payments.js --json
//
// What it reports (the first one is the one that matters: a customer has paid and the shop has nothing to ship):
//   UNFULFILLED   captured payments for an order / candle (or an old client's untyped payment) that no saved order
//                 or candle request points to, older than 10 minutes, not marked resolved in the dashboard
//   DANGLING      payments linked to an order / candle that does not exist (it was deleted)
//   STALE         payments still "created" after 24 hours: started, never captured. Usually abandoned checkouts;
//                 but if the capture answer was lost, PayPal may hold a captured payment: check the PayPal dashboard
//   NO PAYMENT ID orders and candle requests created after the cut-over without a PayPal id: saved by a client that
//                 does not send it yet (or by hand). Not necessarily wrong, but nothing proves they were paid
//   NO LEDGER ROW orders / candle requests after the cut-over that carry a PayPal id the ledger does not know
//
// Exit code: 0 = nothing to do, 2 = something needs a person (UNFULFILLED or DANGLING), 1 = the script failed.
// The report shows ids, dates, amounts and PayPal ids, never names or e-mail addresses.

import { askHidden } from './create-admin.js';
import { isMain, openDatabase, readArgs, readDatabaseUrl } from './lib/cli.js';
import { PAYMENT_GRACE_MS } from '../model/payment.js';
import Candle from '../model/candle.js';
import Order from '../model/order.js';
import Payment from '../model/payment.js';

const STALE_MS = 24 * 60 * 60 * 1000;
const asId = (value) => (value === undefined || value === null ? '' : String(value));
const iso = (value) => (value instanceof Date ? value.toISOString() : value ? new Date(value).toISOString() : '');
const money = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

// Reads everything it needs from `db` and returns the report as data.
export async function reconcile({ db, since, now = new Date() }) {
  const names = { payment: Payment.collection.name, order: Order.collection.name, candle: Candle.collection.name };
  const payments = await db.collection(names.payment).find({}).toArray();

  // The cut-over: the date the ledger started recording (the first row), unless given.
  const first = payments.map((p) => p.createdAt).filter(Boolean).map((d) => new Date(d)).sort((a, b) => a - b)[0];
  const cutover = since ?? first ?? null;

  const orders = new Map();
  const candles = new Map();
  const unmarked = { order: [], candle: [] };
  const unknownLedger = { order: [], candle: [] };
  const ledgerIds = new Set(payments.map((p) => asId(p.paypalOrderId)));

  for (const [kind, name, table] of [['order', names.order, orders], ['candle', names.candle, candles]]) {
    for await (const doc of db.collection(name).find({})) {
      const docId = asId(doc._id);
      table.set(docId, asId(doc.paypalOrderId));
      if (!cutover || !doc.createdAt || new Date(doc.createdAt) < cutover) continue;
      if (!doc.paypalOrderId) unmarked[kind].push({ id: docId, createdAt: iso(doc.createdAt) });
      else if (!ledgerIds.has(asId(doc.paypalOrderId))) unknownLedger[kind].push({ id: docId, paypalOrderId: asId(doc.paypalOrderId), createdAt: iso(doc.createdAt) });
    }
  }

  const report = { generatedAt: now.toISOString(), cutover: cutover ? new Date(cutover).toISOString() : null, payments: payments.length, unfulfilled: [], recent: [], dangling: [], stale: [], noPaymentId: unmarked, noLedgerRow: unknownLedger };

  for (const p of payments) {
    const linkedId = asId(p.linkedTo?.id);
    const row = { id: asId(p._id), paypalOrderId: asId(p.paypalOrderId), type: p.type, amount: money(p.amount), currency: p.currency ?? 'USD', capturedAt: iso(p.capturedAt), createdAt: iso(p.createdAt) };
    if (linkedId) {
      const table = p.linkedTo?.kind === 'candle' ? candles : orders;
      if (!table.has(linkedId)) report.dangling.push({ ...row, linkedKind: p.linkedTo?.kind, linkedId });
      continue;
    }
    if (p.status === 'created' && p.createdAt && now - new Date(p.createdAt) > STALE_MS) report.stale.push(row);
    if (p.status !== 'captured' || p.type === 'donation' || p.resolvedAt) continue;
    if (p.capturedAt && now - new Date(p.capturedAt) < PAYMENT_GRACE_MS) report.recent.push(row); // the browser is probably still posting it
    else report.unfulfilled.push({ ...row, resolved: false });
  }

  report.needsAttention = report.unfulfilled.length + report.dangling.length;
  report.unfulfilledAmount = money(report.unfulfilled.reduce((sum, r) => sum + Number(r.amount), 0));
  return report;
}

export function printReport(r, log = console.log) {
  log(`Payment ledger: ${r.payments} payments. Cut-over (orders and candles are checked from here): ${r.cutover ?? 'none yet (the ledger is empty; use --since)'}.`);
  const section = (title, rows, line) => {
    log(`\n${title}: ${rows.length}`);
    for (const row of rows) log(`  ${line(row)}`);
  };
  section('UNFULFILLED (paid, no order / candle saved)', r.unfulfilled, (x) => `${x.paypalOrderId}  ${x.type.padEnd(8)} ${x.amount} ${x.currency}  captured ${x.capturedAt}`);
  if (r.unfulfilled.length) log(`  total ${r.unfulfilledAmount} USD. Open Payments in the admin dashboard (filter "Paid, not fulfilled"), contact the customer, then mark each resolved with a note.`);
  section('Captured in the last 10 minutes, not linked yet (normally the browser is still saving it)', r.recent, (x) => `${x.paypalOrderId}  ${x.type}  ${x.amount} ${x.currency}`);
  section('DANGLING (linked to an order / candle that no longer exists)', r.dangling, (x) => `${x.paypalOrderId}  ${x.linkedKind} ${x.linkedId}`);
  section('STALE (created more than 24 h ago, never captured: check PayPal if unsure)', r.stale, (x) => `${x.paypalOrderId}  ${x.type}  ${x.amount} ${x.currency}  created ${x.createdAt}`);
  section('Orders after the cut-over without a PayPal id', r.noPaymentId.order, (x) => `${x.id}  ${x.createdAt}`);
  section('Candle requests after the cut-over without a PayPal id', r.noPaymentId.candle, (x) => `${x.id}  ${x.createdAt}`);
  section('Orders carrying a PayPal id the ledger does not know', r.noLedgerRow.order, (x) => `${x.id}  ${x.paypalOrderId}`);
  section('Candle requests carrying a PayPal id the ledger does not know', r.noLedgerRow.candle, (x) => `${x.id}  ${x.paypalOrderId}`);
  log(r.needsAttention ? `\n${r.needsAttention} item(s) need a person.` : '\nNothing needs a person.');
}

const OPTIONS = {
  since: { type: 'string' },
  json: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

async function main() {
  const { values } = readArgs(OPTIONS);
  if (values.help) {
    console.log('node scripts/reconcile-payments.js [--since YYYY-MM-DD] [--json]   (read-only, no PayPal calls)');
    return;
  }
  let since;
  if (values.since) {
    since = new Date(`${values.since}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.since) || Number.isNaN(since.getTime())) throw new Error('--since must be a date like 2026-10-07');
  }
  if (!process.env.DATABASEURL) (await import('dotenv')).default.config();
  const { default: mongoose } = await import('mongoose');
  const url = await readDatabaseUrl({ askHidden });
  const database = await openDatabase({ url, mongoose, appName: 'nhc-reconcile' });
  try {
    if (!values.json) console.log(`Database: ${database.label}\n`);
    const report = await reconcile({ db: database.db, since });
    if (values.json) console.log(JSON.stringify(report, null, 2));
    else printReport(report);
    if (report.needsAttention) process.exitCode = 2;
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
