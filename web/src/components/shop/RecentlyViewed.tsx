'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { resolveIds, type CardItem } from '@/lib/shop/items';
import { useRecentlyViewed } from '@/lib/shop/saved';
import ProductRow from './ProductRow';

const SHOWN = 4;

// Remembers the product being viewed and shows the ones viewed before it. The ids live in
// the browser; the cards come from the catalogue the server passed in (slim card data).
export default function RecentlyViewed({ currentId, items }: { currentId: string; items: CardItem[] }) {
  const t = useTranslations('shopFeatures.product');
  const { ids, remember } = useRecentlyViewed();

  useEffect(() => {
    remember(currentId);
  }, [currentId, remember]);

  const shown = useMemo(
    () =>
      resolveIds(
        ids.filter((id) => id !== currentId),
        items,
      ).slice(0, SHOWN),
    [ids, items, currentId],
  );

  return <ProductRow id="recently-viewed-title" title={t('recentTitle')} items={shown} testId="recently-viewed" />;
}
