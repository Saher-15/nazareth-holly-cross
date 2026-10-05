import type { ReactNode, Ref } from 'react';
import ShopIcon, { type IconName } from './ShopIcon';
import styles from './StateCard.module.css';

type Props = {
  icon: IconName;
  title: string;
  text?: string;
  tone?: 'neutral' | 'error';
  /** h1 when the card is the page's main content (a missing product), h2 otherwise. */
  headingLevel?: 1 | 2;
  /** Lets a caller move keyboard focus to the heading after the content changed. */
  headingRef?: Ref<HTMLHeadingElement>;
  role?: 'alert' | 'status';
  children?: ReactNode;
};

// Glass card for empty, error and not-found states across the shop and cart.
export default function StateCard({
  icon,
  title,
  text,
  tone = 'neutral',
  headingLevel = 2,
  headingRef,
  role,
  children,
}: Props) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <div className={`ui-glass ${styles.card}`} role={role}>
      <span className={`${styles.icon} ${tone === 'error' ? styles.error : ''}`}>
        <ShopIcon name={icon} />
      </span>
      <Heading className={styles.title} ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
        {title}
      </Heading>
      {text && <p className={styles.text}>{text}</p>}
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}
