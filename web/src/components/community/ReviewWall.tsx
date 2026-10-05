import { useFormatter, useTranslations } from 'next-intl';
import type { Review } from '@/lib/api';
import Icon from './Icon';
import { reviewerPlace } from '@/lib/reviews';
import { NAZARETH_TIME_ZONE } from '@/lib/time';
import styles from './ReviewWall.module.css';

/** The first letter of a name for the avatar (whole characters, so emoji and accents stay intact). */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : '·';
}

/**
 * 'hebrew' or 'arabic' when visitor-written text uses that script, so it gets a typeface drawn for it
 * (and no fake italic) whatever the page language is.
 */
export function scriptOf(text: string): 'hebrew' | 'arabic' | undefined {
  if (/[֐-׿יִ-ﭏ]/.test(text)) return 'hebrew';
  if (/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(text)) return 'arabic';
  return undefined;
}

function ReviewCard({ review }: { review: Review }) {
  const format = useFormatter();
  const place = reviewerPlace(review);
  const created = review.createdAt ? new Date(review.createdAt) : null;
  const hasDate = created !== null && !Number.isNaN(created.getTime());

  return (
    <figure className={styles.figure}>
      <blockquote className={styles.text} dir="auto" data-script={scriptOf(review.msg)}>
        {review.msg}
      </blockquote>
      <figcaption className={styles.by}>
        <span className={styles.avatar} aria-hidden="true" data-script={scriptOf(review.fullName)}>
          {initialOf(review.fullName)}
        </span>
        <span className={styles.who}>
          <span className={styles.name} dir="auto" data-script={scriptOf(review.fullName)}>
            {review.fullName}
          </span>
          {place && (
            <span className={styles.place} dir="auto" data-script={scriptOf(place)}>
              <Icon name="mapPin" className={styles.pin} />
              {place}
            </span>
          )}
          {hasDate && (
            <time className={styles.date} dateTime={created.toISOString()}>
              {format.dateTime(created, {
                month: 'long',
                year: 'numeric',
                timeZone: NAZARETH_TIME_ZONE,
              })}
            </time>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

type Props = {
  /** Approved reviews, newest first; null when the API could not be reached. */
  reviews: Review[] | null;
  titleId: string;
};

// Approved reviews as a masonry wall of quote cards, with an empty and an unavailable state.
export default function ReviewWall({ reviews, titleId }: Props) {
  const t = useTranslations('pray');
  const tr = useTranslations('communityPage.reviews');

  return (
    <section className={styles.wall} aria-labelledby={titleId}>
      <header className={styles.head}>
        <h2 id={titleId} className={`ui-eyebrow ${styles.heading}`}>
          {t('messagesTitle')}
        </h2>
        {reviews && reviews.length > 0 && (
          <span className={styles.count} aria-hidden="true">
            {reviews.length}
          </span>
        )}
      </header>

      {reviews && reviews.length > 0 ? (
        <ul className={styles.grid}>
          {reviews.map((review) => (
            <li key={review._id} className={styles.quote}>
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty} data-state={reviews ? 'empty' : 'unavailable'}>
          <span className={styles.emptyMark} aria-hidden="true">
            &ldquo;
          </span>
          <p className={styles.emptyTitle}>{reviews ? t('noMessages') : tr('unavailableTitle')}</p>
          <p className={styles.emptyHint}>{reviews ? tr('emptyHint') : tr('unavailableHint')}</p>
        </div>
      )}
    </section>
  );
}
