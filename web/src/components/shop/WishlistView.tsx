'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCart } from '@/lib/cart';
import { useHydrated } from '@/lib/shop/hydrated';
import { resolveIds, type CardItem } from '@/lib/shop/items';
import { useWishlist } from '@/lib/shop/saved';
import { isInStock } from './catalog';
import CartPill from './CartPill';
import ProductCard from './ProductCard';
import ShopIcon from './ShopIcon';
import { GridSkeleton } from './Skeletons';
import StateCard from './StateCard';
import styles from './WishlistView.module.css';

// The saved products, newest first, resolved against the catalogue the server passed in.
// The list itself lives in the browser (localStorage), so it is read after hydration.
export default function WishlistView({ items }: { items: CardItem[] }) {
  const t = useTranslations('shopFeatures.wishlist');
  const tPage = useTranslations('shopPage');
  const hydrated = useHydrated();
  const { ids, toggle } = useWishlist();
  const { dispatch } = useCart();
  const saved = useMemo(() => resolveIds(ids, items), [ids, items]);
  const [message, setMessage] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const emptyRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  if (!hydrated) return <GridSkeleton label={tPage('loading')} count={4} />;

  const remove = (item: CardItem, index: number) => {
    toggle(item._id);
    setMessage(t('removed', { name: item.name }));
    // Keep the keyboard where it was: the next card's remove button, or the empty state.
    requestAnimationFrame(() => {
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-remove]');
      const next = buttons?.length ? buttons[Math.min(index, buttons.length - 1)] : null;
      (next ?? emptyRef.current)?.focus();
    });
  };

  const addToCart = (item: CardItem) => {
    dispatch({ type: 'add', line: { _id: item._id, name: item.name, price: item.price, img: item.img, color: '' } });
    setAdded(item._id);
    setMessage(t('addedToCart', { name: item.name }));
  };

  return (
    <>
      <p className="visually-hidden" role="status">
        {message}
      </p>
      {saved.length === 0 ? (
        <StateCard icon="basket" title={t('emptyTitle')} text={t('emptyText')} headingRef={emptyRef}>
          <Link href="/shop" className="ui-btn ui-btn--gold">
            {t('browse')}
          </Link>
        </StateCard>
      ) : (
        <>
          <div className={styles.head}>
            <p className={styles.count} data-testid="wishlist-count-text">
              {t('count', { count: saved.length })}
            </p>
            <CartPill />
          </div>
          <ul ref={listRef} className={styles.grid} data-testid="wishlist-items">
            {saved.map((item, i) => {
              const available = isInStock(item.stock);
              return (
                <li key={item._id} className={styles.cell} data-testid="wishlist-item">
                  <ProductCard item={item} index={i} wishlist={false} />
                  <div className={styles.actions}>
                    {item.variants > 0 ? (
                      <Link href={`/shop/${item._id}`} className={`ui-btn ui-btn--glass ${styles.action}`}>
                        <span>{t('chooseOptions')}</span>
                        <span className="visually-hidden">
                          {' '}
                          <bdi>{item.name}</bdi>
                        </span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={`ui-btn ui-btn--gold ${styles.action}`}
                        onClick={() => addToCart(item)}
                        disabled={!available}
                      >
                        <ShopIcon name={added === item._id ? 'check' : 'cart'} />
                        <span>{available ? t('addToCart') : tPage('outOfStock')}</span>
                        <span className="visually-hidden">
                          {' '}
                          <bdi>{item.name}</bdi>
                        </span>
                      </button>
                    )}
                    <button type="button" className={styles.remove} onClick={() => remove(item, i)} data-remove>
                      <ShopIcon name="trash" />
                      <span>{t('remove')}</span>
                      <span className="visually-hidden">
                        {' '}
                        <bdi>{item.name}</bdi>
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
