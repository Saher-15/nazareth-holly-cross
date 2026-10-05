import React from 'react';

// Shared page header: optional background image, eyebrow, title and lead text.
export default function PageHero({ eyebrow, title, lead, image, imageAlt = '', children }) {
  return (
    <header className="ui-hero">
      {image && <img className="ui-hero__bg" src={image} alt={imageAlt} />}
      <div className="ui-container">
        {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
        <h1 className="ui-hero__title">{title}</h1>
        {lead && <p className="ui-hero__lead">{lead}</p>}
        {children}
      </div>
    </header>
  );
}
