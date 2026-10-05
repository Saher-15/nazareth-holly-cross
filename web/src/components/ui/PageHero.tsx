import type { ReactNode } from 'react';
import Image from 'next/image';
import MediaPicture from '@/components/media/MediaPicture';
import type { MediaItem } from '@/data/media';

type Props = {
  title: string;
  eyebrow?: string;
  lead?: string;
  /** A licensed photo (docs/MEDIA.md): pre-built AVIF/WebP in several widths, sharp on every screen. Preferred. */
  media?: MediaItem;
  /** An older photo of this site, served through next/image. Use `media` for anything new. */
  image?: string;
  imageAlt?: string;
  children?: ReactNode;
};

// The band is full-width and 260-420px tall: the photo is only ever as wide as the screen.
const HERO_SIZES = '100vw';

// Shared page header: background photo, eyebrow, title and lead text.
export default function PageHero({ title, eyebrow, lead, media, image, imageAlt = '', children }: Props) {
  return (
    <header className="ui-hero">
      {media ? (
        <MediaPicture className="ui-hero__bg" item={media} alt={imageAlt} sizes={HERO_SIZES} fill priority />
      ) : (
        image && <Image className="ui-hero__bg" src={image} alt={imageAlt} fill preload sizes={HERO_SIZES} />
      )}
      <div className="ui-container">
        {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
        <h1 className="ui-hero__title">{title}</h1>
        {lead && <p className="ui-hero__lead">{lead}</p>}
        {children}
      </div>
    </header>
  );
}
