import type { CSSProperties, SyntheticEvent } from 'react';
import { preload } from 'react-dom';
import { mediaDefaultFile, mediaFile, mediaObjectPosition, mediaSrcSet, type MediaItem } from '@/data/media';

type Props = {
  item: MediaItem;
  alt: string;
  /** The `sizes` attribute: how wide the picture is shown at each viewport width. */
  sizes: string;
  className?: string;
  /** Above-the-fold picture (a hero): loads at once and with high priority. */
  priority?: boolean;
  /** Use the lean copies (about half the bytes): only for a photo under a dark gradient, like the home hero. */
  lean?: boolean;
  /** Cover the positioned parent (like next/image `fill`); the focal point of the photo stays in view. */
  fill?: boolean;
  draggable?: boolean;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void;
};

const COVER: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };

// One licensed photo as <picture>: AVIF, then WebP, in every generated width, so the browser downloads the
// smallest file that is sharp enough for the slot. The 16px blur placeholder shows while it loads and the
// crop follows the focal point. Works in server and client components (no hooks).
export default function MediaPicture({
  item,
  alt,
  sizes,
  className,
  priority = false,
  lean = false,
  fill = false,
  draggable,
  onLoad,
  onError,
}: Props) {
  // The hero photo is the largest paint of its page: ask for the AVIF file in the document head, before the
  // stylesheet and scripts, with the same srcset/sizes as the <img> so the browser picks (and reuses) one file.
  if (priority) {
    preload(mediaFile(item, 1280, 'avif', lean), {
      as: 'image',
      type: 'image/avif',
      imageSrcSet: mediaSrcSet(item, 'avif', lean),
      imageSizes: sizes,
      fetchPriority: 'high',
    });
  }
  const style: CSSProperties = {
    ...(fill ? COVER : { maxWidth: '100%', height: 'auto' }),
    objectPosition: mediaObjectPosition(item),
    backgroundImage: `url("${item.blurDataURL}")`,
    backgroundSize: 'cover',
    backgroundPosition: mediaObjectPosition(item),
  };
  return (
    <picture>
      <source type="image/avif" srcSet={mediaSrcSet(item, 'avif', lean)} sizes={sizes} />
      <source type="image/webp" srcSet={mediaSrcSet(item, 'webp', lean)} sizes={sizes} />
      {/* A plain <img> on purpose: the responsive AVIF/WebP files were generated ahead of time (scripts/media). */}
      <img
        className={className}
        src={lean ? mediaFile(item, 1280, 'webp', true) : mediaDefaultFile(item)}
        alt={alt}
        width={item.width}
        height={item.height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        draggable={draggable}
        style={style}
        onLoad={onLoad}
        onError={onError}
      />
    </picture>
  );
}
