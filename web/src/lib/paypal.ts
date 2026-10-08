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
export type PaymentErrorCode = 'start' | 'notCompleted' | 'unconfirmed' | 'paypal';

const createdSchema = z.object({ id: z.string().min(1) });
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
}: {
  getPayload: () => PaymentPayload;
  onPaid: (capture: Capture) => void;
}) {
  const [error, setError] = useState<PaymentErrorCode | null>(null);
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
    approvedPayloads.current.set(res.data.id, payload);
    return res.data.id;
  }, [getPayload]);

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

  return { createOrder, onApprove, onError, error };
}
