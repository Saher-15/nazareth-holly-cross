import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import Flame from '@/components/ui/Flame';
import JsonLd from '@/components/ui/JsonLd';
import Notice from '@/components/ui/Notice';
import SvgIcon from '@/components/ui/SvgIcon';
import { locales } from '@/i18n/routing';
import { postJson } from '@/lib/apiClient';
import { isOptimizable } from '@/lib/images';
import { breadcrumbJsonLd, itemListJsonLd, organizationJsonLd, serializeJsonLd } from '@/lib/jsonLd';
import { prefersReducedMotion, scrollBehavior } from '@/lib/motion';
import { formatUsdWhole } from '@/lib/pricing';
import { remoteImageHosts } from '@/lib/remoteImageHosts';
import { absoluteUrl, localePath, pageAlternates, pageMetadata } from '@/lib/seo';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('lib/seo', () => {
  it('builds language paths, and the home page is just the language', () => {
    expect(localePath('he', '/sites/latin')).toBe('/he/sites/latin');
    expect(localePath('fr', '/')).toBe('/fr');
    expect(localePath('fr')).toBe('/fr');
  });

  it('makes paths absolute against the public site', () => {
    expect(absoluteUrl('/images/logo.webp')).toMatch(/^https:\/\/[^/]+\/images\/logo\.webp$/);
  });

  it('lists every language plus x-default, and a canonical of its own', () => {
    const alt = pageAlternates('ar', '/shop');
    expect(alt.canonical).toBe('/ar/shop');
    expect(Object.keys(alt.languages)).toHaveLength(locales.length + 1); // every language + x-default
    expect(alt.languages['x-default']).toBe('/en/shop');
    expect(pageAlternates('de').canonical).toBe('/de');
  });

  it('builds the Open Graph and Twitter cards of a page', () => {
    const meta = pageMetadata({
      locale: 'el',
      path: '/live',
      title: 'Live',
      description: 'Pray with us',
      image: { src: '/images/a.jpg', width: 800, height: 600 },
    });
    expect(meta.title).toBe('Live');
    expect(meta.openGraph).toMatchObject({
      url: '/el/live',
      siteName: 'Nazareth Holy Cross',
      locale: 'el_GR', // Open Graph wants language_TERRITORY
      images: [{ url: '/images/a.jpg', width: 800, height: 600 }],
    });
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image', title: 'Live' });
    expect(meta.robots).toBeUndefined();
  });

  it('accepts a plain image path, and falls back to a small card without an image', () => {
    expect(pageMetadata({ locale: 'en', path: '/', title: 'T', description: 'D', image: '/x.jpg' }).openGraph).toMatchObject({
      url: '/en',
      images: [{ url: '/x.jpg' }],
    });
    expect(pageMetadata({ locale: 'en', path: '/', title: 'T', description: 'D' }).twitter).toMatchObject({ card: 'summary' });
  });

  it('can drop the site name from the title, and can keep a page out of search results', () => {
    expect(pageMetadata({ locale: 'en', path: '/', title: 'Home', description: 'D', absoluteTitle: true }).title).toEqual({ absolute: 'Home' });
    expect(pageMetadata({ locale: 'en', path: '/cart', title: 'T', description: 'D', noindex: true }).robots).toEqual({
      index: false,
      follow: true,
    });
  });
});

