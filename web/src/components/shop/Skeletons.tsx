import styles from './Skeletons.module.css';

// Placeholders shaped like the real shop, product and cart layouts, so nothing
// jumps when the content arrives. Screen readers hear the one-word label only.

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function ShopBarSkeleton() {
  return (
    <div className="ui-container" aria-hidden="true">
      <div className={styles.bar}>
        <span className={`ui-skeleton ${styles.barSearch}`} />
        <span className={`ui-skeleton ${styles.barTool}`} />
      </div>
    </div>
  );
}

export function GridSkeleton({ label, count = 8 }: { label: string; count?: number }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <span className={`ui-skeleton ${styles.count}`} aria-hidden="true" />
      <ul className={styles.grid} aria-hidden="true">
        {range(count).map((i) => (
          <li key={i} className={`ui-glass ${styles.card}`}>
            <span className={`ui-skeleton ${styles.cardImg}`} />
            <span className={`ui-skeleton ${styles.line}`} />
            <span className={`ui-skeleton ${styles.line} ${styles.short}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductSkeleton({ label }: { label: string }) {
  return (
    <div className={`ui-container ${styles.product}`} role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <div className={styles.media} aria-hidden="true">
        <span className={`ui-skeleton ${styles.main}`} />
        <span className={styles.thumbs}>
          {range(4).map((i) => (
            <span key={i} className={`ui-skeleton ${styles.thumb}`} />
          ))}
        </span>
      </div>
      <div className={styles.info} aria-hidden="true">
        <span className={`ui-skeleton ${styles.line} ${styles.eyebrow}`} />
        <span className={`ui-skeleton ${styles.line} ${styles.title}`} />
        <span className={`ui-skeleton ${styles.line} ${styles.price}`} />
        <span className={`ui-skeleton ${styles.line}`} />
        <span className={`ui-skeleton ${styles.line} ${styles.short}`} />
        <span className={`ui-skeleton ${styles.line} ${styles.button}`} />
      </div>
    </div>
  );
}

export function CartSkeleton({ label }: { label: string }) {
  return (
    <div className={styles.cart} role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <ul className={styles.cartList} aria-hidden="true">
        {range(2).map((i) => (
          <li key={i} className={`ui-glass ${styles.cartRow}`}>
            <span className={`ui-skeleton ${styles.cartImg}`} />
            <span className={styles.cartText}>
              <span className={`ui-skeleton ${styles.line}`} />
              <span className={`ui-skeleton ${styles.line} ${styles.short}`} />
            </span>
          </li>
        ))}
      </ul>
      <span className={`ui-glass ${styles.cartSummary}`} aria-hidden="true">
        <span className={`ui-skeleton ${styles.line}`} />
        <span className={`ui-skeleton ${styles.line}`} />
        <span className={`ui-skeleton ${styles.line} ${styles.button}`} />
      </span>
    </div>
  );
}
