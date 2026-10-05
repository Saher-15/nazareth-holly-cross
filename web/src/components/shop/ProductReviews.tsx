'use client';

import { useMemo, useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { NAZARETH_TIME_ZONE } from '@/lib/time';
import Stars from '@/components/ui/Stars';
import type { ProductReview, ProductReviews as ReviewsData } from '@/lib/api';
import { mergeReviews } from '@/lib/shop/reviews';
import { revalidateProduct } from './actions';
import ProductReviewForm from './ProductReviewForm';
import ShopIcon from './ShopIcon';
import styles from './ProductReviews.module.css';

const FIRST_PAGE = 6;

type Props = {
  productId: string;
  productName: string;
  /** null when the reviews could not be loaded. */
  initial: ReviewsData | null;
};

// The reviews section of a product page: average and 5-to-1 breakdown, the reviews
// (newest first) and the write-a-review form. A review the visitor posts shows up
// at once; the page is then refreshed from the server in the background.
export default function ProductReviews({ productId, productName, initial }: Props) {
  const t = useTranslations('shopFeatures.reviews');
  const format = useFormatter();
  const router = useRouter();
  const [posted, setPosted] = useState<ProductReview[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();

  const { summary, reviews } = useMemo(() => mergeReviews(initial, posted), [initial, posted]);
  const shown = expanded ? reviews : reviews.slice(0, FIRST_PAGE);
  const rating = format.number(summary.avg, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const onPosted = (review: ProductReview) => {
    setPosted((list) => [review, ...list]);
    startTransition(async () => {
      try {
        await revalidateProduct(productId);
      } catch {
        // the page still refreshes on its own within a few minutes
      }
      router.refresh();
    });
  };

  return (
    <section id="reviews" className={`ui-container ${styles.section}`} aria-labelledby="reviews-title">
      <h2 id="reviews-title" className={styles.heading}>
        {t('title')}
      </h2>

      <div className={styles.layout}>
        <div className={styles.side}>
          {initial === null && posted.length === 0 ? (
            <p className={`ui-glass ${styles.unavailable}`} role="status">
              <ShopIcon name="alert" />
              <span>{t('unavailable')}</span>
            </p>
          ) : summary.count > 0 ? (
            <div className={`ui-glass ${styles.summary}`} data-testid="review-summary">
              <p className={styles.average}>
                <span className={styles.avgNumber}>{rating}</span>
                <span className={styles.outOf}>{t('outOf')}</span>
              </p>
              <Stars value={summary.avg} size="lg" label={t('starsLabel', { rating })} />
              <p className={styles.basedOn}>{t('basedOn', { count: summary.count })}</p>
              <ul className={styles.bars} aria-label={t('breakdown')}>
                {summary.rows.map((row) => (
                  <li key={row.stars} className={styles.bar}>
                    <span className={styles.barStars} aria-hidden="true">
                      {format.number(row.stars)}★
                    </span>
                    <span className={styles.track} aria-hidden="true">
                      <span className={styles.fill} style={{ inlineSize: `${row.share}%` }} />
                    </span>
                    <span className={styles.barCount} aria-hidden="true">
                      {format.number(row.count)}
                    </span>
                    <span className="visually-hidden">{t('breakdownRow', { stars: row.stars, count: row.count })}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={`ui-glass ${styles.summary}`}>
              <p className={styles.emptyTitle}>{t('emptyTitle')}</p>
              <p className={styles.emptyText}>{t('emptyText')}</p>
            </div>
          )}
          <a href="#write-review" className={`ui-btn ui-btn--glass ${styles.writeLink}`}>
            <ShopIcon name="pen" />
            {t('form.heading')}
          </a>
        </div>

        <div className={styles.main}>
          {reviews.length > 0 && (
            <>
              <ol className={styles.list} aria-label={t('listLabel')} data-testid="review-list">
                {shown.map((review, i) => (
                  <li key={review._id ?? `${review.name}-${i}`} className={`ui-glass ${styles.review}`}>
                    <article aria-label={t('reviewBy', { name: review.name })}>
                      <Stars
                        value={review.rating}
                        label={t('starsLabel', { rating: format.number(review.rating) })}
                      />
                      {/* Reviewer text is isolated with dir="auto" on its own block (a <bdi> inside
                          would hide the text from the block's direction detection). */}
                      {review.title && (
                        <h3 className={styles.reviewTitle} dir="auto">
                          {review.title}
                        </h3>
                      )}
                      <p className={styles.comment} dir="auto">
                        {review.comment}
                      </p>
                      <p className={styles.meta}>
                        <bdi className={styles.author}>{review.name}</bdi>
                        {review.country && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <bdi>{review.country}</bdi>
                          </>
                        )}
                        {review.createdAt && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <time dateTime={review.createdAt}>
                              {format.dateTime(new Date(review.createdAt), {
                                dateStyle: 'medium',
                                timeZone: NAZARETH_TIME_ZONE,
                              })}
                            </time>
                          </>
                        )}
                      </p>
                    </article>
                  </li>
                ))}
              </ol>
              {reviews.length > FIRST_PAGE && (
                <button
                  type="button"
                  className={`ui-btn ui-btn--ghost ${styles.more}`}
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                >
                  {expanded ? t('showFewer') : t('showAll', { count: reviews.length })}
                </button>
              )}
            </>
          )}

          <ProductReviewForm productId={productId} productName={productName} onPosted={onPosted} />
        </div>
      </div>
    </section>
  );
}
