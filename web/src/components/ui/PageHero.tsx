import type { ReactNode } from 'react';
import Image from 'next/image';

type Props = {
  title: string;
  eyebrow?: string;
  lead?: string;
  image?: string;
  imageAlt?: string;
  children?: ReactNode;
};

// Shared page header: background photo, eyebrow, title and lead text.
export default function PageHero({ title, eyebrow, lead, image, imageAlt = '', children }: Props) {
  return (
    <header className="ui-hero">
      {image && <Image className="ui-hero__bg" src={image} alt={imageAlt} fill preload sizes="100vw" />}
      <div className="ui-container">
        {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
        <h1 className="ui-hero__title">{title}</h1>
        {lead && <p className="ui-hero__lead">{lead}</p>}
        {children}
      </div>
    </header>
  );
}
