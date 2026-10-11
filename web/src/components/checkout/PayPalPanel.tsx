'use client';

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { PAYPAL_CLIENT_ID } from '@/lib/config';
import { useCspNonce } from '@/lib/cspNonce';
import { usePayPalOrder, type PaymentPayload } from '@/lib/paypal';
import { formatUsd } from '@/lib/pricing';
import Notice from '@/components/ui/Notice';
import { LockIcon } from './icons';
import styles from './checkout.module.css';

type Props = {
  getPayload: () => PaymentPayload;
  onPaid: (capture: { id: string; status: string }) => void;
  /** The total shown on the page (USD): if the API quotes another amount, the customer is told before paying. */
  shownAmount?: number;
};

// The PayPal buttons for one payment, with loading, cancel and error states in the
// visitor's language. The API decides the amount; getPayload only says what is bought, and shownAmount lets the
// panel notice when the page and the API disagree (audit 2026-10-10, F04).
export default function PayPalPanel({ getPayload, onPaid, shownAmount }: Props) {
  const t = useTranslations('checkoutPage.payment');
  const locale = useLocale();
  const getShownAmount = useCallback(() => shownAmount, [shownAmount]);
  const { createOrder, onApprove, onError, error, priceChange } = usePayPalOrder({ getPayload, onPaid, getShownAmount });
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
      {error === 'priceChanged' && priceChange ? (
        <div data-testid="price-changed">
          <Notice role="alert">
          {t('errors.priceChanged', { shown: formatUsd(priceChange.shown, locale), charged: formatUsd(priceChange.charged, locale) })}
          </Notice>
        </div>
      ) : error ? (
        <Notice role="alert">{t(`errors.${error === 'priceChanged' ? 'start' : error}`)}</Notice>
      ) : null}
      {priceChange && error !== 'priceChanged' ? (
        <div data-testid="price-now">
          <Notice tone="info" role="status">
            {t('priceNow', { shown: formatUsd(priceChange.shown, locale), charged: formatUsd(priceChange.charged, locale) })}
          </Notice>
        </div>
      ) : null}
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
