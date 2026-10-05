'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { postJson } from '@/lib/apiClient';
import { formatUsd } from '@/lib/pricing';
import { DONATION_MAX, DONATION_MIN, hasErrors, type FieldError, type FormErrors } from './validation';

// The visitor-facing text for a validation error code.
export function useErrorText() {
  const t = useTranslations();
  const locale = useLocale();
  return useCallback(
    (code: FieldError | undefined, max = 0): string | undefined => {
      switch (code) {
        case undefined:
          return undefined;
        case 'emailMismatch':
          return t('paypalComponent.emailsDontMatch');
        case 'church':
          return t('candle.inputWarning');
        case 'tooLong':
          return t('checkoutPage.form.errors.tooLong', { max });
        case 'amount':
          return t('checkoutPage.form.errors.amount', {
            min: formatUsd(DONATION_MIN, locale),
            max: formatUsd(DONATION_MAX, locale),
          });
        default:
          return t(`checkoutPage.form.errors.${code}`);
      }
    },
    [t, locale],
  );
}

// Controlled form state with inline validation: a field shows its error once it has been
// left (blur) or after the first submit attempt, and the error updates as the visitor types.
export function useValidatedForm<F extends Record<string, unknown>, K extends string>(
  initial: F,
  validate: (values: F) => FormErrors<K>,
) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const errors = validate(values);

  const set = useCallback(<P extends keyof F>(key: P, value: F[P]) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);
  const touch = useCallback((key: K) => {
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  }, []);

  const shown = (key: K) => (submitted || touched[key] ? errors[key] : undefined);

  // Returns true when the form is valid; otherwise reveals every error and focuses the first
  // invalid control (`order` lists the fields in screen order with their element ids).
  const submit = (order: [K, string][]) => {
    setSubmitted(true);
    if (!hasErrors(errors)) return true;
    const first = order.find(([key]) => errors[key]);
    if (first) document.getElementById(first[1])?.focus();
    return false;
  };

  return { values, set, touch, errors, shown, submitted, submit };
}

// When the step changes: scrolls the flow (marked data-flow, so the step indicator shows)
// into view and moves keyboard and screen-reader focus to the new step's heading.
export function useStepFocus<T extends HTMLElement>(step: string) {
  const ref = useRef<T>(null);
  const previous = useRef(step);
  useEffect(() => {
    if (previous.current === step) return;
    previous.current = step;
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    (el.closest('[data-flow]') ?? el).scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
  }, [step]);
  return ref;
}

export type SaveStatus = 'saving' | 'saved' | 'failed';

// After PayPal reports the payment as completed, the order or candle request is saved
// with the API. If that fails the visitor has still paid, so they can try again.
export function useSaveAfterPayment() {
  const [status, setStatus] = useState<SaveStatus | null>(null);
  const last = useRef<{ path: string; body: unknown } | null>(null);

  const save = useCallback(async (path: string, body: unknown) => {
    last.current = { path, body };
    setStatus('saving');
    const res = await postJson(path, body);
    setStatus(res.ok ? 'saved' : 'failed');
    return res.ok;
  }, []);

  const retry = useCallback(() => {
    if (last.current) void save(last.current.path, last.current.body);
  }, [save]);

  return { status, save, retry };
}
