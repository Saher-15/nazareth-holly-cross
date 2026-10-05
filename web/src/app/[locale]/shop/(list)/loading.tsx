'use client';

import { useTranslations } from 'next-intl';
import PageHero from '@/components/ui/PageHero';
import { GridSkeleton, ShopBarSkeleton } from '@/components/shop/Skeletons';
import styles from '../shop.module.css';

// Shown while the shop is fetched on a client-side navigation.
export default function ShopLoading() {
  const t = useTranslations('shopPage');
  const tHome = useTranslations('home');
  return (
    <div className={`ui-page ${styles.page}`}>
      <PageHero eyebrow={tHome('shopEyebrow')} title={t('heroTitle')} lead={t('heroLead')} />
      <ShopBarSkeleton />
      <div className="ui-container">
        <GridSkeleton label={t('loading')} />
      </div>
    </div>
  );
}
