'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { PAYPAL_CLIENT_ID } from '@/lib/config';
import { usePayPalOrder, type PaymentPayload } from '@/lib/paypal';
import Notice from '@/components/ui/Notice';
import { LockIcon } from './icons';
import styles from './checkout.module.css';

const SCRIPT_OPTIONS = { clientId: PAYPAL_CLIENT_ID, currency: 'USD', intent: 'capture' };

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

  const start = useCallback(() => {
    setCancelled(false);
    return createOrder();
  }, [createOrder]);
  const cancel = useCallback(() => setCancelled(true), []);

  return (
    <div>
      <PayPalScriptProvider options={SCRIPT_OPTIONS}>
        <Buttons createOrder={start} onApprove={onApprove} onError={onError} onCancel={cancel} />
      </PayPalScriptProvider>
      {error && (
        <Notice role="alert">{t(`errors.${error}`)}</Notice>
      )}
      {cancelled && !error && (
        <Notice tone="info" role="status">
          {t('cancelled')}
        </Notice>
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
      <Notice role="alert">{t('unavailable')}</Notice>
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
