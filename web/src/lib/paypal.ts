'use client';

import { useCallback, useRef, useState } from 'react';
import { z } from 'zod';
import './zodConfig';
import { postJson } from './apiClient';
import { pendingFulfilment } from './pendingFulfilment';

// What is being paid for. The API decides the amount; the browser only says what.
export type PaymentPayload =
  | { type: 'order'; items: { _id: string; quantity: number; color?: string }[]; fulfilment?: Record<string, unknown>; cart?: string }
  | { type: 'candle'; fulfilment?: Record<string, unknown> }
  | { type: 'donation'; amount: number; donorName?: string };

// 'unconfirmed': the capture's answer never arrived (no connection, the API asleep): the customer may or may not have
// paid, so the page must not say "you have not been charged" and must not invite a second payment.
// 'priceChanged': the API will charge another amount than the page shows (a price was changed after the cart was
// filled, or the page showed a fallback price). Nothing is started: the customer sees both amounts and presses the
// button again to pay the new one.
export type PaymentErrorCode = 'start' | 'notCompleted' | 'unconfirmed' | 'paypal' | 'priceChanged';
/** The amount the page showed and the amount the API quoted, in USD. */
export type PriceChange = { shown: number; charged: number };

// `amount` is the price the API computed and gave to PayPal (server/route/orderRoute.js create_order).
const createdSchema = z.object({ id: z.string().min(1), amount: z.number().positive().optional() });

/** Do two USD amounts differ by a cent or more? */
export const amountsDiffer = (a: number, b: number) => Math.abs(Math.round(a * 100) - Math.round(b * 100)) >= 1;
const captureSchema = z.object({ id: z.string(), status: z.string() });
type Capture = z.output<typeof captureSchema>;

// Capturing is idempotent on the API (a payment that is already captured answers COMPLETED again), so an answer that
// got lost can simply be asked for again. Asked up to three times, a moment apart, before giving up.
export const CAPTURE_RETRY_DELAYS_MS = [0, 1_500, 4_000] as const;
export const isLostAnswer = (status: number) => status === 0 || status === 429 || status >= 500;

export async function captureWithRetry(orderId: string, delays: readonly number[] = CAPTURE_RETRY_DELAYS_MS) {
  let result = await postJson('/order/complete_order', { order_id: orderId }, { schema: captureSchema });
  for (const delay of delays.slice(1)) {
    if (result.ok || !isLostAnswer(result.status)) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
    result = await postJson('/order/complete_order', { order_id: orderId }, { schema: captureSchema });
  }
  return result;
}

// Shared PayPal flow for the shop, candle and donation checkouts:
//   createOrder -> the API creates a PayPal order for the server-side price
//   onApprove   -> the API captures it; onPaid runs only when PayPal says COMPLETED
export function usePayPalOrder({
  getPayload,
  onPaid,
  getShownAmount,
}: {
  getPayload: () => PaymentPayload;
  onPaid: (capture: Capture) => void;
  /** The total the page shows (USD). When given, a different amount from the API stops the payment once. */
  getShownAmount?: () => number | undefined;
}) {
  const [error, setError] = useState<PaymentErrorCode | null>(null);
  const [priceChange, setPriceChange] = useState<PriceChange | null>(null);
  // The amount the customer has been told about: pressing the button again accepts it.
  const acknowledged = useRef<number | null>(null);
  const approvedPayloads = useRef(new Map<string, PaymentPayload>());

  const createOrder = useCallback(async () => {
    setError(null);
    const payload = getPayload();
    if (pendingFulfilment.list().some(record => record.kind === payload.type)) {
      setError('unconfirmed');
      throw new Error('An earlier payment is still being confirmed');
    }
    const res = await postJson('/order/create_order', payload, { schema: createdSchema });
    if (!res.ok) {
      setError('start');
      throw new Error(res.error);
    }
    const shown = getShownAmount?.();
    const charged = res.data.amount;
    if (shown !== undefined && charged !== undefined && amountsDiffer(shown, charged) && (acknowledged.current === null || amountsDiffer(acknowledged.current, charged))) {
      // The PayPal order just created is left unapproved (it expires by itself); nothing was charged.
      acknowledged.current = charged;
      setPriceChange({ shown, charged });
      setError('priceChanged');
      throw new Error('The price changed');
    }
    setPriceChange(null);
    approvedPayloads.current.set(res.data.id, payload);
    return res.data.id;
  }, [getPayload, getShownAmount]);

  const onApprove = useCallback(
    async ({ orderID }: { orderID: string }) => {
      const payload = approvedPayloads.current.get(orderID);
      if (!payload) { setError('start'); return; }
      if (pendingFulfilment.list().some(record => record.kind === payload.type && record.paypalOrderId !== orderID)) {
        setError('unconfirmed');
        return;
      }
      // Persist before the first capture request: refresh/lost responses must not lose this reference.
      try {
        pendingFulfilment.prepare({ paypalOrderId: orderID, kind: payload.type,
          path: payload.type === 'order' ? '/order/newOrder' : payload.type === 'candle' ? '/candle/lightACandle' : '/order/complete_order',
          body: payload.type === 'donation' ? {} : payload.fulfilment ?? {},
          cart: payload.type === 'order' ? payload.cart : undefined });
      } catch {
        setError('start'); // storage failed before capture: do not risk a charge without durable recovery
        return;
      }
      const res = await captureWithRetry(orderID);
      if (!res.ok) {
        setError('unconfirmed');
        return;
      }
      if (res.data.status !== 'COMPLETED') {
        setError('unconfirmed'); // nested capture may be pending; never invite another charge
        return;
      }
      onPaid({ ...res.data, id: orderID });
      if (payload.type === 'donation') pendingFulfilment.confirmDonation(orderID);
    },
    [onPaid],
  );

  const onError = useCallback(() => setError((current) => current ?? 'paypal'), []);

  return { createOrder, onApprove, onError, error, priceChange };
}
