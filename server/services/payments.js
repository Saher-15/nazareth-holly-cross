import mongoose from 'mongoose';
import Payment from '../model/payment.js';
import { PAYMENT_GRACE_MS } from '../model/paymentConstants.js';
import { HttpError } from '../utils/httpError.js';

// The payment ledger (model/payment.js). Every function here is idempotent: calling it twice with the same input
// leaves one correct row, never two and never a half-written one. None of them talks to PayPal.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const text = (value, max) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined);

// Writes `update` for one PayPal order id, creating the row when it does not exist. Two requests racing to create
// the same row meet the unique index (E11000); the loser simply runs again and updates the winner's row.
async function upsert(paypalOrderId, update) {
  const options = { upsert: true, new: true, runValidators: true };
  try {
    return await Payment.findOneAndUpdate({ paypalOrderId }, update, options);
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return Payment.findOneAndUpdate({ paypalOrderId }, update, options);
  }
}

// create_order: the PayPal order exists and the customer is about to pay. Written before the id is handed to the
// browser, so every payment that can happen has a row. `$setOnInsert`: calling it again never rewrites the amount.
export async function recordCreated({ paypalOrderId, type, amount, donorName }) {
  try {
    return await upsert(paypalOrderId, {
      $setOnInsert: {
        type,
        amount: round2(amount),
        currency: 'USD',
        status: 'created',
        ...(donorName ? { donorName: text(donorName, 100) } : {}),
      },
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] payment ledger: could not record the new PayPal order ${paypalOrderId}: ${error.message}`);
    throw new HttpError(503, 'The payment could not be started. Nothing was charged. Please try again.');
  }
}

// What PayPal says about the payer and the money in a capture (or an order read back), every field optional.
export function readCapture(capture) {
  const unit = Array.isArray(capture?.purchase_units) ? capture.purchase_units[0] : undefined;
  const first = Array.isArray(unit?.payments?.captures) ? unit.payments.captures[0] : undefined;
  const name = capture?.payer?.name;
  const payerName = [name?.given_name, name?.surname].filter(Boolean).join(' ');
  const amount = Number(first?.amount?.value ?? unit?.amount?.value);
  return {
    payerEmail: text(capture?.payer?.email_address, 254)?.toLowerCase(),
    payerName: text(payerName, 200),
    amount: Number.isFinite(amount) ? round2(amount) : undefined,
    currency: text(first?.amount?.currency_code ?? unit?.amount?.currency_code, 3),
  };
}

// The ledger row of a payment that is already captured, or null.
export async function capturedPayment(paypalOrderId) {
  const found = await Payment.findOne({ paypalOrderId });
  return found?.status === 'captured' ? found : null;
}

// complete_order: PayPal confirmed the capture. A row that is already captured is left alone (so a second call, a
// retry or a double click never processes the payment twice). A row that does not exist (the order was created by
// the old API before this ledger existed) is created now, as type 'unknown'.
export async function recordCaptured(paypalOrderId, capture = {}) {
  const found = await Payment.findOne({ paypalOrderId });
  if (found?.status === 'captured') return { payment: found, firstTime: false };

  const { payerEmail, payerName, amount, currency } = readCapture(capture);
  const payment = await upsert(paypalOrderId, {
    $set: {
      status: 'captured',
      capturedAt: new Date(),
      ...(payerEmail ? { payerEmail } : {}),
      ...(payerName ? { payerName } : {}),
    },
    $setOnInsert: { type: 'unknown', amount: amount ?? 0, currency: currency ?? 'USD' },
  });
  return { payment, firstTime: true };
}

// PayPal refused the capture. Only a row that is still "created" becomes "failed" (a captured one never goes back).
export async function recordFailed(paypalOrderId, reason) {
  try {
    await Payment.updateOne(
      { paypalOrderId, status: 'created' },
      { $set: { status: 'failed', notes: text(reason, 1000) ?? 'capture failed' } },
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] payment ledger: could not mark ${paypalOrderId} failed: ${error.message}`);
  }
}

// What the browser's second call may do with a payment: it must exist as a payment for that KIND of thing (or be an
// old 'unknown' one), and must not already pay for another record. Returns the row (or null: no ledger row yet,
// which is allowed while old clients and in-flight payments exist; the caller then proves the payment with PayPal).
export async function paymentFor(paypalOrderId, kind) {
  const payment = await Payment.findOne({ paypalOrderId });
  if (!payment) return null;
  if (payment.type !== kind && payment.type !== 'unknown') {
    throw new HttpError(409, 'This payment was made for something else');
  }
  if (payment.linkedTo?.id) throw new HttpError(409, 'This payment was already used');
  return payment;
}

// The order or candle request was saved: link the payment to it. The payment was proven by PayPal (assertPaid), so
// it is captured whatever the ledger said before. The record is already saved at this point, so a ledger failure is
// logged (and found by the reconciliation script) but never fails the request.
export async function linkPayment(paypalOrderId, { kind, id, type = kind, amount }) {
  try {
    await upsert(paypalOrderId, {
      $set: { status: 'captured', type, linkedTo: { kind, id } },
      $setOnInsert: { amount: round2(amount), currency: 'USD', capturedAt: new Date() },
    });
    // A row created by create_order has no capturedAt yet when complete_order's write was lost.
    await Payment.updateOne({ paypalOrderId, capturedAt: null }, { $set: { capturedAt: new Date() } });
    return true;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] payment ledger: ${kind} ${id} saved but payment ${paypalOrderId} was not linked: ${error.message}`);
    return false;
  }
}

// ---- unfulfilled payments ----

// Captured payments for an order, a candle or a legacy client that no saved record points to, that nobody has
// resolved, and that are older than the grace period. Donations are complete by themselves and never appear here.
export function unfulfilledFilter(now = Date.now()) {
  return {
    status: 'captured',
    type: mongoose.trusted({ $in: ['order', 'candle', 'unknown'] }),
    'linkedTo.id': null,
    resolvedAt: null,
    capturedAt: mongoose.trusted({ $lte: new Date(now - PAYMENT_GRACE_MS) }),
  };
}

// { count, amount } of the unfulfilled payments, for the dashboard alert.
export async function unfulfilledSummary(now = Date.now()) {
  const filter = unfulfilledFilter(now);
  const [count, rows] = await Promise.all([
    Payment.countDocuments(filter),
    Payment.aggregate([{ $match: filter }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
  ]);
  return { count, amount: round2(rows[0]?.amount) };
}
