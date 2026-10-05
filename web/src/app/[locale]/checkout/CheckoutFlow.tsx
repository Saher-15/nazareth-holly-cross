'use client';

import { useCallback, useMemo, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCart, type CartLine } from '@/lib/cart';
import type { PaymentPayload } from '@/lib/paypal';
import { formatUsd } from '@/lib/pricing';
import DonePanel from '@/components/checkout/DonePanel';
import Field, { invalidProps } from '@/components/checkout/Field';
import PayPalPanel from '@/components/checkout/PayPalPanel';
import StepIndicator, { type FlowStep } from '@/components/checkout/StepIndicator';
import { countryName, countryOptions } from '@/components/checkout/countries';
import { useErrorText, useSaveAfterPayment, useStepFocus, useValidatedForm } from '@/components/checkout/hooks';
import { AlertIcon, BasketIcon } from '@/components/checkout/icons';
import {
  buildOrderBody,
  emptyContact,
  hasErrors,
  LIMITS,
  validateContact,
  type ContactForm,
} from '@/components/checkout/validation';
import shared from '@/components/checkout/checkout.module.css';
import styles from './checkout.module.css';

type Key = keyof ContactForm;

// Screen order of the fields, with their element ids (used to focus the first error).
const FIELDS: [Key, string][] = [
  ['firstName', 'co-first-name'],
  ['lastName', 'co-last-name'],
  ['email', 'co-email'],
  ['confirmEmail', 'co-confirm-email'],
  ['phone', 'co-phone'],
  ['country', 'co-country'],
  ['street', 'co-street'],
  ['city', 'co-city'],
  ['state', 'co-state'],
  ['postal', 'co-postal'],
];
const id = (key: Key) => FIELDS.find(([k]) => k === key)![1];

// Product photos come from Firebase Storage (allowed in next.config.ts) or the site itself.
// ("//host/..." is a protocol-relative URL to another site, not a path of ours.)
const canOptimize = (src: string) =>
  (src.startsWith('/') && !src.startsWith('//')) || src.startsWith('https://firebasestorage.googleapis.com/');

