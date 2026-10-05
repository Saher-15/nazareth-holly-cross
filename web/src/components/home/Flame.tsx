import styles from './Flame.module.css';

type Props = { size?: 'md' | 'sm'; className?: string };

// A flickering candle flame drawn in CSS (decorative).
export default function Flame({ size = 'md', className = '' }: Props) {
  return <span className={`${styles.flame} ${size === 'sm' ? styles.sm : ''} ${className}`} aria-hidden="true" />;
}
