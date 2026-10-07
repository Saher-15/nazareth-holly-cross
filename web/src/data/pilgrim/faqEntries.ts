import { locales } from '@/i18n/routing';
import { CONTACT_EMAIL } from '@/lib/config';
import { CANDLE_PRICE, formatUsd, ORDER_DISCOUNT, SHIPPING_FEE } from '@/lib/pricing';
import { FAQ_GROUPS, faqAnchor, type FaqGroup } from './faq';

/** The translator of a server page (`await getTranslations()` with no namespace). */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export type FaqItem = { anchor: string; group: FaqGroup['id']; id: string; question: string; answer: string };

// Figures quoted in the answers come from the same constants the shop uses, so the FAQ can never disagree with
// the cart. (The donation limits mirror server/services/pricing.js: DONATION_MIN and DONATION_MAX.)
const DONATION_MIN = 1;
const DONATION_MAX = 5000;

/**
 * The site's languages named in `locale`, as one list ("English, French, ... and Arabic"). Built from the routing
 * locales with the Unicode CLDR names, so the FAQ answer (and its FAQPage structured data) names every language the
 * site has and can never fall behind again (it named 11 of 14).
 */
export function languageList(locale: string): string {
  const names = new Intl.DisplayNames([locale], { type: 'language' });
  return new Intl.ListFormat(locale, { type: 'conjunction', style: 'long' }).format(locales.map((code) => names.of(code) ?? code));
}

export function faqValues(locale: string) {
  return {
    languages: languageList(locale),
    price: formatUsd(CANDLE_PRICE, locale),
    shipping: formatUsd(SHIPPING_FEE, locale),
    min: formatUsd(DONATION_MIN, locale),
    max: formatUsd(DONATION_MAX, locale),
    email: CONTACT_EMAIL,
    discount: new Intl.NumberFormat(locale, { style: 'percent' }).format(1 - ORDER_DISCOUNT),
  };
}

/** The questions and answers of the given groups (all groups when none is given), in page order. */
export function faqItems(t: Translate, locale: string, groups: readonly FaqGroup[] = FAQ_GROUPS): FaqItem[] {
  const values = faqValues(locale);
  return groups.flatMap((group) =>
    group.ids.map((id) => ({
      anchor: faqAnchor(group.id, id),
      group: group.id,
      id,
      question: t(`${group.prefix}.${id}.q`, values),
      answer: t(`${group.prefix}.${id}.a`, values),
    })),
  );
}