// The shop checkout: 1) contact + delivery details, 2) order summary + PayPal, 3) thank you.
export default function CheckoutFlow() {
  const t = useTranslations('checkoutPage');
  const tr = useTranslations();
  const locale = useLocale();
  const errorText = useErrorText();
  const { lines, ready, summary, dispatch } = useCart();
  const [step, setStep] = useState<FlowStep>('details');
  const [reference, setReference] = useState('');
  const form = useValidatedForm(emptyContact, validateContact);
  const { values, set, touch, shown } = form;
  const saving = useSaveAfterPayment();
  const { save } = saving;
  const headingRef = useStepFocus<HTMLHeadingElement>(step);
  const countries = useMemo(() => countryOptions(locale), [locale]);

  const getPayload = useCallback(
    (): PaymentPayload => ({ type: 'order', items: lines.map((l) => ({ _id: l._id, quantity: l.quantity })) }),
    [lines],
  );

  const onPaid = useCallback(
    async (capture: { id: string }) => {
      setReference(capture.id);
      setStep('done');
      // paypalOrderId is the proof of payment: the API asks PayPal whether this order was captured in full
      // before it saves the order, and accepts each payment for one order only.
      await save('/order/newOrder', {
        ...buildOrderBody(values, lines, summary.total, countryName(values.country, 'en')),
        paypalOrderId: capture.id,
      });
      dispatch({ type: 'clear' });
    },
    [values, lines, summary.total, save, dispatch],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form.submit(FIELDS)) setStep('payment');
  };

  if (step === 'done') {
    return (
      <div className={`${styles.narrow} ${shared.flow}`} data-flow>
        <StepIndicator current="done" className={styles.stepsTop} />
        <DonePanel
          icon="check"
          title={tr('thankYou.thankYou')}
          headingRef={headingRef}
          reference={reference}
          saveStatus={saving.status}
          onRetry={saving.retry}
          action={
            <Link href="/shop" className="ui-btn ui-btn--gold">
              {tr('cart.continueShopping')}
            </Link>
          }
        >
          <p>{tr('thankYou.paymentSuccess')}</p>
          {saving.status === 'saved' && <p>{tr('thankYou.receipt')}</p>}
          <p className={shared.doneStrong}>{tr('thankYou.gratitude')}</p>
        </DonePanel>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={`ui-skeleton ${styles.skeleton}`} role="status">
        <span className="visually-hidden">{t('loading')}</span>
      </div>
    );
  }

  if (!lines.length) {
    return (
      <section className={`ui-glass ${styles.empty}`} aria-labelledby="co-empty-title">
        <span className={styles.emptyIcon} aria-hidden="true">
          <BasketIcon />
        </span>
        <h2 id="co-empty-title" className={styles.emptyTitle}>
          {tr('cart.emptyCart')}
        </h2>
        <p className={styles.emptyText}>{t('empty.text')}</p>
        <Link href="/shop" className="ui-btn ui-btn--gold">
          {tr('cart.backToShopping')}
        </Link>
      </section>
    );
  }

  const text = (key: Key, label: string, extra: InputHTMLAttributes<HTMLInputElement> = {}) => {
    const error = errorText(shown(key), extra.maxLength);
    return (
      <Field id={id(key)} label={label} error={error}>
        <input
          id={id(key)}
          name={key}
          className={`ui-input ${extra.dir === 'ltr' ? styles.ltr : ''}`}
          value={values[key]}
          onChange={(e) => set(key, e.target.value)}
          onBlur={() => touch(key)}
          required
          {...extra}
          {...invalidProps(id(key), error)}
        />
      </Field>
    );
  };
  const countryError = errorText(shown('country'));

  return (
    <div className={shared.flow} data-flow>
      <StepIndicator current={step} className={styles.stepsTop} />
      <div className={shared.grid}>
        <section className={`ui-glass ${shared.card}`} aria-labelledby="co-contact-title">
          <h2 id="co-contact-title" ref={headingRef} tabIndex={-1} className={shared.title}>
            {tr('paypalComponent.contactInfo')}
          </h2>

          {step === 'details' ? (
            <form className={shared.form} onSubmit={onSubmit} noValidate>
              <div className={shared.fields}>
                {text('firstName', tr('paypalComponent.firstName'), {
                  autoComplete: 'given-name',
                  maxLength: LIMITS.name,
                })}
                {text('lastName', tr('paypalComponent.lastName'), {
                  autoComplete: 'family-name',
                  maxLength: LIMITS.name,
                })}
                {text('email', tr('paypalComponent.email'), {
                  type: 'email',
                  autoComplete: 'email',
                  dir: 'ltr',
                  maxLength: LIMITS.email,
                })}
                {text('confirmEmail', tr('paypalComponent.confirmEmail'), {
                  type: 'email',
                  autoComplete: 'email',
                  dir: 'ltr',
                  maxLength: LIMITS.email,
                })}
                {text('phone', t('form.phone'), {
                  type: 'tel',
                  autoComplete: 'tel',
                  inputMode: 'tel',
                  dir: 'ltr',
                  maxLength: LIMITS.phone,
                })}
                <Field id={id('country')} label={t('form.country')} error={countryError}>
                  <select
                    id={id('country')}
                    name="country"
                    className={`ui-select ${shared.select}`}
                    value={values.country}
                    onChange={(e) => set('country', e.target.value)}
                    onBlur={() => touch('country')}
                    autoComplete="country"
                    required
                    {...invalidProps(id('country'), countryError)}
                  >
                    <option value="" disabled>
                      {tr('paypalComponent.country')}
                    </option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className={shared.wide}>
                  {text('street', tr('paypalComponent.street'), {
                    autoComplete: 'street-address',
                    maxLength: LIMITS.street,
                  })}
                </div>
                {text('city', tr('paypalComponent.city'), { autoComplete: 'address-level2', maxLength: LIMITS.city })}
                {text('state', tr('paypalComponent.state'), { autoComplete: 'address-level1', maxLength: LIMITS.state })}
                {text('postal', tr('paypalComponent.postal'), {
                  autoComplete: 'postal-code',
                  dir: 'ltr',
                  maxLength: LIMITS.postal,
                })}
              </div>

              {form.submitted && hasErrors(form.errors) && (
                <p className={`${shared.alert} ${shared.alertDanger}`} role="alert">
                  <AlertIcon />
                  {t('form.fixErrors')}
                </p>
              )}
              <div className={shared.actions}>
                <button type="submit" className={`ui-btn ui-btn--gold ${shared.btnLg} ${shared.btnBlock}`}>
                  {t('form.continue')}
                </button>
              </div>
            </form>
          ) : (
            <>
              <dl className={shared.details}>
                <div>
                  <dt>{tr('paypalComponent.firstName')}</dt>
                  <dd>{values.firstName.trim()}</dd>
                </div>
                <div>
                  <dt>{tr('paypalComponent.lastName')}</dt>
                  <dd>{values.lastName.trim()}</dd>
                </div>
                <div>
                  <dt>{tr('paypalComponent.email')}</dt>
                  <dd dir="ltr" className={styles.ltrValue}>
                    {values.email.trim()}
                  </dd>
                </div>
                <div>
                  <dt>{t('form.phone')}</dt>
                  <dd dir="ltr" className={styles.ltrValue}>
                    {values.phone.trim()}
                  </dd>
                </div>
                <div>
                  <dt>{t('summary.address')}</dt>
                  <dd>
                    {[
                      values.street.trim(),
                      `${values.city.trim()}, ${values.state.trim()} ${values.postal.trim()}`,
                      countryName(values.country, locale),
                    ].join('\n')}
                  </dd>
                </div>
              </dl>
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setStep('details')}>
                {t('form.edit')}
              </button>
            </>
          )}
        </section>

        <aside className={`ui-glass ${shared.card} ${shared.cardGold} ${shared.sticky}`} aria-labelledby="co-summary-title">
          <h2 id="co-summary-title" className={shared.title}>
            {tr('paypalComponent.summary')}
          </h2>
          <ul className={styles.items}>
            {lines.map((line) => (
              <OrderItem key={`${line._id}-${line.color}`} line={line} locale={locale} />
            ))}
          </ul>
          <dl className={shared.amounts}>
            <div>
              <dt>{t('summary.subtotal')}</dt>
              <dd>{formatUsd(summary.subtotal, locale)}</dd>
            </div>
            <div className={shared.saving}>
              <dt>{t('summary.discount')}</dt>
              <dd>{formatUsd(-summary.discount, locale)}</dd>
            </div>
            <div>
              <dt>{t('summary.shipping')}</dt>
              <dd>{formatUsd(summary.shipping, locale)}</dd>
            </div>
          </dl>
          <dl className={shared.total}>
            <dt>{t('summary.total')}</dt>
            <dd data-testid="order-total">{formatUsd(summary.total, locale)}</dd>
          </dl>

          {step === 'payment' ? (
            <>
              <h3 className={shared.payTitle}>{tr('paypalComponent.paymentMethod')}</h3>
              <PayPalPanel getPayload={getPayload} onPaid={onPaid} />
            </>
          ) : (
            <p className={`${shared.alert} ${shared.alertInfo}`}>
              <AlertIcon />
              {tr('paypalComponent.pleaseFillAllDetails')}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function OrderItem({ line, locale }: { line: CartLine; locale: string }) {
  const t = useTranslations('checkoutPage.summary');
  return (
    <li className={styles.item}>
      <span className={styles.thumb}>
        {line.img && canOptimize(line.img) && <Image src={line.img} alt="" fill sizes="52px" />}
      </span>
      <span className={styles.itemText}>
        <span className={styles.itemName}>{line.name}</span>
        <span className={styles.itemMeta}>
          {line.color ? `${line.color} · ` : ''}
          {t('quantity', { count: line.quantity })}
        </span>
      </span>
      <span className={styles.itemPrice}>{formatUsd(line.price * line.quantity, locale)}</span>
    </li>
  );
}
