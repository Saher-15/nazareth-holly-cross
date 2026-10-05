'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { postJson } from '@/lib/apiClient';
import {
  CONTACT_FIELDS,
  CONTACT_RULES,
  contactSubmitError,
  emptyContact,
  firstInvalidContactField,
  toContactPayload,
  validateContact,
  validateContactField,
  type ContactErrors,
  type ContactField,
  type ContactSubmitError,
  type ContactValues,
} from '@/data/pilgrim/contact';
import styles from './PrayerForm.module.css';

type Status = 'idle' | 'sending' | 'sent';

const AUTOCOMPLETE: Record<ContactField, string> = { fullName: 'name', email: 'email', phone: 'tel', msg: 'off' };
const INPUT_TYPE: Partial<Record<ContactField, string>> = { email: 'email', phone: 'tel' };

// Write to us: name, e-mail, phone and message, posted straight to the API from the browser
// (POST /contact/contact_us_request). Every state is announced: invalid fields, sending, sent, and a refusal
// by the API (too many requests, rejected input, no connection, server error).
export default function ContactForm({ titleId }: { titleId: string }) {
  const t = useTranslations('pilgrim.contact');
  const id = useId();
  const [values, setValues] = useState<ContactValues>(emptyContact);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [submitError, setSubmitError] = useState<ContactSubmitError | null>(null);
  const refs = useRef<Record<ContactField, HTMLInputElement | HTMLTextAreaElement | null>>({
    fullName: null,
    email: null,
    phone: null,
    msg: null,
  });
  const doneRef = useRef<HTMLHeadingElement>(null);
  const focusFirst = useRef(false);

  useEffect(() => {
    if (status === 'sent') doneRef.current?.focus();
    if (status === 'idle' && focusFirst.current) {
      focusFirst.current = false;
      refs.current.fullName?.focus();
    }
  }, [status]);

  const fieldId = (field: ContactField) => `${id}-${field}`;
  const errorId = (field: ContactField) => `${id}-${field}-error`;
  const counterId = `${id}-counter`;

  const onChange = (field: ContactField) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { value } = e.target;
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: validateContactField(field, value) }));
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;
    const found = validateContact(values);
    setErrors(found);
    const invalid = firstInvalidContactField(found);
    if (invalid) {
      refs.current[invalid]?.focus();
      return;
    }
    setStatus('sending');
    setSubmitError(null);
    const result = await postJson('/contact/contact_us_request', toContactPayload(values));
    if (!result.ok) {
      setStatus('idle');
      setSubmitError(contactSubmitError(result.status));
      return;
    }
    setValues(emptyContact);
    setStatus('sent');
  }

  const describedBy = (field: ContactField, extra?: string) =>
    [extra, errors[field] ? errorId(field) : undefined].filter(Boolean).join(' ') || undefined;

  const fieldError = (field: ContactField) => {
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
          {CONTACT_FIELDS.map((field) => {
            const common = {
              id: fieldId(field),
              name: field,
              dir: field === 'email' || field === 'phone' ? ('ltr' as const) : ('auto' as const),
              maxLength: CONTACT_RULES[field].max,
              required: true,
              value: values[field],
              onChange: onChange(field),
              'aria-invalid': errors[field] ? (true as const) : undefined,
              'aria-describedby': describedBy(field, field === 'msg' ? counterId : undefined),
              autoComplete: AUTOCOMPLETE[field],
            };
            return (
              <div className="ui-field" key={field}>
                <label className="ui-label" htmlFor={fieldId(field)}>
                  {t(`form.${field}`)}
                </label>
                {field === 'msg' ? (
                  <textarea
                    {...common}
                    ref={(el) => {
                      refs.current[field] = el;
                    }}
                    rows={6}
                    className="ui-textarea"
                  />
                ) : (
                  <input
                    {...common}
                    ref={(el) => {
                      refs.current[field] = el;
                    }}
                    type={INPUT_TYPE[field] ?? 'text'}
                    className="ui-input"
                  />
                )}
                {field === 'phone' && <p className={styles.hint}>{t('form.phoneHint')}</p>}
                {field === 'msg' ? (
                  <div className={styles.under}>
                    {fieldError(field)}
                    <p id={counterId} className={styles.counter}>
                      {t('form.counter', { count: values.msg.length, max: CONTACT_RULES.msg.max })}
                    </p>
                  </div>
                ) : (
                  fieldError(field)
                )}
              </div>
            );
          })}

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
