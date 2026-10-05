'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { productReviewSchema, type ProductReview } from '@/lib/api';
import { postJson } from '@/lib/apiClient';
import {
  emptyReview,
  firstInvalidField,
  REVIEW_LIMITS,
  submitErrorKey,
  toReviewPayload,
  validateReview,
  validateReviewField,
  type ReviewErrors,
  type ReviewField,
  type ReviewTextField,
  type ReviewValues,
  type SubmitErrorKey,
} from '@/lib/shop/reviews';
import ShopIcon from './ShopIcon';
import styles from './ProductReviewForm.module.css';

type Status = 'idle' | 'sending' | 'sent';

type Props = {
  productId: string;
  productName: string;
  onPosted: (review: ProductReview) => void;
};

const STARS = [1, 2, 3, 4, 5] as const;

// Write-a-review form, posted straight to the API from the browser. Checks the same
// limits as the API before sending, explains a refusal (invalid, too many reviews,
// no connection) and keeps what the visitor wrote when sending fails.
export default function ProductReviewForm({ productId, productName, onPosted }: Props) {
  const t = useTranslations('shopFeatures.reviews.form');
  const id = useId();
  const [values, setValues] = useState<ReviewValues>(emptyReview);
  const [website, setWebsite] = useState(''); // honeypot: hidden from people, filled in by bots
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [submitError, setSubmitError] = useState<SubmitErrorKey | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (status === 'sent') doneRef.current?.focus();
  }, [status]);

  // The rating's id is its first star, so focusing "the rating" lands on the radio group.
  const fieldId = (field: ReviewField) => (field === 'rating' ? `${id}-rating-1` : `${id}-${field}`);
  const errorId = (field: ReviewField) => `${id}-${field}-error`;
  const counterId = `${id}-counter`;
  const focusField = (field: ReviewField) => document.getElementById(fieldId(field))?.focus();

  const update = (next: ReviewValues, field: ReviewField) => {
    setValues(next);
    // Once a field was flagged, re-check it while the visitor fixes it.
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: validateReviewField(field, next) }));
  };
  const onText = (field: ReviewTextField) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    update({ ...values, [field]: e.target.value }, field);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;

    const found = validateReview(values);
    setErrors(found);
    const invalid = firstInvalidField(found);
    if (invalid) {
      focusField(invalid);
      return;
    }

    setStatus('sending');
    setSubmitError(null);
    const payload = toReviewPayload(values, website);
    const result = await postJson<unknown>(`/product/${encodeURIComponent(productId)}/reviews`, payload);
    if (!result.ok) {
      setStatus('idle');
      setSubmitError(submitErrorKey(result.status));
      return;
    }

    // Show the review at once: the API's copy when it sent one back, else what was typed.
    const parsed = productReviewSchema.safeParse(result.data);
    onPosted(
      parsed.success
        ? parsed.data
        : {
            name: payload.name,
            country: payload.country,
            rating: payload.rating,
            title: payload.title,
            comment: payload.comment,
            createdAt: new Date().toISOString(),
          },
    );
    setValues(emptyReview);
    setErrors({});
    setStatus('sent');
  }

  const describedBy = (field: ReviewField, extra?: string) =>
    [extra, errors[field] ? errorId(field) : undefined].filter(Boolean).join(' ') || undefined;

  const fieldError = (field: ReviewField) => {
    const error = errors[field];
    if (!error) return null;
    return (
      <p id={errorId(field)} className={`ui-error ${styles.fieldError}`}>
        {t(`errors.${error.key}`, error.values)}
      </p>
    );
  };

  const textField = (field: 'name' | 'country' | 'title', autoComplete: string, required = false) => (
    <div className={`ui-field ${styles.field}`}>
      <label className="ui-label" htmlFor={fieldId(field)}>
        {t(`fields.${field}`)}
      </label>
      <input
        id={fieldId(field)}
        name={field}
        type="text"
        dir="auto"
        className="ui-input"
        autoComplete={autoComplete}
        maxLength={REVIEW_LIMITS[field].max}
        required={required}
        aria-required={required || undefined}
        value={values[field]}
        onChange={onText(field)}
        aria-invalid={errors[field] ? true : undefined}
        aria-describedby={describedBy(field)}
      />
      {fieldError(field)}
    </div>
  );

  const shownStars = hover ?? values.rating ?? 0;

  return (
    <form
      id="write-review"
      className={`ui-glass ${styles.card}`}
      onSubmit={onSubmit}
      noValidate
      aria-labelledby={`${id}-title`}
      data-testid="review-form"
    >
      <h3 id={`${id}-title`} className={styles.title}>
        {t('heading')}
      </h3>
      <p className={styles.intro}>{t('intro', { name: productName })}</p>

      {status === 'sent' ? (
        <div className={styles.done}>
          <p ref={doneRef} tabIndex={-1} className={styles.doneTitle} role="status">
            <ShopIcon name="check" className={styles.doneIcon} />
            <span>{t('success')}</span>
          </p>
          <button
            type="button"
            className={`ui-btn ui-btn--ghost ${styles.again}`}
            onClick={() => {
              setStatus('idle');
              requestAnimationFrame(() => focusField('name'));
            }}
          >
            {t('another')}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.row}>
            {textField('name', 'name', true)}
            {textField('country', 'country-name')}
          </div>

          <fieldset
            className={styles.rating}
            aria-describedby={errors.rating ? errorId('rating') : undefined}
            aria-invalid={errors.rating ? true : undefined}
          >
            <legend className="ui-label">{t('fields.rating')}</legend>
            <div className={styles.stars} onPointerLeave={() => setHover(null)}>
              {STARS.map((n) => (
                <label
                  key={n}
                  className={styles.star}
                  data-on={n <= shownStars}
                  onPointerEnter={() => setHover(n)}
                >
                  <input
                    id={`${id}-rating-${n}`}
                    type="radio"
                    name={`${id}-rating`}
                    value={n}
                    className={styles.starInput}
                    checked={values.rating === n}
                    onChange={() => update({ ...values, rating: n }, 'rating')}
                  />
                  <span aria-hidden="true">★</span>
                  <span className="visually-hidden">{t('star', { count: n })}</span>
                </label>
              ))}
              <span className={styles.ratingText} aria-hidden="true">
                {shownStars ? t('star', { count: shownStars }) : ''}
              </span>
            </div>
            {fieldError('rating')}
          </fieldset>

          {textField('title', 'off')}

          <div className={`ui-field ${styles.field}`}>
            <label className="ui-label" htmlFor={fieldId('comment')}>
              {t('fields.comment')}
            </label>
            <textarea
              id={fieldId('comment')}
              name="comment"
              rows={5}
              dir="auto"
              className="ui-textarea"
              maxLength={REVIEW_LIMITS.comment.max}
              required
              aria-required
              value={values.comment}
              onChange={onText('comment')}
              aria-invalid={errors.comment ? true : undefined}
              aria-describedby={describedBy('comment', counterId)}
            />
            <div className={styles.under}>
              {fieldError('comment')}
              <p id={counterId} className={styles.counter}>
                {t('counter', { count: values.comment.length, max: REVIEW_LIMITS.comment.max })}
              </p>
            </div>
          </div>

          {/* Honeypot: off-screen and skipped by keyboard and screen readers; bots fill it in. */}
          <div className={styles.trap} aria-hidden="true">
            <label htmlFor={`${id}-website`}>{t('website')}</label>
            <input
              id={`${id}-website`}
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {submitError && (
            <p className={styles.alert} role="alert" data-testid="review-error">
              <ShopIcon name="alert" className={styles.alertIcon} />
              <span>{t(`errors.${submitError}`)}</span>
            </p>
          )}

          <button
            type="submit"
            className={`ui-btn ui-btn--gold ${styles.submit}`}
            disabled={status === 'sending'}
            aria-busy={status === 'sending' || undefined}
          >
            <ShopIcon name="pen" />
            {status === 'sending' ? t('sending') : t('submit')}
          </button>
        </>
      )}
    </form>
  );
}
