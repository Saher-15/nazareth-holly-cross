import styles from './Flame.module.css';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  /** Drawn in ink, for a flame sitting on a gold button. */
  ink?: boolean;
  className?: string;
};

const SIZE_CLASS = { sm: styles.sm, md: '', lg: styles.lg } as const;

// A flickering candle flame drawn in CSS (decorative). Still for reduced motion.
export default function Flame({ size = 'md', ink = false, className = '' }: Props) {
  const classes = [styles.flame, SIZE_CLASS[size], ink ? styles.ink : '', className];
  return <span className={classes.filter(Boolean).join(' ')} aria-hidden="true" />;
}
