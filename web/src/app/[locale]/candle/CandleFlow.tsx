'use client';

import { useCallback, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { PaymentPayload } from '@/lib/paypal';
import { CANDLE_PRICE, formatUsd } from '@/lib/pricing';
import DonePanel from '@/components/checkout/DonePanel';
import Field, { invalidProps } from '@/components/checkout/Field';
import PayPalPanel from '@/components/checkout/PayPalPanel';
import StepIndicator, { type FlowStep } from '@/components/checkout/StepIndicator';
import CurrencyNote from '@/components/intl/CurrencyNote';
import { useErrorText, useSaveAfterPayment, useStepFocus, useValidatedForm } from '@/components/checkout/hooks';
import { AlertIcon, CheckIcon, LockIcon } from '@/components/checkout/icons';
import {
  buildCandleBody,
  emptyCandle,
  hasErrors,
  LIMITS,
  validateCandle,
  type CandleForm,
  type Church,
} from '@/components/checkout/validation';
import shared from '@/components/checkout/checkout.module.css';
import styles from './candle.module.css';

type Key = keyof CandleForm;

const CHURCH_CARDS: { value: Church; labelKey: 'home.siteLatin' | 'home.siteGreek'; img: string }[] = [
  { value: 'Annunciation church', labelKey: 'home.siteLatin', img: '/images/latin/latin9.jpg' },
  { value: 'Greek orthodox church', labelKey: 'home.siteGreek', img: '/images/greek/greek11.jpg' },
];

const FIELDS: [Key, string][] = [
  ['church', 'candle-church'],
  ['firstName', 'candle-first-name'],
  ['lastName', 'candle-last-name'],
  ['email', 'candle-email'],
  ['confirmEmail', 'candle-confirm-email'],
  ['prayer', 'candle-prayer'],
];
const id = (key: Key) => FIELDS.find(([k]) => k === key)![1];

const getPayload = (): PaymentPayload => ({ type: 'candle' });

// 1) church + name + prayer, 2) summary + PayPal ($3, priced by the API), 3) thank you.
export default function CandleFlow() {
  const t = useTranslations('checkoutPage');
  const tr = useTranslations();
  const locale = useLocale();
  const errorText = useErrorText();
  const [step, setStep] = useState<FlowStep>('details');
  const [reference, setReference] = useState('');
  const form = useValidatedForm(emptyCandle, validateCandle);
  const { values, set, touch, shown } = form;
  const saving = useSaveAfterPayment();
  const { save } = saving;
  const headingRef = useStepFocus<HTMLHeadingElement>(step);
  const price = formatUsd(CANDLE_PRICE, locale);
  const church = CHURCH_CARDS.find((c) => c.value === values.church);

  const onPaid = useCallback(
    async (capture: { id: string }) => {
      setReference(capture.id);
      setStep('done');
      await save('/candle/lightACandle', buildCandleBody(values));
    },
    [values, save],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form.submit(FIELDS)) setStep('payment');
  };

  const text = (key: Key, label: string, extra: InputHTMLAttributes<HTMLInputElement> = {}) => {
    const error = errorText(shown(key), extra.maxLength);
    return (
      <Field id={id(key)} label={label} error={error}>
        <input
          id={id(key)}
          name={key}
          className="ui-input"
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
  const churchError = errorText(shown('church'));
  const prayerError = errorText(shown('prayer'), LIMITS.prayer);

  return (
    <section className={`ui-glass ${styles.card} ${shared.flow} ${step === 'done' ? shared.cardPaid : ''}`} data-flow>
      <StepIndicator current={step} />

      {step === 'details' && (
        <form className={shared.form} onSubmit={onSubmit} noValidate>
          <h2 ref={headingRef} tabIndex={-1} className={`${shared.eyebrow} ${styles.formTitle}`}>
            <span className={`${shared.flame} ${shared.flameSm}`} aria-hidden="true" />
            {tr('candle.lightAPrayCandle')}
          </h2>

          <fieldset className={styles.churches}>
            <legend className={styles.legend}>{tr('candle.selectChurch')}</legend>
            <div className={styles.churchGrid}>
              {CHURCH_CARDS.map((card, i) => {
                const selected = values.church === card.value;
                return (
                  <label key={card.value} className={`${styles.church} ${selected ? styles.selected : ''}`}>
                    <input
                      type="radio"
                      name="church"
                      id={i === 0 ? id('church') : undefined}
                      value={card.value}
                      checked={selected}
                      onChange={() => set('church', card.value)}
                      required
                      className={styles.churchInput}
                      {...invalidProps(id('church'), churchError)}
                    />
                    <Image
                      className={styles.churchImg}
                      src={card.img}
                      alt=""
                      fill
                      sizes="(min-width: 960px) 300px, 50vw"
                    />
                    <span className={styles.churchShade} aria-hidden="true" />
                    <span className={styles.churchCheck} aria-hidden="true">
                      {selected && <CheckIcon size={15} />}
                    </span>
                    <span className={styles.churchName}>{tr(card.labelKey)}</span>
                    <span className={styles.churchRing} aria-hidden="true" />
                  </label>
                );
              })}
            </div>
            {churchError && (
              <p id={`${id('church')}-error`} className={`ui-error ${shared.fieldError} ${styles.churchError}`}>
                <AlertIcon size={16} />
                {churchError}
              </p>
            )}
          </fieldset>

          <div className={shared.fields}>
            {text('firstName', tr('candle.firstName'), { autoComplete: 'given-name', maxLength: LIMITS.name })}
            {text('lastName', tr('candle.lastName'), { autoComplete: 'family-name', maxLength: LIMITS.name })}
            {text('email', tr('candle.yourEmail'), {
              type: 'email',
              autoComplete: 'email',
              dir: 'ltr',
              maxLength: LIMITS.email,
            })}
            {text('confirmEmail', tr('candle.confirmEmail'), {
              type: 'email',
              autoComplete: 'email',
              dir: 'ltr',
              maxLength: LIMITS.email,
            })}
          </div>

          <Field id={id('prayer')} label={tr('candle.yourPrayer')} error={prayerError}>
            <textarea
              id={id('prayer')}
              name="prayer"
              rows={5}
              className="ui-textarea"
              value={values.prayer}
              onChange={(e) => set('prayer', e.target.value)}
              onBlur={() => touch('prayer')}
              maxLength={LIMITS.prayer}
              required
              {...invalidProps(id('prayer'), prayerError)}
            />
          </Field>

          {form.submitted && hasErrors(form.errors) && (
            <p className={`${shared.alert} ${shared.alertDanger}`} role="alert">
              <AlertIcon />
              {t('form.fixErrors')}
            </p>
          )}

          <div className={styles.pay}>
            <p className={styles.price}>{t('candle.price', { price })}</p>
            <button type="submit" className={`ui-btn ui-btn--gold ${shared.btnLg}`}>
              <span className={`${shared.flame} ${shared.flameSm} ${shared.flameInk}`} aria-hidden="true" />
              {tr('candle.light')}
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
            {tr('orderSummary')}
          </h2>
          <dl className={shared.details}>
            <div>
              <dt>{tr('firstName')}</dt>
              <dd>{values.firstName.trim()}</dd>
            </div>
            <div>
              <dt>{tr('lastName')}</dt>
              <dd>{values.lastName.trim()}</dd>
            </div>
            <div>
              <dt>{tr('email')}</dt>
              <dd dir="ltr" className={styles.ltrValue}>
                {values.email.trim()}
              </dd>
            </div>
            <div>
              <dt>{tr('prayerAt')}</dt>
              <dd>{church ? tr(church.labelKey) : ''}</dd>
            </div>
            <div>
              <dt>{tr('candle.yourPrayer')}</dt>
              <dd className={shared.prayer}>{values.prayer.trim()}</dd>
            </div>
          </dl>
          <dl className={shared.total}>
            <dt>
              <span className={`${shared.flame} ${shared.flameSm}`} aria-hidden="true" />
              {tr('cost')}
            </dt>
            <dd data-testid="candle-total">{price}</dd>
          </dl>
          <CurrencyNote amountUsd={CANDLE_PRICE} />
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
          icon="flame"
          title={tr('confirmationCandle.thankYou')}
          headingRef={headingRef}
          reference={reference}
          saveStatus={saving.status}
          onRetry={saving.retry}
          action={
            <Link href="/" className="ui-btn ui-btn--ghost">
              {tr('site.notFound.backHome')}
            </Link>
          }
        >
          <p>{tr('confirmationCandle.paymentSuccess')}</p>
          {saving.status === 'saved' && <p>{tr('confirmationCandle.receipt')}</p>}
          <p className={shared.doneStrong}>{tr('confirmationCandle.gratitude')}</p>
        </DonePanel>
      )}
    </section>
  );
}
