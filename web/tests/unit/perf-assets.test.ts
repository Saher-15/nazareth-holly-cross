// @vitest-environment node
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEAN_WIDTHS, getMedia, mediaFile, mediaSrcSet } from '@/data/media';
import { HERO_TOUR_PARTS, HERO_VIDEO, LIVE_PRAYER_VIDEO, contentUrl } from '@/lib/videos';

const publicDir = join(process.cwd(), 'public');

describe('lean photo copies (the home hero)', () => {
  const hero = getMedia('city-sunset-glow');

  it('exist as AVIF and WebP in every lean width', () => {
    for (const width of LEAN_WIDTHS) {
      for (const format of ['avif', 'webp'] as const) {
        expect(existsSync(join(publicDir, mediaFile(hero, width, format, true)))).toBe(true);
      }
    }
  });

  it('are lighter than the normal files', () => {
    const size = (width: number, lean: boolean) => statSync(join(publicDir, mediaFile(hero, width, 'avif', lean))).size;
    for (const width of LEAN_WIDTHS) expect(size(width, true)).toBeLessThan(size(width, false) * 0.75);
  });

  it('give the browser a srcset of their own', () => {
    expect(mediaSrcSet(hero, 'avif', true)).toContain('/lean-1920.avif 1920w');
    expect(mediaSrcSet(hero, 'avif')).not.toContain('lean-');
  });
});

describe('videos in the repository', () => {
  const films = readdirSync(join(publicDir, 'videos'));

  // The home hero's tour (decided by the owner on 2026-10-07: self-hosted, so no video service bills the minutes a
  // background plays) is twelve parts of 30 s: each part is small, the whole film has a limit of its own.
  const TOUR_LIMIT = 25 * 1024 * 1024;
  const size = (src: string) => statSync(join(publicDir, src)).size;

  it('are each under 8 MB (larger ones belong on Firebase Storage, see docs/PERFORMANCE.md)', () => {
    expect(films.length).toBeGreaterThan(0);
    for (const file of films) expect(statSync(join(publicDir, 'videos', file)).size, file).toBeLessThan(8 * 1024 * 1024);
  });

  it('the hero tour is under 25 MB in all, and no part is over 3 MB (what a browser may hold at once is two parts)', () => {
    expect(HERO_TOUR_PARTS.reduce((sum, src) => sum + size(src), 0)).toBeLessThan(TOUR_LIMIT);
    for (const src of HERO_TOUR_PARTS) expect(size(src), src).toBeLessThan(3 * 1024 * 1024);
  });

  it('every local source of the site exists, and nothing else is left in public/videos', () => {
    const sources = [...HERO_TOUR_PARTS, ...[...HERO_VIDEO, ...LIVE_PRAYER_VIDEO].map((s) => s.src)];
    for (const src of sources) expect(existsSync(join(publicDir, src)), src).toBe(true);
    expect(films.map((file) => `/videos/${file}`).sort()).toEqual([...sources].sort());
  });

  it('every part of the hero tour is silent and starts playing before it has fully arrived (moov box first)', () => {
    for (const src of HERO_TOUR_PARTS) {
      const head = Buffer.alloc(64 * 1024);
      const fd = openSync(join(publicDir, src), 'r');
      readSync(fd, head, 0, head.length, 0);
      closeSync(fd);
      const moov = head.indexOf('moov');
      const mdat = head.indexOf('mdat');
      expect(moov, src).toBeGreaterThan(0);
      expect(mdat === -1 || moov < mdat, src).toBe(true);
      expect(head.indexOf('soun'), src).toBe(-1); // no sound track (an audio handler would be named 'soun')
    }
  });

  it('list the WebM before the MP4 fallback, and structured data points at the MP4', () => {
    expect(HERO_VIDEO[0].type).toMatch(/webm/);
    expect(HERO_VIDEO.at(-1)?.type).toBe('video/mp4');
    expect(contentUrl(LIVE_PRAYER_VIDEO, 'https://example.com')).toBe('https://example.com/videos/live-17-9-24.mp4');
  });
});

describe('fonts of the Hebrew and Arabic pages (src/styles/tokens.css)', () => {
  const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
  const fonts = read('src/lib/fonts.ts');
  const tokens = read('src/styles/tokens.css');
  // next/font/google names a face after its loader: EB_Garamond -> 'EB Garamond'.
  const family = (name: 'serif' | 'sans') => new RegExp(`export const ${name} = (\\w+)\\(`).exec(fonts)?.[1]?.replace(/_/g, ' ');

  it.each(['he', 'ar'])('%s: the preloaded Latin face first, by its real family name, then the script face', (lang) => {
    const rule = new RegExp(`:root:lang\\(${lang}\\) \\{([^}]*)\\}`).exec(tokens)?.[1] ?? '';
    expect(family('sans')).toBe('Inter');
    expect(rule).toContain(`--sans: '${family('sans')}', var(--font-${lang}-sans), var(--font-sans)`);
    expect(rule).toContain(`--serif: '${family('serif')}', var(--font-${lang}-serif), var(--font-serif)`);
  });
});
