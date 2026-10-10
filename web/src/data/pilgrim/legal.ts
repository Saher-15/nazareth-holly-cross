// Structure of the legal pages (privacy, terms, shipping and returns, the accessibility statement). Every section
// has a title and some paragraphs and/or bullet items, all messages under pilgrim.legal.<page>.<section>.

export type LegalPage = 'privacy' | 'terms' | 'shipping' | 'accessibility';
export type LegalSection = { id: string; paras?: readonly string[]; items?: readonly string[] };

export const LEGAL: Record<LegalPage, readonly LegalSection[]> = {
  privacy: [
    { id: 'who', paras: ['p1'] },
    { id: 'collect', paras: ['p1'], items: ['orders', 'candles', 'prayers', 'reviews', 'contact', 'payments'] },
    { id: 'use', items: ['u1', 'u2', 'u3'] },
    { id: 'share', paras: ['p1'], items: ['paypal', 'hosting', 'maps'] },
    { id: 'browser', paras: ['p1', 'p2'], items: ['cart', 'liked', 'language'] }, // p2: the anonymous funnel counts (docs/ANALYTICS.md)
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
  // The accessibility statement (Israeli Standard IS 5568 / WCAG 2.2 AA): what we claim, what we did, what is
  // still missing, how it was checked and whom to write to. docs/ACCESSIBILITY.md holds the evidence.
  accessibility: [
    { id: 'commitment', paras: ['p1'] },
    { id: 'status', paras: ['p1', 'p2'] },
    { id: 'settings', paras: ['p1'], items: ['text', 'contrast', 'links', 'motion', 'font', 'spacing', 'focus', 'cursor'] },
    { id: 'done', items: ['keyboard', 'structure', 'contrast', 'zoom', 'forms', 'motion', 'languages'] },
    { id: 'limits', paras: ['p1'], items: ['paypal', 'videos', 'translations', 'external', 'photos'] },
    { id: 'testing', paras: ['p1', 'p2'] },
    { id: 'contact', paras: ['p1', 'p2'] },
  ],
};