describe('lib/jsonld', () => {
  it('cannot be used to close the script tag', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script>');
  });

  it('describes the organisation, optionally with an @id', () => {
    const org = organizationJsonLd({ name: 'NHC', id: 'https://x.test/#organization' });
    expect(org).toMatchObject({ '@type': 'Organization', '@id': 'https://x.test/#organization', name: 'NHC' });
    expect(org.logo).toMatch(/^https:\/\/.+\/images\/logo\.webp$/);
    expect(Array.isArray(org.sameAs)).toBe(true);
    expect(organizationJsonLd()).not.toHaveProperty('@id');
  });

  it('numbers breadcrumb and list items from 1 with absolute URLs', () => {
    const crumbs = breadcrumbJsonLd('he', [
      { name: 'Home', path: '/' },
      { name: 'Sites', path: '/sites' },
    ]);
    expect(crumbs.itemListElement).toMatchObject([{ position: 1 }, { position: 2 }]);
    expect(JSON.stringify(crumbs)).toMatch(/https:\/\/[^"]+\/he\/sites/);
    expect(itemListJsonLd('en', 'List', [{ name: 'A', path: '/sites/latin' }]).numberOfItems).toBe(1);
  });

  it('renders as one script tag', () => {
    const { container } = render(<JsonLd data={{ '@type': 'Thing', name: 'a<b' }} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script?.textContent).toBe('{"@type":"Thing","name":"a\\u003cb"}');
  });
});

describe('lib/images', () => {
  it('optimises the site’s own images and the hosts next.config.ts allows', () => {
    expect(isOptimizable('/images/logo.webp')).toBe(true);
    expect(isOptimizable('https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media')).toBe(true);
  });

  it('shows anything else unoptimised: next/image throws on a host it was not told about', () => {
    expect(isOptimizable('https://example.com/a.jpg')).toBe(false);
    expect(isOptimizable('//evil.test/a.jpg')).toBe(false);
    expect(isOptimizable('not a url')).toBe(false);
  });

  it('agrees with images.remotePatterns in next.config.ts', () => {
    const config = readFileSync(join(__dirname, '../../next.config.ts'), 'utf8');
    const configured = [...config.matchAll(/hostname:\s*'([^']+)'/g)].map((m) => m[1]);
    expect([...remoteImageHosts].sort()).toEqual(configured.sort());
  });
});

describe('lib/motion', () => {
  const stubMotion = (reduce: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce') }));

  it('scrolls smoothly unless the visitor asked for less motion', () => {
    stubMotion(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(scrollBehavior()).toBe('smooth');
    stubMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(scrollBehavior()).toBe('auto');
  });
});

describe('lib/pricing', () => {
  it('writes round dollar amounts without cents', () => {
    expect(formatUsdWhole(25)).toBe('$25');
    expect(formatUsdWhole(1000, 'en')).toBe('$1,000');
  });
});

describe('postJson', () => {
  const answer = (status: number, body: string) =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })));

  it('returns the parsed JSON, or the plain text some endpoints answer with', async () => {
    answer(200, '{"id":"A1"}');
    expect(await postJson('/x', {})).toEqual({ ok: true, data: { id: 'A1' } });
    answer(201, 'Created');
    expect(await postJson('/x', {})).toEqual({ ok: true, data: 'Created' });
  });

  it('reports the API’s error message and status', async () => {
    answer(422, '{"error":"Bad input"}');
    expect(await postJson('/x', {})).toEqual({ ok: false, status: 422, error: 'Bad input' });
    answer(500, 'oops');
    expect(await postJson('/x', {})).toEqual({ ok: false, status: 500, error: 'HTTP 500' });
  });

  it('never throws: a lost connection is status 0', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect(await postJson('/x', {})).toEqual({ ok: false, status: 0, error: 'network' });
  });

  it('treats a body that breaks off half way as a lost connection too', async () => {
    const broken = { ok: true, status: 200, text: async () => Promise.reject(new TypeError('terminated')) };
    vi.stubGlobal('fetch', vi.fn(async () => broken));
    expect(await postJson('/x', {})).toMatchObject({ ok: false, status: 0 });
  });

  it('validates the answer against a schema instead of trusting it', async () => {
    const schema = z.object({ id: z.string().min(1) });
    answer(200, '{"id":"ORDER1"}');
    expect(await postJson('/x', {}, { schema })).toEqual({ ok: true, data: { id: 'ORDER1' } });
    answer(200, '{"nope":true}');
    expect(await postJson('/x', {}, { schema })).toEqual({ ok: false, status: 502, error: 'unexpected response' });
  });

  it('gives up after the timeout when one is set', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))),
    );
    expect(await postJson('/x', {}, { timeoutMs: 20 })).toMatchObject({ ok: false, status: 0 });
  });
});

describe('proxy matcher', () => {
  // next-intl's proxy must see every page address (so /shop becomes /en/shop) and no asset or API route.
  // The matcher is read as written in src/proxy.ts and evaluated as the JavaScript string it is: this is
  // what catches a regex escape that the string literal swallows (single backslash before the dot).
  const source = readFileSync(join(__dirname, '../../src/proxy.ts'), 'utf8');
  const literal = /matcher:\s*\[\s*('(?:[^'\\]|\\.)*')\s*,?\s*\]/.exec(source)?.[1] ?? '';
  const matcher: string = new Function(`return ${literal}`)();
  const pattern = new RegExp(`^${matcher}$`);

  it('is found in the proxy file', () => {
    expect(matcher).toContain('_next');
  });

  it('catches pages with and without a language', () => {
    for (const path of ['/', '/en', '/shop', '/sites/latin', '/latin', '/en/shop/123', '/product/66eb4665c7e03262956c8d1d']) {
      expect(pattern.test(path), path).toBe(true);
    }
  });

  it('leaves API routes, Next internals and files alone', () => {
    for (const path of ['/api/x', '/_next/static/chunk.js', '/_vercel/insights', '/favicon.ico', '/sw.js', '/images/logo.webp', '/sounds/Christians.mp3']) {
      expect(pattern.test(path), path).toBe(false);
    }
  });
});

describe('<Notice>', () => {
  it('announces an error at once and marks the tone', () => {
    render(<Notice role="alert">Something went wrong</Notice>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('can be a polite note', () => {
    render(
      <Notice tone="info" role="status">
        Payment cancelled
      </Notice>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Payment cancelled');
  });
});

describe('<Flame> and <SvgIcon>', () => {
  it('draws a decorative flame in the requested size and ink', () => {
    const { container } = render(<Flame size="lg" ink className="extra" />);
    const flame = container.firstElementChild as HTMLElement;
    expect(flame).toHaveAttribute('aria-hidden', 'true');
    expect(flame.className).toContain('extra');
    expect(flame.className.split(' ').length).toBeGreaterThanOrEqual(4); // base + size + ink + extra
  });

  it('draws icons decoratively on a 24x24 frame', () => {
    const { container } = render(
      <SvgIcon size={30}>
        <path d="M0 0" />
      </SvgIcon>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('width', '30');
  });
});
