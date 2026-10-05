import type { Locale } from '@/i18n/routing';

// An approximate price in the visitor's own currency, shown beside the US-dollar price.
//
// This is a hint, never a charge: the API always charges US dollars and the visitor's card or PayPal converts
// the amount at its own rate. No exchange-rate service is called (and none must be added without the owner's
// approval): the rates below are fixed, rounded, indicative numbers. Refresh them, and RATES_AS_OF, now and
// then; a hint that is a few percent off is harmless, a hint presented as exact would not be.
export const RATES_AS_OF = '2026-10-05';

/** Units of the currency for one US dollar. */
export const INDICATIVE_RATES = { EUR: 0.88, ILS: 3.5, PLN: 3.7, RON: 4.4, UAH: 41.5 } as const;
export type HintCurrency = keyof typeof INDICATIVE_RATES;

// Only languages that point to one currency get a hint. Spanish, Portuguese, English, Arabic and Russian are
// spoken in countries with many currencies, so guessing one would be wrong more often than right.
export const LOCALE_CURRENCY: Partial<Record<Locale, HintCurrency>> = {
  de: 'EUR',
  fr: 'EUR',
  it: 'EUR',
  nl: 'EUR',
  el: 'EUR',
  he: 'ILS',
  pl: 'PLN',
  ro: 'RON',
  uk: 'UAH',
};

/** The currency hinted to visitors of a language, if it has one. */
export const hintCurrencyFor = (locale: string): HintCurrency | undefined =>
  LOCALE_CURRENCY[locale as Locale];

/** `amountUsd` in the language's currency, rounded to a sensible number of decimals; null without a hint. */
export function approximateIn(amountUsd: number, locale: string): { currency: HintCurrency; amount: number } | null {
  const currency = hintCurrencyFor(locale);
  if (!currency || !Number.isFinite(amountUsd) || amountUsd <= 0) return null;
  const converted = amountUsd * INDICATIVE_RATES[currency];
  // Whole units for the weak currency (UAH), cents for the others.
  const amount = currency === 'UAH' ? Math.round(converted) : Math.round(converted * 100) / 100;
  return { currency, amount };
}

/** "€4.40", "4,40 €", "₪ 12.25" ... in the visitor's language, Western digits. */
export const formatCurrency = (amount: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    numberingSystem: 'latn',
    ...(currency === 'UAH' ? { maximumFractionDigits: 0 } : {}),
  }).format(amount);
