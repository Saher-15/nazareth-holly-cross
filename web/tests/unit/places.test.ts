import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { keyStep, lastTileSpan, stepIndex, swipeStep, tileOf } from '@/components/places/galleryLogic';
import {
  LEGACY_REDIRECTS,
  PLACES,
  PLACE_SLUGS,
  TOUR_CARD,
  directionsUrl,
  getPlace,
  isPlaceSlug,
  photo,
  placeCards,
  type StoryBlock,
} from '@/data/places/places';
import { placeJsonLd } from '@/data/places/seo';
import { breadcrumbJsonLd, itemListJsonLd, serializeJsonLd } from '@/lib/jsonld';
import { localePath, pageMetadata } from '@/lib/seo';

type Messages = { [key: string]: string | Messages };
const english = JSON.parse(readFileSync(join(__dirname, '../../src/messages/en.json'), 'utf8')) as Messages;
const message = (key: string) =>
  key.split('.').reduce<string | Messages | undefined>((node, part) => (typeof node === 'object' ? node[part] : undefined), english);

const storyKeys = (block: StoryBlock) =>
  block.kind === 'text'
    ? [block.text]
    : block.kind === 'section'
      ? [block.title, block.text]
      : [block.title, ...block.points.flat()];

describe('gallery tiles', () => {
  it('makes the first photo a feature tile and spaces tall tiles, never at the end', () => {
    const tiles = Array.from({ length: 18 }, (_, i) => tileOf(i, 18));
    expect(tiles[0]).toBe('feature');
    expect(tiles.flatMap((t, i) => (t === 'tall' ? [i] : []))).toEqual([3, 9]);
    expect(tiles.slice(-4)).not.toContain('tall');
  });

  it('has no tall tile in a short gallery', () => {
    expect(Array.from({ length: 7 }, (_, i) => tileOf(i, 7))).toEqual([
      'feature',
      'normal',
      'normal',
      'normal',
      'normal',
      'normal',
      'normal',
    ]);
  });
});

describe('gallery ends on a full row', () => {
  // [photos, span in 2 columns, in 3 columns, in 4 columns]
  it.each([
    [27, 1, 3, 3],
    [18, 2, 2, 2],
    [7, 1, 3, 3],
    [16, 2, 1, 4],
    [12, 1, 3, 1],
  ])('%i photos: the last tile spans %i / %i / %i columns', (total, two, three, four) => {
    expect([lastTileSpan(total, 2), lastTileSpan(total, 3), lastTileSpan(total, 4)]).toEqual([two, three, four]);
  });

  it('leaves a single photo alone', () => {
    expect(lastTileSpan(1, 4)).toBe(1);
  });
});

describe('lightbox navigation', () => {
  it('wraps around at both ends', () => {
    expect(stepIndex(0, -1, 5)).toBe(4);
    expect(stepIndex(4, 1, 5)).toBe(0);
    expect(stepIndex(2, 1, 5)).toBe(3);
    expect(stepIndex(0, 1, 0)).toBe(0);
  });

  it('maps arrow keys to next/previous, mirrored right-to-left', () => {
    expect(keyStep('ArrowRight', false)).toBe(1);
    expect(keyStep('ArrowLeft', false)).toBe(-1);
    expect(keyStep('ArrowRight', true)).toBe(-1);
    expect(keyStep('ArrowLeft', true)).toBe(1);
    expect(keyStep('Enter', false)).toBe(0);
  });

  it('turns a sideways swipe into a step and ignores taps and vertical scrolls', () => {
    expect(swipeStep(-120, 10, false)).toBe(1); // finger to the left: next photo
    expect(swipeStep(120, 10, false)).toBe(-1);
    expect(swipeStep(120, 10, true)).toBe(1); // mirrored in Hebrew/Arabic
    expect(swipeStep(-30, 0, false)).toBe(0); // too short
    expect(swipeStep(-80, 200, false)).toBe(0); // mostly vertical
  });
});

