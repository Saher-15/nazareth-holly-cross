import { HttpError } from '../utils/httpError.js';

const cents = (value) => Math.round(Number(value) * 100);
const MONEY = /^\d+(?:\.\d{1,2})?$/;

// What a PayPal order really says about the money, from its CAPTURES (the top-level status alone is not enough: an
// order can be COMPLETED while its capture is still PENDING, e.g. under review). Returns:
//   'COMPLETED'      every capture is COMPLETED, in USD, and together they are exactly `expectedAmount`
//   'PENDING'        at least one capture is PENDING: not paid yet, must stay unconfirmed (never fulfilled, never failed)
//   'NOT_COMPLETED'  the order or a capture is in any other state (declined, voided, refunded...)
// Throws 402 when the money does not match, 502 when the answer is malformed. `expectedAmount` is required: an amount
// the server did not price itself is never accepted.
export function verifiedCaptureStatus(order, expectedAmount) {
  if (!(Number(expectedAmount) > 0)) throw new HttpError(409, 'No priced payment is recorded for this PayPal order');
  if (order?.status !== 'COMPLETED') return 'NOT_COMPLETED';
  const units = order?.purchase_units;
  if (!Array.isArray(units) || units.length !== 1) throw new HttpError(502, 'Invalid PayPal capture response');
  const captures = units[0]?.payments?.captures;
  if (!Array.isArray(captures) || !captures.length) throw new HttpError(502, 'PayPal capture confirmation is missing');
  if (captures.some((c) => c?.status === 'PENDING')) return 'PENDING';
  if (captures.some((c) => c?.status !== 'COMPLETED')) return 'NOT_COMPLETED';
  if (captures.some((c) => c.amount?.currency_code !== 'USD' || !MONEY.test(String(c.amount?.value)))) {
    throw new HttpError(402, 'Payment amount does not match the order');
  }
  const paid = captures.reduce((sum, c) => sum + cents(c.amount.value), 0);
  if (paid !== cents(expectedAmount)) throw new HttpError(402, 'Payment amount does not match the order');
  return 'COMPLETED';
}

// The total of the completed captures, in dollars (call after verifiedCaptureStatus said 'COMPLETED').
export function capturedTotal(order) {
  return order.purchase_units[0].payments.captures.reduce((sum, c) => sum + cents(c.amount.value), 0) / 100;
}
