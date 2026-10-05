'use client';

import { useEffect, useId, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { postJson } from '@/lib/apiClient';
import { revalidateReviews } from './actions';
import Icon from './Icon';
import {
  emptyReview,
  firstInvalidField,
  REVIEW_RULES,
  submitErrorKey,
  toReviewPayload,
  validateField,
  validateReview,
  type ReviewErrors,
  type ReviewField,
  type ReviewValues,
  type SubmitErrorKey,
} from './reviewRules';
import styles from './ReviewForm.module.css';

type Status = 'idle' | 'sending' | 'sent';

// The share-a-review card: name, where the visitor is from and the review itself, posted straight to the
// API from the browser. On success the wall is rebuilt on the server (revalidateReviews).
export default function ReviewForm({ titleId }: { titleId: string }) {
  const t = useTranslations('pray');
  const tf = useTranslations('communityPage.reviews.form');
  const id = useId();
  const [values, setValues] = useState<ReviewValues>(emptyReview);
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [submitError, setSubmitError] = useState<SubmitErrorKey | null>(null);
  const [, startTransition] = useTransition();

  const nameRef = useRef<HTMLInputElement>(null);
  const placeRef = useRef<HTMLInputElement>(null);
  const msgRef = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const firstFieldAfterReset = useRef(false);

  useEffect(() => {
    if (status === 'sent') doneRef.current?.focus();
    if (status === 'idle' && firstFieldAfterReset.current) {
      firstFieldAfterReset.current = false;
      nameRef.current?.focus();
    }
  }, [status]);

  const fieldId = (field: ReviewField) => `${id}-${field}`;
  const errorId = (field: ReviewField) => `${id}-${field}-error`;
  const counterId = `${id}-msg-counter`;

  const focusField = (field: ReviewField) => {
    const refs = { fullName: nameRef, place: placeRef, msg: msgRef };
    refs[field].current?.focus();
  };

  const onChange = (field: ReviewField) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { value } = e.target;
    setValues((prev) => ({ ...prev, [field]: value }));
    // Once a field was flagged, re-check it while the visitor fixes it.
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
  };

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
    const result = await postJson('/review/addReview', toReviewPayload(values));
    if (!result.ok) {
      setStatus('idle');
      setSubmitError(submitErrorKey(result.status));
      return;
    }

    setValues(emptyReview);
    setStatus('sent');
    startTransition(async () => {
      try {
        await revalidateReviews();
      } catch {
        // The wall still refreshes on its own within two minutes.
      }
    });
  }

  const describedBy = (field: ReviewField, extra?: string) =>
    [extra, errors[field] ? errorId(field) : undefined].filter(Boolean).join(' ') || undefined;

  const fieldError = (field: ReviewField) => {
    const error = errors[field];
    if (!error) return null;
    return (
      <p id={errorId(field)} className={`ui-error ${styles.fieldError}`}>
        {tf(`errors.${error.key}`, error.values)}
      </p>
    );
  };

  return (
    <form className={`ui-glass ${styles.card}`} onSubmit={onSubmit} noValidate aria-labelledby={titleId}>
      <span className={styles.mark} aria-hidden="true">
        &ldquo;
      </span>
      <h2 id={titleId} className={styles.title}>
        {t('formTitle')}
      </h2>
      <p className={styles.intro}>{t('formDescription')}</p>

      {status === 'sent' ? (
        <div className={styles.done}>
          <span className={styles.doneIcon} aria-hidden="true">
            <Icon name="check" />
          </span>
          <h3 ref={doneRef} tabIndex={-1} className={styles.doneTitle}>
            {t('successMessage')}
          </h3>
          <p>{t('confirmationMessage')}</p>
          <button
            type="button"
            className={`ui-btn ui-btn--ghost ${styles.again}`}
            onClick={() => {
              firstFieldAfterReset.current = true;
              setErrors({});
              setStatus('idle');
            }}
          >
            {tf('another')}
          </button>
        </div>
      ) : (
        <>
          <div className="ui-field">
            <label className="ui-label" htmlFor={fieldId('fullName')}>
              {t('placeholderFullName')}
            </label>
            <input
              ref={nameRef}
              id={fieldId('fullName')}
              name="fullName"
              type="text"
              dir="auto"
              className="ui-input"
              autoComplete="name"
              maxLength={REVIEW_RULES.fullName.max}
              required
              value={values.fullName}
              onChange={onChange('fullName')}
              aria-invalid={errors.fullName ? true : undefined}
              aria-describedby={describedBy('fullName')}
            />
            {fieldError('fullName')}
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor={fieldId('place')}>
              {t('placeholderCountry')}
            </label>
            <input
              ref={placeRef}
              id={fieldId('place')}
              name="place"
              type="text"
              dir="auto"
              className="ui-input"
              autoComplete="country-name"
              maxLength={REVIEW_RULES.place.max}
              required
              value={values.place}
              onChange={onChange('place')}
              aria-invalid={errors.place ? true : undefined}
              aria-describedby={describedBy('place')}
            />
            {fieldError('place')}
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor={fieldId('msg')}>
              {t('placeholderMessage')}
            </label>
            <textarea
              ref={msgRef}
              id={fieldId('msg')}
              name="msg"
              rows={5}
              dir="auto"
              className="ui-textarea"
              maxLength={REVIEW_RULES.msg.max}
              required
              value={values.msg}
              onChange={onChange('msg')}
              aria-invalid={errors.msg ? true : undefined}
              aria-describedby={describedBy('msg', counterId)}
            />
            <div className={styles.under}>
              {fieldError('msg')}
              <p id={counterId} className={styles.counter}>
                {tf('counter', { count: values.msg.length, max: REVIEW_RULES.msg.max })}
              </p>
            </div>
          </div>

          {submitError && (
            <p className={styles.alert} role="alert">
              <Icon name="alert" className={styles.alertIcon} />
              <span>{tf(`errors.${submitError}`)}</span>
            </p>
          )}

          <button
            type="submit"
            className={`ui-btn ui-btn--gold ${styles.submit}`}
            disabled={status === 'sending'}
            aria-busy={status === 'sending' || undefined}
          >
            <Icon name="feather" />
            {status === 'sending' ? tf('sending') : t('submitButton')}
          </button>
        </>
      )}
    </form>
  );
}
