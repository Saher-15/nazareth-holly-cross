'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWishlist } from '@/lib/shop/saved';
import ShopIcon from './ShopIcon';
import styles from './WishlistButton.module.css';

type Props = {
  id: string;
  name: string;
  /** "icon": round heart over a product photo; "pill": heart + "Save to wishlist" on the product page. */
  variant?: 'icon' | 'pill';
  className?: string;
};

// Toggles a product in the wishlist. aria-pressed tells whether it is saved, and a polite
// status line says what changed, because a toggle alone is easy to miss with a screen reader.
export default function WishlistButton({ id, name, variant = 'icon', className = '' }: Props) {
  const t = useTranslations('shopFeatures.wishlist');
  const { has, toggle } = useWishlist();
  const saved = has(id);
  const [message, setMessage] = useState('');

  const onClick = () => {
    toggle(id);
    setMessage(t(saved ? 'removed' : 'added', { name }));
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles[variant]} ${className}`}
        aria-pressed={saved}
        aria-label={variant === 'icon' ? t('toggle', { name }) : undefined}
        title={variant === 'icon' ? t('toggle', { name }) : undefined}
        onClick={onClick}
        data-testid="wishlist-toggle"
      >
        <ShopIcon name="heart" className={styles.heart} />
        {variant === 'pill' && <span>{t('save')}</span>}
      </button>
      <span className="visually-hidden" role="status">
        {message}
      </span>
    </>
  );
}
