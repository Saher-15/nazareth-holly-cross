'use client';

import { useEffect, useId, useMemo, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { countryOptions } from '@/components/checkout/countries';
import { useRouter } from '@/i18n/navigation';
import { postJson } from '@/lib/apiClient';
import {
  categoryKey,
  emptyPrayer,
  firstInvalidPrayerField,
  PRAYER_CATEGORIES,
  PRAYER_RULES,
  prayerSubmitError,
  toPrayerPayload,
  validatePrayer,
  validatePrayerField,
  type PrayerCategory,
  type PrayerErrors,
  type PrayerField,
  type PrayerSubmitError,
  type PrayerValues,
} from '@/data/pilgrim/prayers';
import { revalidatePrayers } from './actions';
import styles from './PrayerForm.module.css';

type Status = 'idle' | 'sending' | 'sent';

// Share a prayer: name, country, a category and the prayer itself, posted straight to the API from the browser.
// On success the wall is rebuilt on the server and the page refreshes, so the new prayer shows at once.
export default function PrayerForm({ titleId }: { titleId: string }) {
  const t = useTranslations('pilgrim.prayers');
  const locale = useLocale();
  // Every country, named in the visitor's language and in that language's order (Intl, nothing to translate).
  const countries = useMemo(() => countryOptions(locale), [locale]);
  const id = useId();
  const router = useRouter();
  const [values, setValues] = useState<PrayerValues>(emptyPrayer);
  const [errors, setErrors] = useState<PrayerErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [submitError, setSubmitError] = useState<PrayerSubmitError | null>(null);
  const [, startTransition] = useTransition();

  const nameRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLSelectElement>(null);
  const prayerRef = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const focusFirst = useRef(false);

  useEffect(() => {
    if (status === 'sent') doneRef.current?.focus();
    if (status === 'idle' && focusFirst.current) {
      focusFirst.current = false;
      nameRef.current?.focus();
    }
  }, [status]);

  const fieldId = (field: string) => `${id}-${field}`;
  const errorId = (field: string) => `${id}-${field}-error`;
  const counterId = `${id}-counter`;

  const onChange = (field: PrayerField) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { value } = e.target;
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: validatePrayerField(field, value) }));
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;
    const found = validatePrayer(values);
    setErrors(found);
    const invalid = firstInvalidPrayerField(found);
    if (invalid) {
      ({ name: nameRef, country: countryRef, prayer: prayerRef })[invalid].current?.focus();
      return;
    }

    setStatus('sending');
    setSubmitError(null);
    const result = await postJson('/prayer/create', toPrayerPayload(values));
    if (!result.ok) {
      setStatus('idle');
      setSubmitError(prayerSubmitError(result.status));
      return;
    }
    setValues((prev) => ({ ...emptyPrayer, name: prev.name, country: prev.country }));
    setStatus('sent');
    startTransition(async () => {
      try {
        await revalidatePrayers();
        router.refresh();
      } catch {
        // The wall still refreshes on its own within a minute.
      }
    });
  }

  const describedBy = (field: PrayerField, extra?: string) =>
    [extra, errors[field] ? errorId(field) : undefined].filter(Boolean).join(' ') || undefined;

  const fieldError = (field: PrayerField) => {
    const error = errors[field];
    if (!error) return null;
    return (
      <p id={errorId(field)} className="ui-error">
        {t(`errors.${error.key}`, error.values)}
      </p>
    );
  };

  return (
    <form className={`ui-glass ${styles.card}`} onSubmit={onSubmit} noValidate aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {t('form.title')}
      </h2>
      <p className={styles.intro}>{t('form.intro')}</p>

      {status === 'sent' ? (
        <div className={styles.done}>
          <h3 ref={doneRef} tabIndex={-1} className={styles.doneTitle}>
            {t('form.sent')}
          </h3>
          <p>{t('form.sentText')}</p>
          <button
            type="button"
            className="ui-btn ui-btn--ghost"
            onClick={() => {
              focusFirst.current = true;
              setErrors({});
              setStatus('idle');
            }}
          >
            {t('form.another')}
          </button>
        </div>
      ) : (
        <>
          <div className="ui-field">
            <label className="ui-label" htmlFor={fieldId('name')}>
              {t('form.name')}
            </label>
            <input
              ref={nameRef}
              id={fieldId('name')}
              name="name"
              type="text"
              dir="auto"
              className="ui-input"
              autoComplete="given-name"
              maxLength={PRAYER_RULES.name.max}
              required
              value={values.name}
              onChange={onChange('name')}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy('name')}
            />
            {fieldError('name')}
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor={fieldId('country')}>
              {t('form.country')}
            </label>
            <select
              ref={countryRef}
              id={fieldId('country')}
              name="country"
              className="ui-select"
              autoComplete="country"
              required
              value={values.country}
              onChange={onChange('country')}
              aria-invalid={errors.country ? true : undefined}
              aria-describedby={describedBy('country')}
            >
              <option value="" disabled>
                {t('form.countryChoose')}
              </option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            {fieldError('country')}
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor={fieldId('category')}>
              {t('form.category')}
            </label>
            <select
              id={fieldId('category')}
              name="category"
              className="ui-select"
              value={values.category}
              onChange={(e) => setValues((prev) => ({ ...prev, category: e.target.value as PrayerCategory }))}
            >
              {PRAYER_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {t(`categories.${categoryKey(category)}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor={fieldId('prayer')}>
              {t('form.prayer')}
            </label>
            <textarea
              ref={prayerRef}
              id={fieldId('prayer')}
              name="prayer"
              rows={5}
              dir="auto"
              className="ui-textarea"
              maxLength={PRAYER_RULES.prayer.max}
              required
              value={values.prayer}
              onChange={onChange('prayer')}
              aria-invalid={errors.prayer ? true : undefined}
              aria-describedby={describedBy('prayer', counterId)}
            />
            <div className={styles.under}>
              {fieldError('prayer')}
              <p id={counterId} className={styles.counter}>
                {t('form.counter', { count: values.prayer.length, max: PRAYER_RULES.prayer.max })}
              </p>
            </div>
          </div>

          <p className={styles.public}>{t('form.public')}</p>

          {submitError && (
            <p className={styles.alert} role="alert">
              {t(`errors.${submitError}`)}
            </p>
          )}

          <button
            type="submit"
            className={`ui-btn ui-btn--gold ${styles.submit}`}
            disabled={status === 'sending'}
            aria-busy={status === 'sending' || undefined}
          >
            {status === 'sending' ? t('form.sending') : t('form.submit')}
          </button>
        </>
      )}
    </form>
  );
}
