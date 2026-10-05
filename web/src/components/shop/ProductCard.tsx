import type { CSSProperties } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { ShopItem } from './catalog';
import ShopIcon from './ShopIcon';
import styles from './ProductCard.module.css';

type Props = { item: ShopItem; index?: number; eager?: boolean };

// One glass card in the shop grid; the whole card links to the product page.
// The photo is decorative here (alt="") because the product name sits right under it.
export default function ProductCard({ item, index = 0, eager = false }: Props) {
  return (
    <article className={`ui-glass ${styles.card}`} style={{ '--i': index % 4 } as CSSProperties}>
      <Link href={`/shop/${item._id}`} className={styles.link} data-testid="product-card">
        <span className={styles.media}>
          <Image
            className={styles.img}
            src={item.img}
            alt=""
            fill
            sizes="(min-width: 1040px) 280px, (min-width: 700px) 33vw, 50vw"
            loading={eager ? 'eager' : 'lazy'}
          />
        </span>
        <span className={styles.body}>
          <h3 className={styles.name}>
            <bdi>{item.name}</bdi>
          </h3>
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
    </article>
  );
}