describe('places data', () => {
  it('has the five places, in order, with unique slugs', () => {
    expect(PLACES.map((p) => p.slug)).toEqual([...PLACE_SLUGS]);
    expect(PLACE_SLUGS).toEqual(['latin', 'greek', 'maryswell', 'oldcity', 'city']);
    expect(isPlaceSlug('greek')).toBe(true);
    expect(isPlaceSlug('mary')).toBe(false);
    expect(getPlace('nowhere')).toBeUndefined();
  });

  it('points every photo at a file in public/ with a known size', () => {
    const photos = PLACES.flatMap((p) => [p.hero, p.cover, ...p.photos]).concat(TOUR_CARD.cover);
    for (const p of photos) {
      expect(existsSync(join(__dirname, '../../public', p.src)), p.src).toBe(true);
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
    }
    expect(PLACES.map((p) => p.photos.length)).toEqual([27, 18, 7, 16, 12]);
    expect(photo('old', 5).src).toBe('/images/old/old5.jpg');
    expect(getPlace('oldcity')?.photos[4].src).toBe('/images/old/old5.webp');
    expect(() => photo('mary', 8)).toThrow();
  });

  it('only uses message keys that exist in English', () => {
    const keys = PLACES.flatMap((p) => [
      p.nameKey,
      p.titleKey,
      `placesPage.kind.${p.slug}`,
      `placesPage.teaser.${p.slug}`,
      ...p.story.flatMap(storyKeys),
    ]);
    expect(keys.filter((key) => typeof message(key) !== 'string')).toEqual([]);
  });

  it('builds cards without the current place, optionally with the tour last', () => {
    const cards = placeCards({ exclude: 'greek', withTour: true });
    expect(cards.map((c) => c.key)).toEqual(['latin', 'maryswell', 'oldcity', 'city', 'tour']);
    expect(cards[0].href).toBe('/sites/latin');
    expect(placeCards().map((c) => c.key)).toEqual([...PLACE_SLUGS]);
  });

  it('maps the old site routes to the new ones', () => {
    expect(LEGACY_REDIRECTS).toContainEqual({ from: '/maryswell', to: '/sites/maryswell' });
    expect(LEGACY_REDIRECTS).toContainEqual({ from: '/city', to: '/sites/city' });
    expect(LEGACY_REDIRECTS).toHaveLength(PLACES.length);
  });

  it('links directions to the coordinates of the place', () => {
    expect(directionsUrl({ lat: 32.7, lng: 35.3 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=32.7%2C35.3',
    );
  });
});

describe('seo', () => {
  it('lists every language version and a canonical URL', () => {
    const meta = pageMetadata({ locale: 'he', path: '/sites/latin', title: 'T', description: 'D' });
    expect(meta.alternates?.canonical).toBe('/he/sites/latin');
    const languages = meta.alternates?.languages as Record<string, string>;
    expect(Object.keys(languages)).toHaveLength(12); // 11 languages + x-default
    expect(languages.ar).toBe('/ar/sites/latin');
    expect(languages['x-default']).toBe('/en/sites/latin');
    expect(localePath('fr', '/')).toBe('/fr');
  });

  it('describes a place as a tourist attraction with coordinates and absolute images', () => {
    const latin = getPlace('latin')!;
    const data = placeJsonLd(latin, { locale: 'en', name: 'Church', description: 'Desc' });
    expect(data['@type']).toEqual(['TouristAttraction', 'CatholicChurch']);
    expect(data.url).toMatch(/^https:\/\/.+\/en\/sites\/latin$/);
    expect(data.geo).toMatchObject({ latitude: 32.70222, longitude: 35.2975 });
    const images = data.image as string[];
    expect(images.every((src) => src.startsWith('https://'))).toBe(true);
    expect(new Set(images).size).toBe(images.length);
  });

  it('numbers breadcrumb and list items from 1', () => {
    const crumbs = breadcrumbJsonLd('en', [
      { name: 'Home', path: '/' },
      { name: 'Holy sites', path: '/sites' },
    ]);
    expect(crumbs.itemListElement).toMatchObject([{ position: 1 }, { position: 2 }]);
    const list = itemListJsonLd('el', 'Sites', [{ name: 'A', path: '/sites/latin' }]);
    expect(list.numberOfItems).toBe(1);
  });

  it('cannot be broken out of its script tag', () => {
    expect(serializeJsonLd({ name: '</script><script>alert(1)</script>' })).not.toContain('<');
  });
});
