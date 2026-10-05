import type { CardItem } from '@/lib/shop/items';
import ProductCard from './ProductCard';
import styles from './ProductRow.module.css';

type Props = {
  id: string;
  title: string;
  items: CardItem[];
  testId?: string;
};

// A titled row of up to four product cards under the product page (similar products,
// recently viewed): two columns on phones, four on wide screens.
export default function ProductRow({ id, title, items, testId }: Props) {
  if (!items.length) return null;
  return (
    <section className={`ui-container ${styles.section}`} aria-labelledby={id} data-testid={testId}>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      <ul className={styles.grid}>
        {items.map((item, i) => (
          <li key={item._id} className={styles.cell}>
            <ProductCard item={item} index={i} sizes="(min-width: 1040px) 280px, (min-width: 700px) 25vw, 50vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}
