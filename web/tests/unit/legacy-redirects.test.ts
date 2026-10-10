import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGACY_REDIRECTS, PLACE_SLUGS, PLACES } from '@/data/places/places';
import { LEGACY_PLACE_SLUGS, legacyTarget } from '@/lib/legacyPaths';

// next.config.ts redirects the addresses of the previous site (/latin, /greek, ...) to the holy-site
// pages. It cannot import the place data, so this test keeps the two lists in step.
const config = readFileSync(join(__dirname, '../../next.config.ts'), 'utf8');

describe('addresses of the previous site', () => {
  it('next.config.ts redirects exactly the places the site has', () => {
    const list = /const places = \[([^\]]*)\]/.exec(config)?.[1] ?? '';
    const configured = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(configured.sort()).toEqual([...PLACE_SLUGS].sort());
  });

  it('sends each old place address to its holy-site page', () => {
    expect(LEGACY_REDIRECTS).toHaveLength(PLACES.length);
    // next.config.ts keeps the language-prefixed form (/en/latin); the proxy answers the bare one (/latin).
    expect(config).toContain('withLocale({ source: `/${slug}`, destination: `/sites/${slug}` })');
    for (const { from, to } of LEGACY_REDIRECTS) expect(to).toBe(`/sites${from}`);
  });

  it('never redirects a page to itself', () => {
    expect(LEGACY_REDIRECTS.filter((r) => r.from === r.to)).toEqual([]);
  });

  it("the proxy's own list (src/lib/legacyPaths.ts) matches the places and the old routes", () => {
    expect([...LEGACY_PLACE_SLUGS].sort()).toEqual([...PLACE_SLUGS].sort());
    for (const { from, to } of LEGACY_REDIRECTS) expect(legacyTarget(from)).toBe(to);
    expect(legacyTarget('/product/abc')).toBe('/shop/abc');
    expect(legacyTarget('/checkoutcandle')).toBe('/candle');
    expect(legacyTarget('/checkoutdonation')).toBe('/donate');
    expect(legacyTarget('/sites/latin')).toBeNull();
    expect(legacyTarget('/en/latin')).toBeNull();
  });
});
