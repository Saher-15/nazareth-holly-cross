import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHero from './ui/PageHero';
import Reveal from './ui/Reveal';
import PlaceCards from './places/PlaceCards';
import '../styles/NazarethTour.css';

const TOUR_VIDEO =
  'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Ftour.mp4?alt=media&token=af5c1463-2e97-4ae3-b205-a7566f45f9be';
const TOUR_POSTER = '/images/nazareth/nazareth1.webp';

// Virtual tour: hero, the tour video (nothing is downloaded until play), then the holy places.
const NazarethTour = () => {
  const { t } = useTranslation();

  return (
    <main className="ui-page tour-page">
      <PageHero
        eyebrow={t('home.siteTour')}
        title={t('nazarethTour.pageHeading')}
        lead={t('nazarethTour.videoMessage')}
        image="/images/old/old11.jpg"
      />

      <section className="ui-section tour-watch" aria-labelledby="tour-watch-title">
        <div className="ui-container tour-watch__grid">
          <Reveal className="tour-player">
            <div className="tour-player__frame">
              <video
                className="tour-player__video"
                controls
                preload="none"
                playsInline
                poster={TOUR_POSTER}
                aria-label={t('places.tourVideoLabel')}
              >
                <source src={TOUR_VIDEO} type="video/mp4" />
                {t('places.videoFallback')}
              </video>
            </div>
          </Reveal>

          <Reveal className="tour-copy" delay={120}>
            <p className="ui-eyebrow">{t('places.tourWatchEyebrow')}</p>
            <h2 id="tour-watch-title" className="ui-h2">{t('places.tourVideoLabel')}</h2>
            <p className="tour-copy__text">{t('nazarethTour.videoDescription')}</p>
            <Link to="/" className="ui-btn ui-btn--gold">
              {t('nazarethTour.ctaButton')}
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="ui-section tour-places" aria-labelledby="tour-places-title">
        <div className="ui-container">
          <Reveal as="header" className="tour-head">
            <p className="ui-eyebrow">{t('home.sitesEyebrow')}</p>
            <h2 id="tour-places-title" className="ui-h2">{t('home.sitesTitle')}</h2>
          </Reveal>
          <PlaceCards />
        </div>
      </section>
    </main>
  );
};

export default NazarethTour;
