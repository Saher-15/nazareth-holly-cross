import type { CSSProperties } from 'react';
import Image from 'next/image';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Stars from '@/components/ui/Stars';
import type { CardItem } from '@/lib/shop/items';
import ShopIcon from './ShopIcon';
import WishlistButton from './WishlistButton';
import styles from './ProductCard.module.css';

type Props = {
  item: CardItem;
  index?: number;
  eager?: boolean;
  /** next/image sizes; the default fits the shop grid. */
  sizes?: string;
  /** Show the heart button (off on the wishlist page, which has its own remove button). */
  wishlist?: boolean;
};

const GRID_SIZES = '(min-width: 1040px) 280px, (min-width: 700px) 33vw, 50vw';

// One glass card: photo with badges, category, name, stars, price. The card links to the
// product page; the heart is a separate button next to the link, never inside it.
// The photo is decorative here (alt="") because the product name sits right under it.
export default function ProductCard({ item, index = 0, eager = false, sizes = GRID_SIZES, wishlist = true }: Props) {
  const t = useTranslations('shopFeatures');
  const format = useFormatter();
  const { avg, count } = item.rating;

  return (
    <article className={`ui-glass ${styles.card}`} style={{ '--i': index % 4 } as CSSProperties}>
      <Link href={`/shop/${item._id}`} className={styles.link} data-testid="product-card">
        <span className={styles.media}>
          <Image
            className={styles.img}
            src={item.img}
            alt=""
            fill
            sizes={sizes}
            loading={eager ? 'eager' : 'lazy'}
          />
          {item.badges.length > 0 && (
            <span className={styles.badges}>
              {item.badges.map((badge) => (
                <span key={badge} className={styles.badge} data-badge={badge} data-testid="card-badge">
                  {badge === 'lowStock' ? t('badges.lowStock', { count: item.stock ?? 0 }) : t(`badges.${badge}`)}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className={styles.body}>
          <span className={styles.category}>{t(`categories.${item.category}`)}</span>
          <h3 className={styles.name}>
            <bdi>{item.name}</bdi>
          </h3>
          {count > 0 && (
            <span className={styles.rating} data-testid="card-rating">
              <Stars
                value={avg}
                label={t('reviews.starsLabel', { rating: format.number(avg, { maximumFractionDigits: 1 }) })}
                count={count}
                countLabel={t('reviews.count', { count })}
              />
            </span>
          )}
          <span className={styles.foot}>
            <span className={styles.price} data-price={item.price}>
              {item.priceLabel}
            </span>
            <span className={styles.go}>
              <ShopIcon name="arrowNext" />
            </span>
          </span>
        </span>
      </Link>
      {wishlist && <WishlistButton id={item._id} name={item.name} className={styles.heart} />}
    </article>
  );
}
