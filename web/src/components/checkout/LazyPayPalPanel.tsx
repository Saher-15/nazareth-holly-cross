'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import styles from './checkout.module.css';

function PayPalLoading() {
  const t = useTranslations('checkoutPage.payment');
  return (
    <div className={styles.loading} role="status">
      <span className={`ui-skeleton ${styles.loadingBar}`} aria-hidden="true" />
      <span className={`ui-skeleton ${styles.loadingBar}`} aria-hidden="true" />
      <span className="visually-hidden">{t('loading')}</span>
    </div>
  );
}

// The PayPal buttons (and their React wrapper) are only needed at the last step of a payment, after the visitor
// has filled in the details. Loading them lazily keeps them out of the first download of the candle, donate and
// checkout pages; the PayPal SDK itself is fetched from paypal.com only when this panel mounts.
const PayPalPanel = dynamic(() => import('./PayPalPanel'), { ssr: false, loading: () => <PayPalLoading /> });

export default PayPalPanel;
