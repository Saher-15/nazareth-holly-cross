'use client';

import { useTranslations } from 'next-intl';
import { ProductSkeleton } from '@/components/shop/Skeletons';
import TopBar from './TopBar';
import styles from '../shop.module.css';

// Shown while a product page that was not built ahead is rendered.
export default function ProductLoading() {
  const t = useTranslations('shopPage');
  return (
    <div className={`ui-page ${styles.page}`}>
      <TopBar />
      <ProductSkeleton label={t('loading')} />
    </div>
  );
}
