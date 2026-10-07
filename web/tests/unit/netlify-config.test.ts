// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// netlify.toml (repository root) is the only place where Netlify's CDN reads cache headers for the files of public/.
// There is no TOML parser in the project (no new dependencies), so the few things that matter are read with
// regular expressions.

const root = join(process.cwd(), '..');
const toml = readFileSync(join(root, 'netlify.toml'), 'utf8');
const publicDir = join(process.cwd(), 'public');

/** Every [[headers]] rule: the path it covers and the Cache-Control it sets (null when it sets another header). */
function headerRules() {
  return toml.split('[[headers]]').slice(1).map((block) => ({
    path: /for\s*=\s*"([^"]+)"/.exec(block)?.[1] ?? '',
    cache: /Cache-Control\s*=\s*"([^"]+)"/.exec(block)?.[1] ?? null,
  }));
}

describe('netlify.toml', () => {
  it('builds the Next.js app in web/ with the official runtime named explicitly (the public site once answered 404 without it)', () => {
    expect(toml).toMatch(/base\s*=\s*"web"/);
    expect(toml).toMatch(/\[\[plugins\]\][\s\S]*package\s*=\s*"@netlify\/plugin-nextjs"/);
    expect(toml).toMatch(/NODE_VERSION\s*=\s*"22"/);
  });

  it('keeps the fingerprinted build files immutable for a year', () => {
    const rule = headerRules().find((r) => r.path === '/_next/static/*');
    expect(rule?.cache).toBe('public, max-age=31536000, immutable');
  });

  it('never caches the service worker that retires the old one', () => {
    expect(headerRules().find((r) => r.path === '/sw.js')?.cache).toMatch(/no-store/);
  });

  it('gives every top-level folder of public/ a Cache-Control (Netlify ignores next.config.ts headers() for these files)', () => {
    const covered = headerRules().filter((r) => r.cache).map((r) => r.path);
    for (const entry of readdirSync(publicDir)) {
      if (!statSync(join(publicDir, entry)).isDirectory() || entry === '.well-known') continue;
      expect(covered, `public/${entry} has no [[headers]] rule in netlify.toml`).toContain(`/${entry}/*`);
    }
  });

  it('keeps public/ files that are not fingerprinted away from "immutable"', () => {
    for (const rule of headerRules()) {
      if (rule.path === '/_next/static/*' || !rule.cache || /no-store/.test(rule.cache)) continue;
      expect(rule.cache, rule.path).not.toMatch(/immutable/);
      const maxAge = Number(/max-age=(\d+)/.exec(rule.cache)?.[1]);
      expect(maxAge, rule.path).toBeLessThanOrEqual(60 * 60 * 24 * 31);
    }
  });

  it('sends the free netlify.app address of the public site to the real domain, for that exact host only', () => {
    const block = /\[\[redirects\]\][^[]*nazarethholycross\.netlify\.app[^[]*/.exec(toml)?.[0] ?? '';
    expect(block).toMatch(/from\s*=\s*"https:\/\/nazarethholycross\.netlify\.app\/\*"/);
    expect(block).toMatch(/to\s*=\s*"https:\/\/nazarethholycross\.com\/:splat"/);
    expect(block).toMatch(/status\s*=\s*301/);
    // not a catch-all: previews live on other host names and must keep working
    expect(toml).not.toMatch(/from\s*=\s*"\/\*"/);
  });

  it('sends http://www straight to the https apex in one hop', () => {
    const block = /\[\[redirects\]\][^[]*http:\/\/www\.nazarethholycross\.com[^[]*/.exec(toml)?.[0] ?? '';
    expect(block).toMatch(/to\s*=\s*"https:\/\/nazarethholycross\.com\/:splat"/);
    expect(block).toMatch(/status\s*=\s*301/);
    expect(block).toMatch(/force\s*=\s*true/);
  });
});

describe('public/.well-known/security.txt', () => {
  const text = readFileSync(join(publicDir, '.well-known', 'security.txt'), 'utf8');

  it('names a contact', () => {
    expect(text).toMatch(/^Contact:\s*mailto:\S+@\S+$/m);
  });

  it('has a valid Expires date no more than a year and a bit ahead (RFC 9116)', () => {
    // Not "has not expired": a test that starts failing on a fixed date would block an urgent fix. The expiry is
    // watched by ops/smoke-live.mjs instead (docs/MONITORING.md), which warns 30 days before.
    const expires = Date.parse(/^Expires:\s*(\S+)$/m.exec(text)?.[1] ?? '');
    expect(Number.isNaN(expires)).toBe(false);
    expect(expires).toBeLessThan(Date.now() + 400 * 24 * 60 * 60 * 1000);
  });
});
