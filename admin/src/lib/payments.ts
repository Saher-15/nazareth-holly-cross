import type { Payment } from './api';

// What a payment of the ledger (server/model/payment.js) means for the shop, in one word. The server decides
// "unfulfilled" the same way (server/services/payments.js, unfulfilledFilter): captured, for an order / candle / an
// old client, nothing saved for it, not resolved, and paid more than ten minutes ago.

export const GRACE_MS = 10 * 60 * 1000;

/** The time a page is rendered at (a server component renders once per request: a payment's age is as of then). */
export const requestTime = () => Date.now();

export type PaymentState =
  | 'unfulfilled' // paid, and nothing was saved: the customer is waiting for something the shop does not know about
  | 'processing' // paid a moment ago: the customer's browser is probably still saving the order
  | 'fulfilled' // paid, and an order / candle request points to it
  | 'received' // a donation: complete by itself
  | 'resolved' // an admin dealt with it by hand
  | 'open' // started, never paid
  | 'failed'; // PayPal refused the card

export function paymentState(p: Pick<Payment, 'status' | 'type' | 'linkedTo' | 'resolvedAt' | 'capturedAt'>, now: number = Date.now()): PaymentState {
  if (p.status === 'failed') return 'failed';
  if (p.status !== 'captured') return 'open';
  if (p.resolvedAt) return 'resolved';
  if (p.type === 'donation') return 'received';
  if (p.linkedTo?.id) return 'fulfilled';
  const captured = p.capturedAt ? new Date(p.capturedAt).getTime() : Number.NaN;
  return Number.isFinite(captured) && now - captured < GRACE_MS ? 'processing' : 'unfulfilled';
}

export const STATE_TONE: Record<PaymentState, 'warn' | 'info' | 'success' | 'neutral' | 'danger'> = {
  unfulfilled: 'warn',
  processing: 'info',
  fulfilled: 'success',
  received: 'success',
  resolved: 'neutral',
  open: 'neutral',
  failed: 'danger',
};

/** The page of the record a payment points to: an order or a candle request. */
export function linkedHref(p: Pick<Payment, 'linkedTo'>): string | null {
  const id = p.linkedTo?.id;
  if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return p.linkedTo?.kind === 'candle' ? `/candles?open=${id}` : `/orders?open=${id}`;
}

/** The person to write to: what PayPal says about the payer, else the donor's own name. */
export function payerLabel(p: Pick<Payment, 'payerName' | 'donorName'>): string {
  return (p.payerName || p.donorName || '').trim();
}
