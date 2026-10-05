import { useCallback, useState } from 'react';
import { API_URL } from '../config/env';

async function postJson(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// Shared PayPal flow for the shop, candle and donation checkouts.
//   getPayload(): what to charge for, e.g. { type: 'candle' } — the server decides the price
//   onPaid(capture): called only when PayPal reports the payment COMPLETED
export default function usePayPalOrder({ getPayload, onPaid }) {
  const [error, setError] = useState(null);

  const createOrder = useCallback(async () => {
    setError(null);
    const { ok, data } = await postJson('/order/create_order', getPayload());
    if (!ok || !data.id) {
      setError(data.error || 'Could not start the payment. Please try again.');
      throw new Error(data.error || 'create_order failed');
    }
    return data.id;
  }, [getPayload]);

  const onApprove = useCallback(async ({ orderID }) => {
    const { ok, data } = await postJson('/order/complete_order', { order_id: orderID });
    if (!ok || data.status !== 'COMPLETED') {
      setError(data.error || 'The payment was not completed. You have not been charged.');
      return;
    }
    onPaid(data);
  }, [onPaid]);

  const onError = useCallback(() => {
    setError((current) => current || 'PayPal reported an error. Please try again.');
  }, []);

  return { createOrder, onApprove, onError, error };
}
