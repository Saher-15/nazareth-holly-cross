import { describe, expect, it } from 'vitest';
import { campaignName, costPerCustomer, dayParam, flowParam, funnelSchema, share } from '@/lib/funnel';

// The Campaigns page's arithmetic and what it accepts from the address bar and from the API.
describe('funnel helpers', () => {
  it('share: a percentage with one decimal, or null when there is nothing to divide by', () => {
    expect(share(5, 250)).toBe(2);
    expect(share(1, 3)).toBe(33.3);
    expect(share(0, 10)).toBe(0);
    expect(share(3, 0)).toBeNull();
    expect(share(Number.NaN, 10)).toBeNull();
  });

  it('costPerCustomer: spend divided by completed purchases, in cents', () => {
    expect(costPerCustomer(60, 5)).toBe(12);
    expect(costPerCustomer(100, 3)).toBe(33.33);
    expect(costPerCustomer(0, 4)).toBe(0);
    expect(costPerCustomer(50, 0)).toBeNull();
    expect(costPerCustomer(-1, 4)).toBeNull();
    expect(costPerCustomer(Number.NaN, 4)).toBeNull();
  });

  it('campaignName: the labels that exist, or null for a visit without a campaign link', () => {
    expect(campaignName({ source: 'facebook', medium: 'paid', campaign: 'easter' })).toBe('facebook / paid / easter');
    expect(campaignName({ source: 'newsletter', medium: '', campaign: '' })).toBe('newsletter');
    expect(campaignName({ source: '', medium: '', campaign: '' })).toBeNull();
  });

  it('takes only a plain day and a known flow from the address bar', () => {
    expect(dayParam('2026-10-10')).toBe('2026-10-10');
    for (const bad of ['10/10/2026', '2026-10-10T00:00', '', undefined, ['2026-10-10']]) expect(dayParam(bad)).toBeUndefined();
    expect(flowParam('order')).toBe('order');
    for (const bad of ['admin', '', undefined, ['order']]) expect(flowParam(bad)).toBe('candle');
  });

  it('accepts the API answer and refuses one with a missing count', () => {
    const counts = { view: 1, cta: 0, details: 0, pay_start: 0, paid: 0 };
    const ok = { from: '2026-10-01', to: '2026-10-02', flow: 'candle', totals: counts, campaigns: [{ source: '', medium: '', campaign: '', ...counts }], days: [{ day: '2026-10-01', ...counts }], paidConfirmed: null };
    expect(funnelSchema.safeParse(ok).success).toBe(true);
    expect(funnelSchema.safeParse({ ...ok, totals: { view: 1 } }).success).toBe(false);
    expect(funnelSchema.safeParse({ ...ok, flow: 'everything' }).success).toBe(false);
  });
});
