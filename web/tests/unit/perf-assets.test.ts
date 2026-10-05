// @vitest-environment node
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEAN_WIDTHS, getMedia, mediaFile, mediaSrcSet } from '@/data/media';
import { HERO_VIDEO, LIVE_PRAYER_VIDEO, contentUrl } from '@/lib/videos';

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

  it('are each under 8 MB (larger ones belong on Firebase Storage, see docs/PERFORMANCE.md)', () => {
    expect(films.length).toBeGreaterThan(0);
    for (const file of films) expect(statSync(join(publicDir, 'videos', file)).size, file).toBeLessThan(8 * 1024 * 1024);
  });

  it('every local source of the site exists', () => {
    for (const source of [...HERO_VIDEO, ...LIVE_PRAYER_VIDEO]) {
      expect(existsSync(join(publicDir, source.src)), source.src).toBe(true);
    }
  });

  it('list the WebM before the MP4 fallback, and structured data points at the MP4', () => {
    expect(HERO_VIDEO[0].type).toMatch(/webm/);
    expect(HERO_VIDEO.at(-1)?.type).toBe('video/mp4');
    expect(contentUrl(LIVE_PRAYER_VIDEO, 'https://example.com')).toBe('https://example.com/videos/live-17-9-24.mp4');
  });
});
