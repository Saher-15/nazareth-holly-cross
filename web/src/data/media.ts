import { MEDIA_ITEMS } from './media.generated';
import { MEDIA_SUBJECTS, MEDIA_TOPICS, type MediaItem, type MediaSubject, type MediaTopic } from './media-types';

// Licensed, attributed photos of Nazareth and its churches (see docs/MEDIA.md for sources and licences).
// The manifest in media.generated.ts is produced by scripts/media/build.mjs; use these helpers to read it.

export { MEDIA_SUBJECTS, MEDIA_TOPICS };
export type { MediaItem, MediaSubject, MediaTopic };

/** Folder of the generated files of one image. */
export const MEDIA_BASE = '/images/nazareth-media';

/** Every image, in the order of the manifest. */
export const MEDIA: readonly MediaItem[] = MEDIA_ITEMS;

const BY_ID = new Map(MEDIA.map((item) => [item.id, item]));

/** One image by id; throws for an unknown id so a typo fails the build instead of showing a hole. */
export function getMedia(id: string): MediaItem {
  const item = BY_ID.get(id);
  if (!item) throw new Error(`Unknown media id: ${id}`);
  return item;
}

export const hasMedia = (id: string) => BY_ID.has(id);

/** Images of one topic, in manifest order. */
export const mediaByTopic = (topic: MediaTopic): readonly MediaItem[] => MEDIA.filter((item) => item.topic === topic);

/** Path of one generated file: `mediaFile(item, 1280, 'webp')` is `/images/nazareth-media/<id>/1280.webp`. */
export const mediaFile = (item: Pick<MediaItem, 'id'>, width: number, format: 'avif' | 'webp') =>
  `${MEDIA_BASE}/${item.id}/${width}.${format}`;

/** `srcset` of one format: every generated width, e.g. "/…/640.avif 640w, /…/1280.avif 1280w". */
export const mediaSrcSet = (item: MediaItem, format: 'avif' | 'webp') =>
  item.widths.map((w) => `${mediaFile(item, w, format)} ${w}w`).join(', ');

/** A mid-size file (the largest width up to 1280): the fallback `src` and the share image. */
export function mediaDefaultFile(item: MediaItem, format: 'avif' | 'webp' = 'webp') {
  const width = [...item.widths].reverse().find((w) => w <= 1280) ?? item.widths[0];
  return mediaFile(item, width, format);
}

/** The 1200x630 social card when one was generated, else the 1280px WebP. */
export const mediaShareFile = (item: MediaItem) => (item.og ? `${MEDIA_BASE}/${item.id}/og.jpg` : mediaDefaultFile(item));

/** CSS `object-position` of the focal point. */
export const mediaObjectPosition = (item: Pick<MediaItem, 'focal'>) => `${item.focal.x}% ${item.focal.y}%`;
