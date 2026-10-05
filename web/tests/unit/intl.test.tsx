import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { IntlMessageFormat } from 'intl-messageformat';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import sitemap from '@/app/sitemap';
import CurrencyNote from '@/components/intl/CurrencyNote';
import { defaultLocale, isRtl, locales, localeNames, openGraphLocales, rtlLocales } from '@/i18n/routing';
import { approximateIn, formatCurrency, hintCurrencyFor, INDICATIVE_RATES } from '@/lib/currency';
import { formatUsd, SHIPPING_FEE } from '@/lib/pricing';
import { openGraphLocale, pageAlternates } from '@/lib/seo';

// The sitemap asks the API for the shop's products; the test must not depend on the network.
vi.mock('@/lib/shop/load', () => ({ loadCatalog: async () => ({ products: [{ _id: 'p1' }] }) }));

afterEach(cleanup);

type Messages = { [key: string]: string | Messages };
const load = (locale: string): Messages =>
  JSON.parse(readFileSync(join(__dirname, '../../src/messages', `${locale}.json`), 'utf8'));
const at = (messages: Messages, path: string) =>
  path.split('.').reduce<string | Messages>((node, part) => (node as Messages)[part], messages) as string;
const say = (locale: string, path: string, values: Record<string, unknown>) =>
  String(new IntlMessageFormat(at(load(locale), path), locale).format(values));

describe('the language list', () => {
  it('has English first (the default) and every language named in itself', () => {
    expect(locales[0]).toBe(defaultLocale);
    for (const locale of locales) expect(localeNames[locale].length).toBeGreaterThan(1);
    expect(new Set(Object.values(localeNames)).size).toBe(locales.length);
  });

  it('only Hebrew and Arabic are right-to-left', () => {
    expect([...rtlLocales].sort()).toEqual(['ar', 'he']);
    expect(locales.filter(isRtl).sort()).toEqual(['ar', 'he']);
  });

  it('knows an Open Graph language_TERRITORY code for every language', () => {
    for (const locale of locales) expect(openGraphLocales[locale]).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
    expect(new Set(Object.values(openGraphLocales)).size).toBe(locales.length);
  });

  it('has a message file for every language', () => {
    for (const locale of locales) expect(Object.keys(load(locale)).length).toBeGreaterThan(10);
  });
});

describe('hreflang and Open Graph', () => {
  it('lists every language and x-default (English) for a page, with a self-referencing canonical', () => {
    const alternates = pageAlternates('uk', '/sites/latin');
    expect(alternates.canonical).toBe('/uk/sites/latin');
    expect(Object.keys(alternates.languages)).toEqual([...locales, 'x-default']);
    expect(alternates.languages['x-default']).toBe('/en/sites/latin');
    expect((alternates.languages as Record<string, string>).ar).toBe('/ar/sites/latin');
  });

  it('writes og:locale as language_TERRITORY and lists the other languages as alternates', () => {
    const og = openGraphLocale('he');
    expect(og.locale).toBe('he_IL');
    expect(og.alternateLocale).toHaveLength(locales.length - 1);
    expect(og.alternateLocale).not.toContain('he_IL');
    expect(openGraphLocale('pt').locale).toBe('pt_BR');
    expect(openGraphLocale('not-a-language').locale).toBe('en_US');
  });

  it('puts every language version of every page in the sitemap, each with reciprocal alternates', async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(entries.length % locales.length).toBe(0);
    for (const entry of entries) {
      const languages = entry.alternates?.languages as Record<string, string>;
      expect(Object.keys(languages)).toEqual([...locales, 'x-default']);
      expect(Object.values(languages)).toContain(entry.url); // lists itself
      expect(languages['x-default']).toBe(languages.en);
    }
    // The five holy places are indexed, the cart and checkout are not.
    expect(urls).toContain('https://nazarethholycross.com/he/sites/maryswell');
    expect(urls.some((u) => /\/(cart|checkout)$/.test(u))).toBe(false);
    // Products of the shop follow the same rule (the catalogue is mocked above).
    expect(urls).toContain('https://nazarethholycross.com/nl/shop/p1');
  });
});

describe('numbers and prices', () => {
  it.each(locales)('%s writes prices with Western digits', (locale) => {
    expect(formatUsd(1234.5, locale)).toMatch(/1\D?234\D50|1234\D50/);
    expect(formatUsd(1234.5, locale)).not.toMatch(/[٠-٩۰-۹]/);
  });

  it('keeps the currency symbol and the number together in Hebrew and Arabic', () => {
    for (const locale of ['he', 'ar']) {
      const text = formatUsd(3, locale);
      expect(text).toContain('3.00');
      expect(text).toMatch(/\$|USD|US\$/);
    }
  });
});

