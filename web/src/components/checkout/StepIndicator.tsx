import { useTranslations } from 'next-intl';
import { CheckIcon } from '@/components/ui/icons';
import styles from './checkout.module.css';

export type FlowStep = 'details' | 'payment' | 'done';
const STEPS: FlowStep[] = ['details', 'payment', 'done'];

// "1 Your details — 2 Payment — 3 Confirmation", with the current step marked for screen readers.
export default function StepIndicator({ current, className = '' }: { current: FlowStep; className?: string }) {
  const t = useTranslations('checkoutPage.steps');
  const currentIndex = STEPS.indexOf(current);

  // The wrapper is the container the list measures itself against: too narrow for three labels side by side (a phone
  // with large text), it lists the steps one under the other (checkout.module.css, "step indicator").
  return (
    <div className={styles.stepsBox}>
    <ol className={`${styles.steps} ${className}`} aria-label={t('label')}>
      {STEPS.map((step, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
        return (
          <li key={step} className={styles.step} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className={styles.stepDot} aria-hidden="true">
              {state === 'done' ? <CheckIcon size={16} /> : i + 1}
            </span>
            <span className={styles.stepName}>{t(step)}</span>
          </li>
        );
      })}
    </ol>
    </div>
  );
}
