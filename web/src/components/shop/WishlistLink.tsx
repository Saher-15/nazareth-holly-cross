'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useWishlist } from '@/lib/shop/saved';
import ShopIcon from './ShopIcon';
import pill from './CartPill.module.css';
import styles from './WishlistLink.module.css';

// Heart pill next to the cart pill: leads to /wishlist and shows how many products are saved.
export default function WishlistLink({ className = '' }: { className?: string }) {
  const t = useTranslations('shopFeatures.wishlist');
  const { ids } = useWishlist();
  const count = ids.length;

  return (
    <Link
      href="/wishlist"
      className={`${pill.pill} ${styles.link} ${className}`}
      aria-label={t('linkAria', { count })}
      data-testid="wishlist-link"
    >
      <ShopIcon name="heart" className={`${pill.icon} ${count > 0 ? styles.filled : ''}`} />
      <span className={`${pill.label} ${styles.label}`}>{t('link')}</span>
      {count > 0 && (
        <span key={count} className={pill.count} data-testid="wishlist-count" aria-hidden="true">
          {count}
        </span>
      )}
    </Link>
  );
}
