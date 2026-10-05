import styles from './Stars.module.css';

type Props = {
  value: number; // 0-5, halves allowed
  label: string; // spoken text, e.g. "4.5 out of 5 stars"
  size?: 'sm' | 'md' | 'lg';
  count?: number; // number of reviews, shown after the stars
  countLabel?: string; // spoken instead of "(12)", e.g. "12 reviews"
};

// Read-only star rating: five outlined stars with a gold fill clipped to the value.
export default function Stars({ value, label, size = 'sm', count, countLabel }: Props) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={`${styles.root} ${styles[size]}`}>
      <span className={styles.stars} role="img" aria-label={label}>
        <span className={styles.base} aria-hidden="true">
          ★★★★★
        </span>
        <span className={styles.fill} style={{ inlineSize: `${pct}%` }} aria-hidden="true">
          ★★★★★
        </span>
      </span>
      {count !== undefined && (
        <span className={styles.count}>
          {/* aria-label is not allowed on a plain span, so the spoken text is a hidden sibling */}
          <span aria-hidden={countLabel ? true : undefined}>({count})</span>
          {countLabel && <span className="visually-hidden">{countLabel}</span>}
        </span>
      )}
    </span>
  );
}
