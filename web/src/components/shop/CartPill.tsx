'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCart } from '@/lib/cart';
import ShopIcon from './ShopIcon';
import styles from './CartPill.module.css';

// Glass pill linking to the cart; the gold badge pops whenever the count changes.
export default function CartPill({ className = '' }: { className?: string }) {
  const t = useTranslations('shopPage');
  const { count, ready } = useCart();
  const shown = ready ? count : 0;

  return (
    <Link href="/cart" className={`${styles.pill} ${className}`} aria-label={t('cartAria', { count: shown })}>
      <ShopIcon name="cart" className={styles.icon} />
      <span className={styles.label}>{t('cartLink')}</span>
      {shown > 0 && (
        <span key={shown} className={styles.count} data-testid="cart-count" aria-hidden="true">
          {shown}
        </span>
      )}
    </Link>
  );
}
