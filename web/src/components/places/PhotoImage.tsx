import Image from 'next/image';
import type { SyntheticEvent } from 'react';
import MediaPicture from '@/components/media/MediaPicture';
import type { Photo } from '@/data/places/places';

type Props = {
  photo: Photo;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  /** Cover the positioned parent (the tiles, cards and heroes all do). */
  fill?: boolean;
  draggable?: boolean;
  /** CSS object-position of an older photo (its subject). Licensed photos carry their own focal point. */
  objectPosition?: string;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void;
};

// A place photo, whichever kind it is: a licensed photo with pre-built AVIF/WebP files (photo.media, see
// docs/MEDIA.md) is shown as <picture>; the older photos go through next/image.
export default function PhotoImage({
  photo,
  alt,
  sizes,
  className,
  priority = false,
  fill = true,
  draggable,
  objectPosition,
  onLoad,
  onError,
}: Props) {
  if (photo.media) {
    return (
      <MediaPicture
        item={photo.media}
        alt={alt}
        sizes={sizes}
        className={className}
        priority={priority}
        fill={fill}
        draggable={draggable}
        onLoad={onLoad}
        onError={onError}
      />
    );
  }
  return (
    <Image
      className={className}
      src={photo.src}
      alt={alt}
      sizes={sizes}
      {...(fill ? { fill: true } : { width: photo.width, height: photo.height })}
      {...(priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {})}
      draggable={draggable}
      style={objectPosition ? { objectPosition } : undefined}
      onLoad={onLoad}
      onError={onError}
    />
  );
}
