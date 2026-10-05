import type { FaqItem } from '@/data/pilgrim/faqEntries';
import styles from './FaqList.module.css';

// Questions and answers as plain, always-open text: readable without JavaScript, linkable by anchor
// (/faq#shop-shipping) and fully indexable. `idPrefix` keeps anchors unique when a page shows two lists.
export default function FaqList({ items, idPrefix = '' }: { items: readonly FaqItem[]; idPrefix?: string }) {
  return (
    <div className={styles.list}>
      {items.map((item) => (
        <article key={item.anchor} id={`${idPrefix}${item.anchor}`} className={`ui-glass ${styles.item}`}>
          <h3 className={styles.question}>{item.question}</h3>
          <p className={styles.answer}>{item.answer}</p>
        </article>
      ))}
    </div>
  );
}
