'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { PAYPAL_CLIENT_ID } from '@/lib/config';
import { useCspNonce } from '@/lib/cspNonce';
import { usePayPalOrder, type PaymentPayload } from '@/lib/paypal';
import { AlertIcon, LockIcon } from './icons';
import styles from './checkout.module.css';

type Props = {
  getPayload: () => PaymentPayload;
  onPaid: (capture: { id: string; status: string }) => void;
};

// The PayPal buttons for one payment, with loading, cancel and error states in the
// visitor's language. The API decides the amount; getPayload only says what is bought.
export default function PayPalPanel({ getPayload, onPaid }: Props) {
  const t = useTranslations('checkoutPage.payment');
  const { createOrder, onApprove, onError, error } = usePayPalOrder({ getPayload, onPaid });
  const [cancelled, setCancelled] = useState(false);
  // The SDK adds script and style tags of its own; the nonce lets the Content-Security-Policy accept them.
  const nonce = useCspNonce();
  const scriptOptions = useMemo(
    () => ({ clientId: PAYPAL_CLIENT_ID, currency: 'USD', intent: 'capture', dataCspNonce: nonce }),
    [nonce],
  );

  const start = useCallback(() => {
    setCancelled(false);
    return createOrder();
  }, [createOrder]);
  const cancel = useCallback(() => setCancelled(true), []);

  return (
    <div>
      <PayPalScriptProvider options={scriptOptions}>
        <Buttons createOrder={start} onApprove={onApprove} onError={onError} onCancel={cancel} />
      </PayPalScriptProvider>
      {error && (
        <p className={`${styles.alert} ${styles.alertDanger}`} role="alert">
          <AlertIcon />
          {t(`errors.${error}`)}
        </p>
      )}
      {cancelled && !error && (
        <p className={`${styles.alert} ${styles.alertInfo}`} role="status">
          <AlertIcon />
          {t('cancelled')}
        </p>
      )}
      <p className={styles.secure}>
        <LockIcon />
        {t('secured')}
      </p>
    </div>
  );
}

type ButtonsProps = {
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onError: () => void;
  onCancel: () => void;
};

function Buttons(props: ButtonsProps) {
  const t = useTranslations('checkoutPage.payment');
  const [{ isPending, isResolved, isRejected }] = usePayPalScriptReducer();

  if (isRejected) {
    return (
      <p className={`${styles.alert} ${styles.alertDanger}`} role="alert">
        <AlertIcon />
        {t('unavailable')}
      </p>
    );
  }

  return (
    <>
      {isPending && (
        <div className={styles.loading} role="status">
          <span className={`ui-skeleton ${styles.loadingBar}`} aria-hidden="true" />
          <span className={`ui-skeleton ${styles.loadingBar}`} aria-hidden="true" />
          <span className="visually-hidden">{t('loading')}</span>
        </div>
      )}
      <div className={styles.well} hidden={!isResolved} data-testid="paypal-buttons">
        <PayPalButtons style={{ layout: 'vertical', shape: 'pill', label: 'pay', height: 48 }} {...props} />
      </div>
    </>
  );
}
