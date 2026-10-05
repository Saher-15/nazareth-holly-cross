'use client';

import { useCallback, useState } from 'react';
import { postJson } from './apiClient';

// What is being paid for. The API decides the amount; the browser only says what.
export type PaymentPayload =
  | { type: 'order'; items: { _id: string; quantity: number }[] }
  | { type: 'candle' }
  | { type: 'donation'; amount: number };

export type PaymentErrorCode = 'start' | 'notCompleted' | 'paypal';

type Capture = { id: string; status: string };

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
    const res = await postJson<{ id: string }>('/order/create_order', getPayload());
    if (!res.ok || !res.data?.id) {
      setError('start');
      throw new Error(res.ok ? 'create_order returned no id' : res.error);
    }
    return res.data.id;
  }, [getPayload]);

  const onApprove = useCallback(
    async ({ orderID }: { orderID: string }) => {
      const res = await postJson<Capture>('/order/complete_order', { order_id: orderID });
      if (!res.ok || res.data?.status !== 'COMPLETED') {
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
