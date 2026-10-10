'use client';

import { useCallback, useMemo, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCart, type CartLine } from '@/lib/cart';
import { isOptimizable } from '@/lib/images';
import { CONTACT_EMAIL } from '@/lib/config';
import { cartSignature } from '@/lib/pendingFulfilment';
import type { PaymentPayload } from '@/lib/paypal';
import { formatUsd } from '@/lib/pricing';
import DonePanel from '@/components/checkout/DonePanel';
import Field, { invalidProps, TextField } from '@/components/checkout/Field';
import PayPalPanel from '@/components/checkout/LazyPayPalPanel';
import StepIndicator, { type FlowStep } from '@/components/checkout/StepIndicator';
import CurrencyNote from '@/components/intl/CurrencyNote';
import ErrorSummary from '@/components/checkout/ErrorSummary';
import { countryName, countryOptions } from '@/components/checkout/countries';
import { fieldOrder, useErrorText, usePendingPayments, useSaveAfterPayment, useStepFocus, useValidatedForm } from '@/components/checkout/hooks';
import { BasketIcon } from '@/components/checkout/icons';
import {
  buildOrderBody,
  emptyContact,
  LIMITS,
  validateContact,
  type ContactForm,
} from '@/components/checkout/validation';
import shared from '@/components/checkout/checkout.module.css';
import Notice from '@/components/ui/Notice';
import styles from './checkout.module.css';

type Key = keyof ContactForm;

// Element ids of the fields, in screen order (the first invalid one gets the focus).
const IDS: Record<Key, string> = {
  firstName: 'co-first-name',
  lastName: 'co-last-name',
  email: 'co-email',
  confirmEmail: 'co-confirm-email',
  phone: 'co-phone',
  country: 'co-country',
  street: 'co-street',
  city: 'co-city',
  state: 'co-state',
  postal: 'co-postal',
};
const ORDER = fieldOrder(IDS);
const id = (key: Key) => IDS[key];


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
  // A payment of this browser whose order is not saved yet (the API was down): its cart is still here, and paying again would charge twice.
  const unsaved = usePendingPayments('order');
  const { save } = saving;
  const headingRef = useStepFocus<HTMLHeadingElement>(step);
  const countries = useMemo(() => countryOptions(locale), [locale]);

  const getPayload = useCallback(
    (): PaymentPayload => ({ type: 'order', items: lines.map((l) => ({ _id: l._id, quantity: l.quantity, color: l.color })),
      fulfilment: buildOrderBody(values, lines, summary.total, countryName(values.country, 'en')), cart: cartSignature(lines) }),
    [lines, values, summary.total],
  );

  const onPaid = useCallback(
    async (capture: { id: string }) => {
      setReference(capture.id);
      setStep('done');
      // The payment id is the proof of payment (the API asks PayPal whether this order was captured in full before
      // it saves the order, and accepts each payment for one order only). `save` writes the order to this browser
      // first and keeps retrying until the API confirms it (lib/pendingFulfilment.ts). The cart is emptied only
      // when the order is confirmed saved, never before: if it is saved later, the retry loop empties it then.
      const saved = await save('/order/newOrder', buildOrderBody(values, lines, summary.total, countryName(values.country, 'en')), capture.id, {
        cart: cartSignature(lines),
      });
      if (saved) dispatch({ type: 'clear' });
    },
    [values, lines, summary.total, save, dispatch],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form.submit(ORDER)) setStep('payment');
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

  // The fields' names, for their labels and for the error summary.
  const labels: Record<Key, string> = {
    firstName: tr('paypalComponent.firstName'),
    lastName: tr('paypalComponent.lastName'),
    email: tr('paypalComponent.email'),
    confirmEmail: tr('paypalComponent.confirmEmail'),
    phone: t('form.phone'),
    country: t('form.country'),
    street: tr('paypalComponent.street'),
    city: tr('paypalComponent.city'),
    state: tr('paypalComponent.state'),
    postal: tr('paypalComponent.postal'),
  };
  const text = (key: Key, label: string, extra: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <TextField
      id={id(key)}
      name={key}
      label={label}
      error={errorText(shown(key), extra.maxLength)}
      value={values[key]}
      onChange={(e) => set(key, e.target.value)}
      onBlur={() => touch(key)}
      {...extra}
    />
  );
  const countryError = errorText(shown('country'));

  return (
    <div className={shared.flow} data-flow>
      {unsaved.length > 0 && (
        <Notice tone="info" role="status">
          {tr('checkoutPage.pending.waiting', { id: unsaved[0], email: CONTACT_EMAIL })}
        </Notice>
      )}
      <StepIndicator current={step} className={styles.stepsTop} />
      <div className={shared.grid}>
        <section className={`ui-glass ${shared.card}`} aria-labelledby="co-contact-title">
          <h2 id="co-contact-title" ref={headingRef} tabIndex={-1} className={shared.title}>
            {tr('paypalComponent.contactInfo')}
          </h2>

          {step === 'details' ? (
            <form className={shared.form} onSubmit={onSubmit} noValidate>
              <div className={shared.fields}>
                {text('firstName', labels.firstName, {
                  autoComplete: 'given-name',
                  maxLength: LIMITS.name,
                })}
                {text('lastName', labels.lastName, {
                  autoComplete: 'family-name',
                  maxLength: LIMITS.name,
                })}
                {text('email', labels.email, {
                  type: 'email',
                  autoComplete: 'email',
                  dir: 'ltr',
                  maxLength: LIMITS.email,
                })}
                {text('confirmEmail', labels.confirmEmail, {
                  type: 'email',
                  autoComplete: 'email',
                  dir: 'ltr',
                  maxLength: LIMITS.email,
                })}
                {text('phone', labels.phone, {
                  type: 'tel',
                  autoComplete: 'tel',
                  inputMode: 'tel',
                  dir: 'ltr',
                  maxLength: LIMITS.phone,
                })}
                <Field id={id('country')} label={labels.country} error={countryError}>
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
                  {text('street', labels.street, {
                    autoComplete: 'street-address',
                    maxLength: LIMITS.street,
                  })}
                </div>
                {text('city', labels.city, { autoComplete: 'address-level2', maxLength: LIMITS.city })}
                {text('state', labels.state, { autoComplete: 'address-level1', maxLength: LIMITS.state })}
                {text('postal', labels.postal, {
                  autoComplete: 'postal-code',
                  dir: 'ltr',
                  maxLength: LIMITS.postal,
                })}
              </div>

              <ErrorSummary fields={form.invalid(ORDER).map((key) => labels[key])} />
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
          <CurrencyNote amountUsd={summary.total} shipping />

          {step === 'payment' ? (
            <>
              <h3 className={shared.payTitle}>{tr('paypalComponent.paymentMethod')}</h3>
              <PayPalPanel getPayload={getPayload} onPaid={onPaid} shownAmount={summary.total} />
            </>
          ) : (
            <Notice tone="info">{tr('paypalComponent.pleaseFillAllDetails')}</Notice>
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
        {line.img && <Image src={line.img} alt="" fill sizes="52px" unoptimized={!isOptimizable(line.img)} />}
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
