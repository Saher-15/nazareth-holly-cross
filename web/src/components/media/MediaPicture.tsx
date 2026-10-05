import type { CSSProperties, SyntheticEvent } from 'react';
import { mediaDefaultFile, mediaObjectPosition, mediaSrcSet, type MediaItem } from '@/data/media';

type Props = {
  item: MediaItem;
  alt: string;
  /** The `sizes` attribute: how wide the picture is shown at each viewport width. */
  sizes: string;
  className?: string;
  /** Above-the-fold picture (a hero): loads at once and with high priority. */
  priority?: boolean;
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
  fill = false,
  draggable,
  onLoad,
  onError,
}: Props) {
  const style: CSSProperties = {
    ...(fill ? COVER : { maxWidth: '100%', height: 'auto' }),
    objectPosition: mediaObjectPosition(item),
    backgroundImage: `url("${item.blurDataURL}")`,
    backgroundSize: 'cover',
    backgroundPosition: mediaObjectPosition(item),
  };
  return (
    <picture>
      <source type="image/avif" srcSet={mediaSrcSet(item, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={mediaSrcSet(item, 'webp')} sizes={sizes} />
      {/* A plain <img> on purpose: the responsive AVIF/WebP files were generated ahead of time (scripts/media). */}
      <img
        className={className}
        src={mediaDefaultFile(item)}
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
