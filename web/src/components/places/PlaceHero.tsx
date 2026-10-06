import type { ReactNode } from 'react';
import MotionToggle from '@/components/ui/MotionToggle';
import { Link } from '@/i18n/navigation';
import type { Photo } from '@/data/places/places';
import { ChevronIcon } from './icons';
import PhotoImage from './PhotoImage';
import styles from './PlaceHero.module.css';

// The photo covers a box that is taller than wide on a phone, so it is cropped sideways: the file must be wider than
// the screen (about the box's height times the photo's aspect ratio). 740 px at 2x-3x density picks the 1920 px file,
// which is sharp enough there and about a third lighter than the 2560 px one; wide screens get the width they have.
const HERO_SIZES = '(max-width: 767px) 740px, 100vw';

type Props = {
  image: Photo;
  title: string;
  eyebrow: string;
  /** Turns the eyebrow into a link back to a parent page (e.g. all holy sites). */
  eyebrowHref?: string;
  lead?: string;
  /** CSS object-position of the photo (its subject), so narrow screens crop around it. */
  focus?: string;
  /** `tall` for a place, `medium` for the index, tour and about pages. */
  size?: 'tall' | 'medium';
  children?: ReactNode;
};

// Full-bleed photo header of the holy sites pages: slow Ken Burns zoom (off for reduced motion),
// eyebrow, title, lead and call-to-action buttons. Builds on the shared ui-hero block.
export default function PlaceHero({ image, title, eyebrow, eyebrowHref, lead, focus, size = 'tall', children }: Props) {
  return (
    <header className={`ui-hero ${styles.hero} ${size === 'tall' ? styles.tall : styles.medium}`} data-motion-scope="">
      <PhotoImage
        className={`ui-hero__bg ${styles.bg}`}
        photo={image}
        alt=""
        sizes={HERO_SIZES}
        priority
        objectPosition={focus}
      />
      <div className="ui-container">
        {eyebrowHref ? (
          <p className="ui-eyebrow">
            <Link href={eyebrowHref} className={styles.back}>
              <ChevronIcon size={14} className={styles.backIcon} />
              {eyebrow}
            </Link>
          </p>
        ) : (
          <p className="ui-eyebrow">{eyebrow}</p>
        )}
        <h1 className={`ui-hero__title ${styles.title}`}>{title}</h1>
        {lead && <p className={`ui-hero__lead ${styles.lead}`}>{lead}</p>}
        {children && <div className={styles.actions}>{children}</div>}
      </div>
      <MotionToggle className={styles.motion} />
    </header>
  );
}
