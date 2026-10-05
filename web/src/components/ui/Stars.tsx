import styles from './Stars.module.css';

type Props = {
  value: number; // 0-5, halves allowed
  label: string; // spoken text, e.g. "4.5 out of 5 stars"
  size?: 'sm' | 'md' | 'lg';
  count?: number; // number of reviews, shown after the stars
  countLabel?: string; // spoken instead of "(12)", e.g. "12 reviews"
};

// Five drawn stars (not the ★ character, whose shape depends on the visitor's fonts).
function StarRow() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" focusable="false">
          <path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.2 1.2-6.5-4.8-4.6 6.6-.9z" />
        </svg>
      ))}
    </>
  );
}

// Read-only star rating: five outlined stars with a gold fill clipped to the value.
export default function Stars({ value, label, size = 'sm', count, countLabel }: Props) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={`${styles.root} ${styles[size]}`}>
      <span className={styles.stars} role="img" aria-label={label}>
        <span className={styles.base} aria-hidden="true">
          <StarRow />
        </span>
        <span className={styles.fill} style={{ inlineSize: `${pct}%` }} aria-hidden="true">
          <StarRow />
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
