'use client';

import { useTranslations } from 'next-intl';
import ShopIcon from './ShopIcon';
import styles from './QuantityStepper.module.css';

type Props = {
  value: number;
  label: string;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseDisabled?: boolean;
  increaseDisabled?: boolean;
  className?: string;
};

// − value + control. The caller decides what each button does and when it stops.
// A button that reaches its limit is aria-disabled rather than disabled, so keyboard
// focus stays on it instead of jumping to the top of the page.
export default function QuantityStepper({
  value,
  label,
  onDecrease,
  onIncrease,
  decreaseDisabled = false,
  increaseDisabled = false,
  className = '',
}: Props) {
  const t = useTranslations('shopPage');
  return (
    <div className={`${styles.stepper} ${className}`} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.button}
        onClick={() => !decreaseDisabled && onDecrease()}
        aria-disabled={decreaseDisabled}
        aria-label={t('decrease')}
      >
        <ShopIcon name="minus" />
      </button>
      <output className={styles.value} aria-live="polite" aria-atomic="true" data-testid="quantity">
        {value}
      </output>
      <button
        type="button"
        className={styles.button}
        onClick={() => !increaseDisabled && onIncrease()}
        aria-disabled={increaseDisabled}
        aria-label={t('increase')}
      >
        <ShopIcon name="plus" />
      </button>
    </div>
  );
}
