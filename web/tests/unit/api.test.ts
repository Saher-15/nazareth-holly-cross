import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, catalogProductSchema, productSchema, retryDelayMs } from '@/lib/api';

describe('productSchema', () => {
  const raw = {
    _id: '66eb4665c7e03262956c8d1d',
    name: 'Olive oil',
    price: 10,
    img: 'https://firebasestorage.googleapis.com/v0/b/x/o/a?alt=media&amp;token=abc',
    additionalImageUrls: ['https://firebasestorage.googleapis.com/v0/b/x/o/b?alt=media&amp;token=def'],
  };

  it('repairs HTML-escaped image URLs stored by the old sanitiser', () => {
    const product = productSchema.parse(raw);
    expect(product.img).toBe('https://firebasestorage.googleapis.com/v0/b/x/o/a?alt=media&token=abc');
    expect(product.additionalImageUrls[0]).not.toContain('&amp;');
  });

  it('fills optional fields with safe defaults', () => {
    const product = productSchema.parse({ ...raw, additionalImageUrls: undefined });
    expect(product.additionalImageUrls).toEqual([]);
    expect(product.color).toEqual([]);
    expect(product.stock).toBeNull();
  });

  it('rejects a product without a price', () => {
    expect(() => productSchema.parse({ ...raw, price: undefined })).toThrow();
  });
});

describe('null-tolerant schemas (live records hold null in optional fields)', () => {
  const raw = { _id: 'x', name: 'Rosary', price: 15, img: 'https://a/b' };

  it('accepts null colour, images, description and stock', () => {
    const p = productSchema.parse({ ...raw, color: null, additionalImageUrls: null, description: null, stock: null });
    expect(p).toMatchObject({ color: [], additionalImageUrls: [], description: '', stock: null });
  });

  it('normalises catalog fields and maps unknown categories to gifts', () => {
    const p = catalogProductSchema.parse({ ...raw, category: 'spaceships', materials: ['gold', 'plastic'], rating: null });
    expect(p.category).toBe('gifts');
    expect(p.materials).toEqual(['gold']);
    expect(p.rating).toEqual({ avg: 0, count: 0 });
  });
});

describe('reading from the API retries a rate limit', () => {
  const review = { _id: 'r1', fullName: 'Maria', email: 'Israel', msg: 'Beautiful' };
  const reply = (status: number, body: unknown = [], headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('QA-09 answers after a 429 followed by a success, honouring Retry-After', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(429, {}, { 'Retry-After': '1' })).mockResolvedValueOnce(reply(200, [review]));
    vi.stubGlobal('fetch', fetchMock);
    const pending = api.reviews();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual([review]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after two retries with the status of the last answer', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(reply(503, {})));
    vi.stubGlobal('fetch', fetchMock);
    const assertion = expect(api.reviews()).rejects.toMatchObject({ name: 'ApiError', status: 503 });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry a missing page', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(reply(404, {})));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.reviews()).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('waits at most 3 seconds, however long the API asks', () => {
    expect(retryDelayMs(0, '120')).toBe(3000);
    expect(retryDelayMs(0, '1')).toBe(1000);
    expect(retryDelayMs(1, null)).toBeGreaterThanOrEqual(800);
    expect(retryDelayMs(1, null)).toBeLessThan(1200);
    expect(retryDelayMs(0, 'Wed, 21 Oct 2026 07:28:00 GMT')).toBeLessThan(800);
  });
});
