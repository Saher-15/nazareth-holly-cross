import { afterEach, describe, expect, it, vi } from 'vitest';
import { faqValues } from '@/data/pilgrim/faqEntries';
import { api } from '@/lib/api';
import { CANDLE_PRICE } from '@/lib/pricing';

// The candle price is the owner's setting (server/services/siteSettings.js), read from GET /candle/price.
describe('candle price on the website', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('the FAQ and the legal pages quote the price they are given, and the built-in default otherwise', () => {
    expect(faqValues('en', 4.5).price).toBe('$4.50');
    expect(faqValues('en').price).toBe(`$${CANDLE_PRICE.toFixed(2)}`);
  });

  it('reads the live price from the API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ price: 6, currency: 'USD' }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    expect(await api.candlePrice()).toBe(6);
  });

  it.each([
    ['the API cannot be reached', () => Promise.reject(new TypeError('fetch failed'))],
    ['the API answers an error', async () => new Response('{}', { status: 500 })],
    ['the answer is not a price', async () => new Response(JSON.stringify({ price: 'free', currency: 'USD' }), { status: 200, headers: { 'Content-Type': 'application/json' } })],
  ])('falls back to the default when %s (the page never breaks)', async (_, impl) => {
    vi.stubGlobal('fetch', vi.fn(impl));
    expect(await api.candlePrice()).toBe(CANDLE_PRICE);
  });
});
