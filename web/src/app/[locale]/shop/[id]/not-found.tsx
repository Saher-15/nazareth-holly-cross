'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import StateCard from '@/components/shop/StateCard';
import TopBar from './TopBar';
import styles from '../shop.module.css';

// An unknown or malformed product id: say so and lead back to the shop.
// A client component on purpose: it reads its texts from the provider in the layout.
// As a server component, next-intl would look the language up from the request headers
// here, which turns every product page from static into dynamic.
export default function ProductNotFound() {
  const t = useTranslations('shopPage');
  const tProduct = useTranslations('product');
  const tCart = useTranslations('cart');
  return (
    <div className={`ui-page ${styles.page}`}>
      <TopBar />
      <div className="ui-container">
        <StateCard icon="box" headingLevel={1} title={tProduct('error.productNotFound')} text={t('notFoundText')}>
          <Link href="/shop" className="ui-btn ui-btn--gold">
            {tCart('backToShopping')}
          </Link>
        </StateCard>
      </div>
    </div>
  );
}
