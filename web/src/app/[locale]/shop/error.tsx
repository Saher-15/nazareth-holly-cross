'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import RetryButton from '@/components/shop/RetryButton';
import StateCard from '@/components/shop/StateCard';
import styles from './shop.module.css';

// Last-resort boundary for the shop and product pages. API outages are handled in
// the pages themselves; this catches anything unexpected while rendering.
export default function ShopError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations('shopPage');
  const tCart = useTranslations('cart');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={`ui-page ${styles.page}`}>
      <div className="ui-container">
        <StateCard icon="alert" tone="error" headingLevel={1} title={t('loadError')} text={t('loadErrorText')} role="alert">
          <RetryButton onRetry={retry} />
          <Link href="/shop" className="ui-btn ui-btn--ghost">
            {tCart('backToShopping')}
          </Link>
        </StateCard>
      </div>
    </div>
  );
}
