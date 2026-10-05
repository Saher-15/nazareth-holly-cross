// The questions of the FAQ pages. The wording lives in messages (pilgrim.visit.faq.<id> and pilgrim.faq.items.<id>);
// every entry has a `q` (question) and an `a` (answer) message.

export type FaqGroup = {
  id: 'visiting' | 'prayer' | 'shop' | 'site';
  /** Message prefix of the entries: `${prefix}.${id}.q|a`. */
  prefix: 'pilgrim.visit.faq' | 'pilgrim.faq.items';
  ids: readonly string[];
};

/** The five questions repeated on /visit (with FAQPage structured data). */
export const VISIT_FAQ_IDS = ['free', 'dress', 'days', 'safe', 'season'] as const;

export const FAQ_GROUPS: readonly FaqGroup[] = [
  { id: 'visiting', prefix: 'pilgrim.visit.faq', ids: VISIT_FAQ_IDS },
  { id: 'prayer', prefix: 'pilgrim.faq.items', ids: ['candle', 'wall', 'live'] },
  { id: 'shop', prefix: 'pilgrim.faq.items', ids: ['pay', 'account', 'shipping', 'discount', 'damaged', 'donate'] },
  { id: 'site', prefix: 'pilgrim.faq.items', ids: ['languages', 'data', 'contact'] },
];

/** `visiting-free`: the anchor of a question on /faq, also used by the site search. */
export const faqAnchor = (group: FaqGroup['id'], id: string) => `${group}-${id}`;
