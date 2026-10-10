'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { pendingFulfilment, type PendingPath } from '@/lib/pendingFulfilment';
import { moveFocus, scrollBehavior } from '@/lib/motion';
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

// The fields of a form with their element ids, in screen order (the order `submit` focuses the first
// invalid one in). `ids` lists the fields in that order: `{ firstName: 'co-first-name', ... }`.
export function fieldOrder<K extends string>(ids: Record<K, string>): [K, string][] {
  return (Object.keys(ids) as K[]).map((key) => [key, ids[key]]);
}

// Controlled form state with inline validation: a field shows its error once the visitor has typed in it and left it
// (blur), or after the first submit attempt, and the error updates as the visitor types. Only tabbing through an empty
// form shows nothing: a keyboard or screen-reader user who reads the form first must not hear "required" on every
// field (it used to flag all ten checkout fields).
export function useValidatedForm<F extends Record<string, unknown>, K extends string>(
  initial: F,
  validate: (values: F) => FormErrors<K>,
) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const changed = useRef(new Set<string>());
  const errors = validate(values);

  const set = useCallback(<P extends keyof F>(key: P, value: F[P]) => {
    changed.current.add(String(key));
    setValues((v) => ({ ...v, [key]: value }));
  }, []);
  /** The field `key` was left. It counts once the value behind it (`source`, the same name unless the form says
   *  otherwise) has been changed. */
  const touch = useCallback((key: K, source: string = key) => {
    if (!changed.current.has(source)) return;
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  }, []);

  const shown = (key: K) => (submitted || touched[key] ? errors[key] : undefined);

  /** The fields with an error, in screen order (for the summary that names them). */
  const invalid = (order: [K, string][]) => (submitted ? order.filter(([key]) => errors[key]).map(([key]) => key) : []);

  // Returns true when the form is valid; otherwise reveals every error and focuses the first
  // invalid control (`order` lists the fields in screen order with their element ids).
  const submit = (order: [K, string][]) => {
    // Rendered first (aria-invalid, the linked error texts and the summary), then focused: a screen reader reads the
    // field once, when it gets the focus, so its error must already be there (WCAG 3.3.1, 4.1.3).
    flushSync(() => setSubmitted(true));
    if (!hasErrors(errors)) return true;
    const first = order.find(([key]) => errors[key]);
    if (first) moveFocus(document.getElementById(first[1]));
    return false;
  };

  return { values, set, touch, errors, shown, submitted, submit, invalid };
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
    (el.closest('[data-flow]') ?? el).scrollIntoView({ block: 'start', behavior: scrollBehavior() });
    el.focus({ preventScroll: true });
  }, [step]);
  return ref;
}

// The PayPal ids of payments of this kind that were made (in this browser) but whose order or candle request the API
// has not confirmed yet. The checkout uses it to tell a returning customer not to pay a second time.
export function usePendingPayments(kind: 'order' | 'candle'): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const read = () =>
      setIds(
        pendingFulfilment
          .list()
          .filter((r) => r.kind === kind)
          .map((r) => r.paypalOrderId),
      );
    read();
    return pendingFulfilment.subscribe(read);
  }, [kind]);
  return ids;
}

// saving    a request to the API is in flight
// saved     the API confirmed the order / candle request: the record kept in the browser was removed
// retrying  the API could not be reached or answered with an error: the record is kept and retried by itself
//           (with a growing delay now, and on the next visit), the customer is shown their reference
// failed    the API refused it for good: a person at the shop has to look at it (the record is kept as evidence)
export type SaveStatus = 'saving' | 'saved' | 'retrying' | 'failed';

// After PayPal reports the payment as completed, the order or candle request is saved with the API. The customer
// has already paid, so nothing may depend on this call succeeding right now: the record is written to the browser
// FIRST (lib/pendingFulfilment.ts), and removed only when the API confirms it.
export function useSaveAfterPayment() {
  const [status, setStatus] = useState<SaveStatus | null>(null);
  const current = useRef<string | null>(null);

  // The engine reports every outcome of this payment, also those of its own timer after this page has moved on.
  useEffect(
    () =>
      pendingFulfilment.subscribe((event) => {
        if (event.record.paypalOrderId !== current.current) return;
        if (event.type === 'saved') setStatus('saved');
        else if (event.type === 'retry') setStatus('retrying');
        else if (event.type === 'rejected') setStatus('failed');
      }),
    [],
  );

  /** Resolves true when the API confirmed the record. `extra.cart` lets the engine empty the cart when an order is saved later. */
  const save = useCallback(async (path: PendingPath, body: Record<string, unknown>, paypalOrderId: string, extra: { cart?: string } = {}) => {
    current.current = paypalOrderId;
    setStatus('saving');
    // Persist before anything else (synchronously): a tab closed right now is recovered on the next visit.
    pendingFulfilment.add({ paypalOrderId, kind: path === '/order/newOrder' ? 'order' : 'candle', path, body, cart: extra.cart });
    const outcome = await pendingFulfilment.attempt(paypalOrderId);
    if (outcome === 'saved') setStatus('saved');
    else if (outcome === 'retry') setStatus('retrying');
    else if (outcome === 'rejected') setStatus('failed');
    // 'busy': the retry loop is sending it right now, its answer arrives through the subscription above
    return outcome === 'saved';
  }, []);

  const retry = useCallback(() => {
    const id = current.current;
    if (!id) return;
    setStatus('saving');
    void pendingFulfilment.attempt(id, { force: true });
  }, []);

  return { status, save, retry };
}
