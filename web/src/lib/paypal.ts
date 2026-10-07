'use client';

import { useCallback, useState } from 'react';
import './zodConfig';
// zod/mini, not zod: browser code (see zodConfig.ts).
import * as z from 'zod/mini';
import { postJson } from './apiClient';

// What is being paid for. The API decides the amount; the browser only says what.
export type PaymentPayload =
  | { type: 'order'; items: { _id: string; quantity: number }[] }
  | { type: 'candle' }
  | { type: 'donation'; amount: number; donorName?: string };

// 'unconfirmed': the capture's answer never arrived (no connection, the API asleep): the customer may or may not have
// paid, so the page must not say "you have not been charged" and must not invite a second payment.
export type PaymentErrorCode = 'start' | 'notCompleted' | 'unconfirmed' | 'paypal';

const createdSchema = z.object({ id: z.string().check(z.minLength(1)) });
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

  const createOrder = useCallback(async () => {
    setError(null);
    const res = await postJson('/order/create_order', getPayload(), { schema: createdSchema });
    if (!res.ok) {
      setError('start');
      throw new Error(res.error);
    }
    return res.data.id;
  }, [getPayload]);

  const onApprove = useCallback(
    async ({ orderID }: { orderID: string }) => {
      const res = await captureWithRetry(orderID);
      if (!res.ok) {
        setError(isLostAnswer(res.status) ? 'unconfirmed' : 'notCompleted');
        return;
      }
      if (res.data.status !== 'COMPLETED') {
        setError('notCompleted');
        return;
      }
      onPaid(res.data);
    },
    [onPaid],
  );

  const onError = useCallback(() => setError((current) => current ?? 'paypal'), []);

  return { createOrder, onApprove, onError, error };
}
