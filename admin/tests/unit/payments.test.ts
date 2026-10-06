import { describe, expect, it } from 'vitest';
import { dashboardSchema, paymentSchema, paymentsPage, privacyEraseSchema, privacyLookupSchema } from '@/lib/api';
import { GRACE_MS, linkedHref, payerLabel, paymentState } from '@/lib/payments';
import { resolveProxyPath } from '@/lib/proxy-allow';
import { can, navFor, pageNeeds } from '@/lib/roles';

// The Payments screen's rules: what a payment means, which calls the browser may make, who may open the pages.

const NOW = Date.parse('2026-10-20T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const base = { status: 'captured', type: 'order', capturedAt: ago(GRACE_MS + 60_000), linkedTo: null, resolvedAt: null };

describe('paymentState (the same rule as the server, services/payments.js unfulfilledFilter)', () => {
  it('paid for an order or a candle with nothing saved, after the grace period: unfulfilled', () => {
    expect(paymentState(base, NOW)).toBe('unfulfilled');
    expect(paymentState({ ...base, type: 'candle' }, NOW)).toBe('unfulfilled');
    expect(paymentState({ ...base, type: 'unknown' }, NOW)).toBe('unfulfilled');
  });

  it('paid a minute ago: still being saved by the customer\'s browser', () => {
    expect(paymentState({ ...base, capturedAt: ago(60_000) }, NOW)).toBe('processing');
    expect(paymentState({ ...base, capturedAt: ago(GRACE_MS - 1) }, NOW)).toBe('processing');
    expect(paymentState({ ...base, capturedAt: ago(GRACE_MS) }, NOW)).toBe('unfulfilled');
  });

  it('an order or candle points at it: fulfilled', () => {
    expect(paymentState({ ...base, linkedTo: { kind: 'order', id: 'abc' } }, NOW)).toBe('fulfilled');
  });

  it('a donation needs nothing else: received', () => {
    expect(paymentState({ ...base, type: 'donation' }, NOW)).toBe('received');
  });

  it('an admin resolved it: resolved, whatever else is true', () => {
    expect(paymentState({ ...base, resolvedAt: ago(1000) }, NOW)).toBe('resolved');
  });

  it('never paid or declined', () => {
    expect(paymentState({ ...base, status: 'created', capturedAt: null }, NOW)).toBe('open');
    expect(paymentState({ ...base, status: 'failed', capturedAt: null }, NOW)).toBe('failed');
  });

  it('a payment with no capture time is not guessed to be fresh', () => {
    expect(paymentState({ ...base, capturedAt: null }, NOW)).toBe('unfulfilled');
  });
});

describe('links and labels', () => {
  it('points at the order or the candle request, and never builds a link from a strange id', () => {
    expect(linkedHref({ linkedTo: { kind: 'order', id: 'abc123' } })).toBe('/orders?open=abc123');
    expect(linkedHref({ linkedTo: { kind: 'candle', id: 'abc123' } })).toBe('/candles?open=abc123');
    expect(linkedHref({ linkedTo: null })).toBeNull();
    expect(linkedHref({ linkedTo: { kind: 'order', id: '../../x?y' } })).toBeNull();
  });

  it('names the person from PayPal first, then the donor\'s own name', () => {
    expect(payerLabel({ payerName: 'Ben Buyer', donorName: 'Anna' })).toBe('Ben Buyer');
    expect(payerLabel({ payerName: null, donorName: ' Anna ' })).toBe('Anna');
    expect(payerLabel({ payerName: undefined, donorName: undefined })).toBe('');
  });
});

describe('what the browser may ask for through /api/proxy', () => {
  const ok = (segments: string[], method: string) => resolveProxyPath(segments, method);
  const id = 'a00000000000000000000103';

  it('reads the ledger and resolves a payment', () => {
    expect(ok(['payments'], 'GET')).toBe('/admin/payments');
    expect(ok(['payments', id], 'GET')).toBe(`/admin/payments/${id}`);
    expect(ok(['payments', id], 'PATCH')).toBe(`/admin/payments/${id}`);
    expect(ok(['export', 'payments.csv'], 'GET')).toBe('/admin/export/payments.csv');
  });

  it('can never delete or create a payment, or replace one', () => {
    expect(ok(['payments', id], 'DELETE')).toBeNull();
    expect(ok(['payments'], 'POST')).toBeNull();
    expect(ok(['payments', id], 'PUT')).toBeNull();
  });

  it('looks up and erases personal data, and nothing else under /privacy', () => {
    expect(ok(['privacy', 'lookup'], 'POST')).toBe('/admin/privacy/lookup');
    expect(ok(['privacy', 'erase'], 'POST')).toBe('/admin/privacy/erase');
    expect(ok(['privacy', 'lookup'], 'GET')).toBeNull();
    expect(ok(['privacy', 'erase'], 'DELETE')).toBeNull();
    expect(ok(['privacy', 'export'], 'POST')).toBeNull();
    expect(ok(['privacy'], 'POST')).toBeNull();
  });
});

describe('who sees what', () => {
  it('everyone who is signed in sees Payments; only an owner sees Privacy requests', () => {
    for (const role of ['owner', 'editor', 'viewer'] as const) expect(navFor(role).map((n) => n.id)).toContain('payments');
    expect(navFor('owner').map((n) => n.id)).toContain('privacy');
    expect(navFor('editor').map((n) => n.id)).not.toContain('privacy');
    expect(navFor('viewer').map((n) => n.id)).not.toContain('privacy');
  });

  it('the privacy capability is the owner\'s alone, and its page asks for it', () => {
    expect(can('owner', 'managePrivacy')).toBe(true);
    expect(can('editor', 'managePrivacy')).toBe(false);
    expect(can('viewer', 'managePrivacy')).toBe(false);
    expect(pageNeeds('/privacy')).toBe('managePrivacy');
    expect(pageNeeds('/payments')).toBeUndefined();
  });

  it('editors resolve payments (the write capability); viewers only read', () => {
    expect(can('editor', 'write')).toBe(true);
    expect(can('viewer', 'write')).toBe(false);
  });
});

describe('the answers it understands', () => {
  const payment = { _id: 'a1', paypalOrderId: 'ABCDEFGHIJ0123456', type: 'order', amount: 23, currency: 'USD', status: 'captured', createdAt: ago(5000) };

  it('a payment, with or without the optional fields', () => {
    expect(paymentSchema.safeParse(payment).success).toBe(true);
    expect(paymentSchema.safeParse({ ...payment, linkedTo: { kind: 'order', id: 'abc' }, resolvedAt: null, payerEmail: 'a@b.co', notes: 'x', extraField: 1 }).success).toBe(true);
    expect(paymentSchema.safeParse({ ...payment, amount: 'a lot' }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...payment, paypalOrderId: undefined }).success).toBe(false);
  });

  it('a page of payments', () => {
    expect(paymentsPage.safeParse({ items: [payment], total: 1, page: 1, size: 25 }).success).toBe(true);
  });

  it('the privacy answers are counts', () => {
    const counts = { orders: 1, candles: 0, contacts: 2, reviews: 0, payments: 3 };
    expect(privacyLookupSchema.safeParse({ found: counts }).success).toBe(true);
    expect(privacyEraseSchema.safeParse({ erased: counts }).success).toBe(true);
    expect(privacyLookupSchema.safeParse({ found: { orders: 1 } }).success).toBe(false);
  });

  it('the dashboard still parses from an API that predates the ledger (no alerts)', () => {
    const minimal = {
      totals: { orders: 0, ordersPending: 0, revenue: 0, candles: 0, candlesPending: 0, contacts: 0, contactsOpen: 0, products: 0, productReviews: 0, prayers: 0, reviews: 0 },
      last30Days: [], topProducts: [], lowStock: [], recent: { orders: [], candles: [], contacts: [] },
    };
    expect(dashboardSchema.safeParse(minimal).success).toBe(true);
    expect(dashboardSchema.safeParse({ ...minimal, alerts: { unfulfilledPayments: { count: 2, amount: 44.5 } } }).success).toBe(true);
    expect(dashboardSchema.safeParse({ ...minimal, alerts: { unfulfilledPayments: { count: 'two' } } }).success).toBe(false);
  });
});
