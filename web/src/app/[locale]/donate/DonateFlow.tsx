'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { PaymentPayload } from '@/lib/paypal';
import { formatUsd, formatUsdWhole } from '@/lib/pricing';
import DonePanel from '@/components/checkout/DonePanel';
import Field, { invalidProps } from '@/components/checkout/Field';
import PayPalPanel from '@/components/checkout/PayPalPanel';
import StepIndicator, { type FlowStep } from '@/components/checkout/StepIndicator';
import CurrencyNote from '@/components/intl/CurrencyNote';
import { fieldOrder, useErrorText, useStepFocus, useValidatedForm } from '@/components/checkout/hooks';
import { LockIcon } from '@/components/checkout/icons';
import {
  DONATION_PRESETS,
  donationAmount,
  emptyDonation,
  hasErrors,
  LIMITS,
  validateDonation,
} from '@/components/checkout/validation';
import shared from '@/components/checkout/checkout.module.css';
import Notice from '@/components/ui/Notice';
import styles from './donate.module.css';

// Element ids of the fields, in screen order (the first invalid one gets the focus).
const ORDER = fieldOrder({ name: 'donate-name', amount: 'donate-amount' });

// 1) name + amount, 2) summary + PayPal, 3) thank you. The API checks the amount (1–5000 USD).
export default function DonateFlow() {
  const t = useTranslations('checkoutPage');
  const tr = useTranslations();
  const locale = useLocale();
  const errorText = useErrorText();
  const [step, setStep] = useState<FlowStep>('details');
  const [reference, setReference] = useState('');
  const form = useValidatedForm(emptyDonation, validateDonation);
  const { values, set, touch, shown } = form;
  const headingRef = useStepFocus<HTMLHeadingElement>(step);
  const amount = donationAmount(values) ?? 0;

  const getPayload = useCallback((): PaymentPayload => ({ type: 'donation', amount }), [amount]);
  const onPaid = useCallback((capture: { id: string }) => {
    setReference(capture.id);
    setStep('done');
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form.submit(ORDER)) setStep('payment');
  };

  const nameError = errorText(shown('name'), LIMITS.name);
  const amountError = errorText(shown('amount'));

  return (
    <section
      className={`ui-glass ${shared.card} ${shared.cardGold} ${shared.flow} ${styles.card} ${step === 'done' ? shared.cardPaid : ''}`}
      data-flow
    >
      <StepIndicator current={step} />

      {step === 'details' && (
        <form className={shared.form} onSubmit={onSubmit} noValidate>
          <h2 ref={headingRef} tabIndex={-1} className={shared.title}>
            {t('donate.formTitle')}
          </h2>

          <Field id="donate-name" label={t('donate.name')} error={nameError}>
            <input
              id="donate-name"
              name="name"
              className="ui-input"
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              onBlur={() => touch('name')}
              autoComplete="name"
              maxLength={LIMITS.name}
              required
              {...invalidProps('donate-name', nameError)}
            />
          </Field>

          <fieldset className={styles.amounts}>
            <legend className={`ui-label ${styles.legend}`}>{t('donate.amount')}</legend>
            <div className={styles.chips}>
              {DONATION_PRESETS.map((preset) => (
                <label key={preset} className={`${styles.chip} ${values.preset === preset ? styles.selected : ''}`}>
                  <input
                    type="radio"
                    name="amount"
                    value={preset}
                    checked={values.preset === preset}
                    onChange={() => set('preset', preset)}
                    className={styles.chipInput}
                  />
                  <span>{formatUsdWhole(preset, locale)}</span>
                </label>
              ))}
              <label className={`${styles.chip} ${styles.chipOther} ${values.preset === 'other' ? styles.selected : ''}`}>
                <input
                  type="radio"
                  name="amount"
                  value="other"
                  checked={values.preset === 'other'}
                  onChange={() => set('preset', 'other')}
                  className={styles.chipInput}
                />
                <span>{t('donate.other')}</span>
              </label>
            </div>
          </fieldset>

          {values.preset === 'other' && (
            <Field id="donate-amount" label={t('donate.customAmount')} error={amountError}>
              <input
                id="donate-amount"
                name="customAmount"
                className={`ui-input ${styles.amountInput}`}
                value={values.custom}
                onChange={(e) => set('custom', e.target.value)}
                onBlur={() => touch('amount')}
                inputMode="decimal"
                autoComplete="off"
                dir="ltr"
                maxLength={10}
                required
                {...invalidProps('donate-amount', amountError)}
              />
            </Field>
          )}

          {form.submitted && hasErrors(form.errors) && (
            <Notice role="alert">{t('form.fixErrors')}</Notice>
          )}
          <div className={shared.actions}>
            <button type="submit" className={`ui-btn ui-btn--gold ${shared.btnLg} ${shared.btnBlock}`}>
              {t('form.continue')}
            </button>
          </div>
          <p className={shared.secure}>
            <LockIcon />
            {t('candle.secureNext')}
          </p>
        </form>
      )}

      {step === 'payment' && (
        <>
          <h2 ref={headingRef} tabIndex={-1} className={shared.title}>
            {t('donate.summaryTitle')}
          </h2>
          <dl className={shared.details}>
            <div>
              <dt>{t('donate.nameLabel')}</dt>
              <dd>{values.name.trim()}</dd>
            </div>
          </dl>
          <dl className={shared.total}>
            <dt>{t('donate.donation')}</dt>
            <dd data-testid="donation-total">{formatUsd(amount, locale)}</dd>
          </dl>
          <CurrencyNote amountUsd={amount} />
          <h3 className={shared.payTitle}>{tr('paypalComponent.paymentMethod')}</h3>
          <PayPalPanel getPayload={getPayload} onPaid={onPaid} />
          <div className={shared.actions}>
            <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setStep('details')}>
              {t('form.edit')}
            </button>
          </div>
        </>
      )}

      {step === 'done' && (
        <DonePanel
          icon="heart"
          title={t('donate.thanksTitle')}
          headingRef={headingRef}
          reference={reference}
          action={
            <Link href="/" className="ui-btn ui-btn--ghost">
              {tr('site.notFound.backHome')}
            </Link>
          }
        >
          <p>{t('donate.thanksText')}</p>
        </DonePanel>
      )}
    </section>
  );
}
