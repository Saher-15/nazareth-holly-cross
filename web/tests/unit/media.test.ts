import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MEDIA,
  MEDIA_SUBJECTS,
  MEDIA_TOPICS,
  getMedia,
  hasMedia,
  mediaByTopic,
  mediaDefaultFile,
  mediaFile,
  mediaObjectPosition,
  mediaShareFile,
  mediaSrcSet,
} from '@/data/media';
import { PLACES, PLACE_OF_TOPIC, mediaPhoto } from '@/data/places/places';

type Messages = { [key: string]: string | Messages };
const english = JSON.parse(readFileSync(join(__dirname, '../../src/messages/en.json'), 'utf8')) as Messages;
const media = english.media as Messages;
const publicDir = join(__dirname, '../../public');

// Only public domain, CC0, CC BY and CC BY-SA may be used on a commercial site (docs/MEDIA.md).
const ALLOWED_LICENSE = /^(CC0( 1\.0)?|Public domain|PD[ -][\w.-]+|CC BY(-SA)? \d\.\d( \w+)?)$/i;

describe('media manifest', () => {
  it('has between 20 and 40 images with unique ids and unique source files', () => {
    expect(MEDIA.length).toBeGreaterThanOrEqual(20);
    expect(MEDIA.length).toBeLessThanOrEqual(40);
    expect(new Set(MEDIA.map((m) => m.id)).size).toBe(MEDIA.length);
    expect(new Set(MEDIA.map((m) => m.file)).size).toBe(MEDIA.length);
  });

  it('only contains openly licensed images, each with an author, a licence link and a Commons source', () => {
    for (const m of MEDIA) {
      expect(m.license, m.id).toMatch(ALLOWED_LICENSE);
      expect(m.license, m.id).not.toMatch(/\b(NC|ND)\b/);
      expect(m.author.trim().length, m.id).toBeGreaterThan(1);
      expect(m.credit, m.id).toContain(m.author);
      expect(m.credit, m.id).toContain(m.license);
      expect(m.sourceUrl, m.id).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      if (!/^(CC0|Public domain|PD)/i.test(m.license)) expect(m.licenseUrl, m.id).toMatch(/^https:\/\/creativecommons\.org\/licenses\//);
    }
  });

  it('has an English alt text, a known topic and subject, a focal point and a blur placeholder', () => {
    for (const m of MEDIA) {
      expect(m.alt.length, m.id).toBeGreaterThan(15);
      expect(MEDIA_TOPICS, m.id).toContain(m.topic);
      expect(MEDIA_SUBJECTS, m.id).toContain(m.subject);
      expect(m.focal.x).toBeGreaterThanOrEqual(0);
      expect(m.focal.x).toBeLessThanOrEqual(100);
      expect(m.focal.y).toBeGreaterThanOrEqual(0);
      expect(m.focal.y).toBeLessThanOrEqual(100);
      expect(m.blurDataURL, m.id).toMatch(/^data:image\/webp;base64,/);
      expect(m.blurDataURL.length, m.id).toBeLessThan(1500);
    }
  });

  it('ships every responsive file it lists, sharp enough (at least 1920px wide) and not oversized', () => {
    for (const m of MEDIA) {
      expect(m.widths, m.id).toEqual([...m.widths].sort((a, b) => a - b));
      expect(m.widths[m.widths.length - 1], m.id).toBe(m.width);
      expect(m.width, m.id).toBeGreaterThanOrEqual(1920);
      for (const w of m.widths) {
        for (const format of ['avif', 'webp'] as const) {
          const file = join(publicDir, mediaFile(m, w, format));
          expect(existsSync(file), file).toBe(true);
          expect(statSync(file).size, file).toBeLessThan(1_200_000);
        }
      }
      if (m.og) expect(existsSync(join(publicDir, mediaShareFile(m))), m.id).toBe(true);
    }
  });

  it('reads a photo by id and refuses an unknown id', () => {
    const first = MEDIA[0];
    expect(getMedia(first.id)).toBe(first);
    expect(hasMedia(first.id)).toBe(true);
    expect(hasMedia('nope')).toBe(false);
    expect(() => getMedia('nope')).toThrow(/Unknown media id/);
  });

  it('builds srcset and file paths from the widths', () => {
    const m = MEDIA[0];
    const set = mediaSrcSet(m, 'avif').split(', ');
    expect(set).toHaveLength(m.widths.length);
    expect(set[0]).toBe(`/images/nazareth-media/${m.id}/${m.widths[0]}.avif ${m.widths[0]}w`);
    expect(mediaDefaultFile(m)).toMatch(/\/1280\.webp$/);
    expect(mediaObjectPosition({ focal: { x: 30, y: 60 } })).toBe('30% 60%');
  });

  it('describes every topic and subject in English so the alt texts can be built', () => {
    const topics = media.topic as Messages;
    const subjects = media.subject as Messages;
    for (const topic of MEDIA_TOPICS) expect(typeof topics[topic], topic).toBe('string');
    for (const subject of MEDIA_SUBJECTS) expect(typeof subjects[subject], subject).toBe('string');
  });

  it('gives every topic at least two photos and every holy-site page a licensed hero', () => {
    for (const topic of MEDIA_TOPICS) expect(mediaByTopic(topic).length, topic).toBeGreaterThanOrEqual(2);
    for (const place of PLACES) {
      expect(place.hero.media, place.slug).toBeDefined();
      expect(place.photos.some((p) => p.media), place.slug).toBe(true);
    }
    expect(Object.keys(PLACE_OF_TOPIC).sort()).toEqual([...MEDIA_TOPICS].sort());
  });

  it('turns a media item into a place photo whose share image exists', () => {
    for (const m of MEDIA) {
      const photo = mediaPhoto(m.id);
      expect(photo.media).toBe(m);
      expect(existsSync(join(publicDir, photo.src)), photo.src).toBe(true);
    }
    expect(mediaPhoto(MEDIA.find((m) => m.og)!.id)).toMatchObject({ width: 1200, height: 630 });
  });
});
