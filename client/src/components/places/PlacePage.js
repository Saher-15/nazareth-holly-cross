import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SiGooglemaps } from 'react-icons/si';
import PageHero from '../ui/PageHero';
import Reveal from '../ui/Reveal';
import PlaceGallery from './PlaceGallery';
import PlaceCards from './PlaceCards';
import '../../styles/Pages.css';

// Google Maps link of a place (opens in a new tab, like the old map icon did).
function MapLink({ url, className, t }) {
  return (
    <a className={className} href={url} target="_blank" rel="noopener noreferrer">
      <SiGooglemaps aria-hidden="true" focusable="false" />
      <span>{t('headerGreek.mapButton')}</span>
      <span className="place-sr"> {t('places.newTab')}</span>
    </a>
  );
}

// Text blocks of a place: plain paragraphs, titled sections, or titled lists of points.
function PlaceStory({ story, t }) {
  return story.map((block, i) => {
    if (block.points) {
      return (
        <div key={block.title} className="place-block">
          <h3 className="ui-h3">{t(block.title)}</h3>
          <ul className="place-points">
            {block.points.map(([title, text]) => (
              <li key={title} className="place-point">
                <strong className="place-point__title">{t(title)}</strong>
                <span>{t(text)}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    if (block.title) {
      return (
        <div key={block.title} className="place-block">
          <h3 className="ui-h3">{t(block.title)}</h3>
          <p>{t(block.text)}</p>
        </div>
      );
    }
    return (
      <p key={block.text} className={i === 0 ? 'place-lead' : undefined}>
        {t(block.text)}
      </p>
    );
  });
}

// One holy place: hero, story + visit card, photo gallery with lightbox, other places.
function PlacePage({ place }) {
  const { t } = useTranslation();
  const galleryRef = useRef(null);
  const name = t(place.nameKey);
  const count = place.images.length;

  const toGallery = (e) => {
    const el = galleryRef.current;
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  };

  return (
    <main className="ui-page place-page">
      <PageHero eyebrow={t('home.sitesEyebrow')} title={name} image={place.hero}>
        <div className="place-hero__actions">
          <MapLink url={place.mapUrl} className="ui-btn ui-btn--gold" t={t} />
          <a className="ui-btn ui-btn--glass" href="#place-gallery" onClick={toGallery}>
            {t('places.viewGallery')}{' '}
            <span className="place-hero__count">{count}</span>
          </a>
        </div>
      </PageHero>

      <section className="ui-section place-story" aria-labelledby="place-story-title">
        <div className="ui-container place-story__grid">
          <Reveal className="place-story__main">
            <p className="ui-eyebrow">{t('home.storyEyebrow')}</p>
            <h2 id="place-story-title" className="ui-h2">{t(place.titleKey)}</h2>
            <div className="place-prose">
              <PlaceStory story={place.story} t={t} />
            </div>
          </Reveal>

          <Reveal as="aside" className="place-visit ui-glass ui-card" delay={120} aria-labelledby="place-visit-title">
            <p id="place-visit-title" className="ui-eyebrow">{t('places.visitEyebrow')}</p>
            <p className="place-visit__text">{t('places.visitText')}</p>
            <div className="place-visit__actions">
              <MapLink url={place.mapUrl} className="ui-btn ui-btn--ghost" t={t} />
              <Link className="ui-btn ui-btn--gold" to="/candle">
                <span className="place-flame" aria-hidden="true" />
                {t('home.stickyCandle')}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section
        id="place-gallery"
        ref={galleryRef}
        tabIndex={-1}
        className="ui-section place-gallery"
        aria-labelledby="place-gallery-title"
      >
        <div className="ui-container">
          <Reveal as="header" className="place-head">
            <p className="ui-eyebrow">{t('places.galleryEyebrow')}</p>
            <h2 id="place-gallery-title" className="ui-h2">{t('places.galleryTitle')}</h2>
            <p className="ui-muted">
              {t('places.photoCount', { n: count })} · {t('places.galleryHint')}
            </p>
          </Reveal>
          <PlaceGallery images={place.images} name={name} />
        </div>
      </section>

      <section className="ui-section place-more" aria-labelledby="place-more-title">
        <div className="ui-container">
          <Reveal as="header" className="place-head">
            <p className="ui-eyebrow">{t('places.moreEyebrow')}</p>
            <h2 id="place-more-title" className="ui-h2">{t('home.sitesTitle')}</h2>
          </Reveal>
          <PlaceCards exclude={place.id} withTour />
        </div>
      </section>
    </main>
  );
}

export default PlacePage;
