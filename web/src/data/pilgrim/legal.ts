// Structure of the legal pages (privacy, terms, shipping and returns). Every section has a title and some
// paragraphs and/or bullet items, all messages under pilgrim.legal.<page>.<section>.

export type LegalPage = 'privacy' | 'terms' | 'shipping';
export type LegalSection = { id: string; paras?: readonly string[]; items?: readonly string[] };

export const LEGAL: Record<LegalPage, readonly LegalSection[]> = {
  privacy: [
    { id: 'who', paras: ['p1'] },
    { id: 'collect', paras: ['p1'], items: ['orders', 'candles', 'prayers', 'reviews', 'contact', 'payments'] },
    { id: 'use', items: ['u1', 'u2', 'u3'] },
    { id: 'share', paras: ['p1'], items: ['paypal', 'hosting', 'maps'] },
    { id: 'browser', paras: ['p1'], items: ['cart', 'liked', 'language'] },
    { id: 'keep', paras: ['p1'] },
    { id: 'rights', paras: ['p1'] },
    { id: 'children', paras: ['p1'] },
    { id: 'changes', paras: ['p1'] },
  ],
  terms: [
    { id: 'use', paras: ['p1'] },
    { id: 'orders', paras: ['p1'], items: ['i1', 'i2', 'i3'] },
    { id: 'candles', paras: ['p1'] },
    { id: 'donations', paras: ['p1'] },
    { id: 'content', paras: ['p1'], items: ['i1', 'i2'] },
    { id: 'ip', paras: ['p1'] },
    { id: 'info', paras: ['p1'] },
    { id: 'liability', paras: ['p1'] },
    { id: 'changes', paras: ['p1'] },
  ],
  shipping: [
    { id: 'cost', paras: ['p1'], items: ['i1', 'i2'] },
    { id: 'delivery', paras: ['p1'] },
    { id: 'customs', paras: ['p1'] },
    { id: 'returns', paras: ['p1'], items: ['i1', 'i2', 'i3'] },
    { id: 'digital', paras: ['p1'] },
    { id: 'contact', paras: ['p1'] },
  ],
};
