import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clip, FEATURED_COUNT, loadFeatured, loadVoices, MAX_VOICES, withTimeout } from '@/components/home/data';
import { localDay, parseFlames, serializeFlames } from '@/components/home/flames';
import { homeJsonLd } from '@/components/home/jsonLd';
import { SouvenirsView } from '@/components/home/Souvenirs';
import { nazarethDate, VERSE_COUNT, verseNumberFor } from '@/components/home/verse';
import { VoicesView } from '@/components/home/Voices';
import type { Product, Review } from '@/lib/api';
import { serializeJsonLd } from '@/lib/jsonld';
import { reviewerPlace } from '@/lib/reviews';
import messages from '@/messages/en.json';

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en${href}`} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const product = (i: number): Product => ({
  _id: `p${i}`,
  name: `Souvenir ${i}`,
  price: 10 + i,
  img: `https://firebasestorage.googleapis.com/v0/b/x/o/${i}?alt=media`,
  additionalImageUrls: [],
  description: '',
  rate: 0,
  color: [],
  stock: null,
});
const review = (over: Partial<Review> = {}): Review => ({
  _id: 'r1',
  fullName: 'Maria',
  email: 'Italy',
  msg: 'A blessed place.',
  ...over,
});

const withIntl = (ui: ReactNode) => (
  <NextIntlClientProvider locale="en" messages={messages}>
    {ui}
  </NextIntlClientProvider>
);

describe('verse of the day', () => {
  it('uses the calendar date in Nazareth, not the server clock', () => {
    // 22:30 UTC on 4 October is already 5 October in Nazareth (UTC+3).
    expect(nazarethDate(new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-05');
    expect(nazarethDate(new Date('2026-10-04T12:00:00Z'))).toBe('2026-10-04');
  });

  it('gives everyone the same verse on the same day, and a new one the next day', () => {
    expect(verseNumberFor('2026-10-05')).toBe(verseNumberFor('2026-10-05'));
    const week = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map((d) =>
      verseNumberFor(d),
    );
    expect(new Set(week).size).toBe(VERSE_COUNT);
    expect(verseNumberFor('2026-10-11')).toBe(week[0]);
  });

  it('always points at an existing verse (1..6), across month and year ends', () => {
    for (const d of ['1970-01-01', '2026-12-31', '2027-01-01', '2028-02-29']) {
      const n = verseNumberFor(d);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(VERSE_COUNT);
      expect(messages.home).toHaveProperty(`v${n}`);
    }
  });
});

describe('symbolic flame counter', () => {
  const today = '2026-10-05';

  it("reads today's count and resets on a new day", () => {
    expect(parseFlames(serializeFlames(4, today), today)).toBe(4);
    expect(parseFlames(serializeFlames(4, '2026-10-04'), today)).toBe(0);
  });

  it('treats missing or corrupt values as zero', () => {
    for (const raw of [null, '', 'not json', '{"day":"2026-10-05","count":-2}', '{"day":"2026-10-05","count":1.5}', '[]']) {
      expect(parseFlames(raw, today)).toBe(0);
    }
  });

  it('formats the local day as YYYY-MM-DD', () => {
    expect(localDay(new Date(2026, 0, 7, 23, 59))).toBe('2026-01-07');
  });
});

describe('home data loaders', () => {
  it('returns at most the featured number of products', async () => {
    const result = await loadFeatured(async () => Array.from({ length: 12 }, (_, i) => product(i)));
    expect(result.ok && result.products).toHaveLength(FEATURED_COUNT);
  });

  it('turns an API failure into a fallback instead of breaking the page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadFeatured(() => Promise.reject(new Error('503')))).toEqual({ ok: false });
    expect(await loadVoices(() => Promise.reject(new Error('503')))).toEqual([]);
  });

  it('gives up on a sleeping API after the timeout', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const never = () => new Promise<Product[]>(() => {});
    expect(await loadFeatured(never, 20)).toEqual({ ok: false });
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow(/timed out/);
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toBe(7);
  });

  it('keeps only reviews with a name and a message', async () => {
    const reviews = await loadVoices(async () => [
      review(),
      review({ _id: 'r2', msg: '   ' }),
      review({ _id: 'r3', fullName: '' }),
      ...Array.from({ length: 12 }, (_, i) => review({ _id: `x${i}` })),
    ]);
    expect(reviews).toHaveLength(MAX_VOICES);
    expect(reviews.every((r) => r.msg.trim() && r.fullName)).toBe(true);
  });
});

describe('text helpers', () => {
  it('clips long text at a word boundary', () => {
    const text = 'word '.repeat(80);
    const clipped = clip(text, 50);
    expect(clipped.length).toBeLessThanOrEqual(51);
    expect(clipped.endsWith('word…')).toBe(true);
    expect(clip('short', 50)).toBe('short');
  });

  it('never shows an e-mail address stored where the country should be', () => {
    expect(reviewerPlace({ email: 'Brazil' })).toBe('Brazil');
    expect(reviewerPlace({ email: 'someone@example.com' })).toBe('');
    expect(reviewerPlace({ email: '  ' })).toBe('');
  });

  it('escapes "<" in JSON-LD so no value can close the script tag', () => {
    const data = homeJsonLd({ locale: 'he', siteName: 'NHC', title: '</script><b>', description: 'd' });
    const json = serializeJsonLd(data);
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json)['@graph'][2]).toMatchObject({ inLanguage: 'he', name: '</script><b>' });
  });
});

describe('<SouvenirsView>', () => {
  it('links each product to its shop page with a localized price', () => {
    render(withIntl(<SouvenirsView id="s" locale="en" featured={{ ok: true, products: [product(1), product(2)] }} />));
    const link = screen.getByRole('link', { name: /Souvenir 1/ });
    expect(link).toHaveAttribute('href', '/en/shop/p1');
    expect(link).toHaveTextContent('$11.00');
  });

  it('shows a friendly note and the way to the shop when products cannot be loaded', () => {
    render(withIntl(<SouvenirsView id="s" locale="en" featured={{ ok: false }} />));
    expect(screen.getByText(messages.home.shopError)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: messages.home.shopAll })).toHaveAttribute('href', '/en/shop');
  });

  it('is left out when the shop is empty', () => {
    const { container } = render(withIntl(<SouvenirsView id="s" locale="en" featured={{ ok: true, products: [] }} />));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('<VoicesView>', () => {
  it('is hidden when there are no reviews', () => {
    const { container } = render(withIntl(<VoicesView id="v" reviews={[]} />));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the words, the name and the country', () => {
    render(withIntl(<VoicesView id="v" reviews={[review()]} />));
    expect(screen.getByText('A blessed place.')).toBeInTheDocument();
    expect(screen.getByText('Maria').closest('p')).toHaveTextContent('Maria · Italy');
    expect(screen.getByRole('group', { name: messages.home.voicesTitle })).toHaveAttribute('tabindex', '0');
  });
});
