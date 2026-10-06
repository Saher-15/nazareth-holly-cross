'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast';
import { useCart } from '@/lib/cart';
import { CONTACT_EMAIL } from '@/lib/config';
import { cartSignature, pendingFulfilment } from '@/lib/pendingFulfilment';

// Mounted once in the page layout. It starts the retry loop of lib/pendingFulfilment.ts: a customer who paid but whose
// order or candle request could not be saved (no connection, a sleeping API, a closed tab) is saved here, on this visit,
// without them doing anything. It tells them only when it matters:
//   - an earlier payment was saved at last        -> a short thank-you with the reference
//   - an earlier payment is still not saved       -> the reference, and who to write to (once per visit)
// A payment made on THIS page is reported by the checkout screen itself (DonePanel), not here.
// And when an order is saved later than the page that paid for it, the cart it was paid from is emptied here.
export default function PendingFulfilmentRunner() {
  const t = useTranslations('checkoutPage.pending');
  const toast = useToast();
  const { lines, ready, dispatch } = useCart();
  const latest = useRef({ lines, ready });
  useEffect(() => {
    latest.current = { lines, ready }; // read by the engine's listener below when an order is saved
  }, [lines, ready]);

  useEffect(() => {
    const { inherited, stop } = pendingFulfilment.start();
    const earlier = new Set(inherited);
    const warned = new Set<string>();

    const unsubscribe = pendingFulfilment.subscribe((event) => {
      const { record, type } = event;
      if (type === 'saved' && record.kind === 'order' && record.cart) {
        // Only the cart the order was paid from: lines added since are the customer's next purchase.
        const { lines: current, ready: loaded } = latest.current;
        if (loaded && record.cart === cartSignature(current)) dispatch({ type: 'clear' });
      }
      if (!earlier.has(record.paypalOrderId)) return;
      if (type === 'saved') {
        toast.show({ message: t('recovered', { id: record.paypalOrderId }), kind: 'success', duration: 12_000 });
      } else if ((type === 'retry' || type === 'rejected') && !warned.has(record.paypalOrderId)) {
        warned.add(record.paypalOrderId);
        toast.show({ message: t('waiting', { id: record.paypalOrderId, email: CONTACT_EMAIL }), kind: 'error', duration: 0 });
      }
    });

    return () => {
      unsubscribe();
      stop();
    };
  }, [dispatch, t, toast]);

  return null;
}