describe('plural forms', () => {
  const days = (locale: string, count: number) => say(locale, 'communityPage.live.units.days', { count });

  it('Russian: 1 день, 2 дня, 5 дней, 21 день, 11 дней', () => {
    expect([1, 2, 5, 21, 11].map((n) => days('ru', n))).toEqual(['День', 'Дня', 'Дней', 'День', 'Дней']);
  });

  it('Ukrainian: 1 день, 3 дні, 7 днів, 22 дні', () => {
    expect([1, 3, 7, 22].map((n) => days('uk', n))).toEqual(['День', 'Дні', 'Днів', 'Дні']);
  });

  it('Polish: 1 godzina, 2 godziny, 5 godzin, 22 godziny, 12 godzin', () => {
    const hours = (n: number) => say('pl', 'communityPage.live.units.hours', { count: n });
    expect([1, 2, 5, 22, 12].map(hours)).toEqual(['Godzina', 'Godziny', 'Godzin', 'Godziny', 'Godzin']);
  });

  it('Arabic: one, two, few (3-10) and many (11-99) differ', () => {
    expect([1, 2, 5, 11].map((n) => days('ar', n))).toEqual(['يوم', 'يومان', 'أيام', 'يومًا']);
  });

  it('Hebrew counts photos as "one photo", "two photos", "N photos"', () => {
    const photos = (n: number) => say('he', 'placesPage.photoCount', { count: n });
    expect(photos(1)).toBe('תמונה אחת');
    expect(photos(2)).toBe('שתי תמונות');
    expect(photos(7)).toBe('7 תמונות');
  });

  it('Romanian: 1 fotografie, 3 fotografii, 20 de fotografii', () => {
    const photos = (n: number) => say('ro', 'placesPage.photoCount', { count: n });
    expect(photos(1)).toBe('1 fotografie');
    expect(photos(3)).toBe('3 fotografii');
    expect(photos(20)).toBe('20 de fotografii');
  });

  it('English and Dutch keep one and other', () => {
    expect([1, 2].map((n) => days('en', n))).toEqual(['Day', 'Days']);
    expect([1, 2].map((n) => days('nl', n))).toEqual(['Dag', 'Dagen']);
  });
});

describe('approximate prices in the visitor’s currency', () => {
  it('only languages that point to one currency get a hint', () => {
    expect(hintCurrencyFor('he')).toBe('ILS');
    expect(hintCurrencyFor('de')).toBe('EUR');
    for (const locale of ['en', 'es', 'pt', 'ar', 'ru']) expect(hintCurrencyFor(locale)).toBeUndefined();
  });

  it('converts with the fixed indicative rate and rounds', () => {
    expect(approximateIn(10, 'he')).toEqual({ currency: 'ILS', amount: 35 });
    expect(approximateIn(3, 'fr')).toEqual({ currency: 'EUR', amount: Math.round(3 * INDICATIVE_RATES.EUR * 100) / 100 });
    expect(approximateIn(3, 'uk')?.amount).toBe(Math.round(3 * INDICATIVE_RATES.UAH)); // whole hryvnia
  });

  it('shows nothing for no amount, a negative or non-numeric one, or an unmapped language', () => {
    expect(approximateIn(0, 'he')).toBeNull();
    expect(approximateIn(-5, 'he')).toBeNull();
    expect(approximateIn(Number.NaN, 'he')).toBeNull();
    expect(approximateIn(10, 'en')).toBeNull();
  });

  it('writes the amount in the visitor’s language with Western digits', () => {
    expect(formatCurrency(12.5, 'EUR', 'de')).toMatch(/^12,50\s€$/);
    expect(formatCurrency(12.5, 'EUR', 'nl')).toMatch(/12,50/);
    expect(formatCurrency(35, 'ILS', 'he')).toMatch(/35\.00/);
    expect(formatCurrency(124.5, 'UAH', 'uk')).not.toMatch(/[.,]\d{2}\b/);
  });

  const renderNote = (locale: string, props: Parameters<typeof CurrencyNote>[0]) =>
    render(
      <NextIntlClientProvider locale={locale} messages={load(locale)}>
        <CurrencyNote {...props} />
      </NextIntlClientProvider>,
    );

  it('says the price is in dollars, and gives the flat shipping fee for an order', () => {
    renderNote('en', { amountUsd: 20, shipping: true });
    const note = screen.getByTestId('currency-note');
    expect(note).toHaveTextContent('US dollars (USD)');
    expect(note).toHaveTextContent(`Shipping is a flat ${formatUsd(SHIPPING_FEE, 'en')} per order.`);
    expect(screen.queryByTestId('currency-approx')).toBeNull(); // English has no single currency
  });

  it('adds an approximate amount for a German visitor, and no shipping line for a candle', () => {
    renderNote('de', { amountUsd: 3 });
    expect(screen.getByTestId('currency-approx')).toHaveTextContent('2,64 €');
    expect(screen.getByTestId('currency-note')).not.toHaveTextContent('Versand');
  });

  it('works in Hebrew', () => {
    renderNote('he', { amountUsd: 10, shipping: true });
    expect(screen.getByTestId('currency-approx')).toHaveTextContent(/35\.00/);
    expect(screen.getByTestId('currency-note')).toHaveTextContent('דמי המשלוח');
  });
});
