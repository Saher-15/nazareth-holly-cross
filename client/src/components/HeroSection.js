import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../styles/Home.css';

const VIDEO_URL =
  'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fvideo-7.mp4?alt=media&token=b0173721-21a1-46d0-b15b-f2001b912e72';
const POSTER = '/images/nazareth/nazareth1.webp';

// Skip the background video for visitors who asked for less motion or less data.
function shouldPlayVideo() {
  if (typeof window === 'undefined') return false;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  return !reduce && !saveData;
}

function HeroSection() {
  const { t } = useTranslation();
  const [playVideo] = useState(shouldPlayVideo);
  const [soundOn, setSoundOn] = useState(false);
  const audioRef = useRef(null);

  const resetShopFilters = () => {
    localStorage.removeItem('searchQuery');
    localStorage.removeItem('sortOrder');
    localStorage.setItem('currentPage', 1);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggleSound = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/christians.mp3');
      audioRef.current.loop = true;
    }
    const audio = audioRef.current;
    if (soundOn) {
      audio.pause();
      setSoundOn(false);
    } else {
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
      setSoundOn(true);
    }
  };

  return (
    <header className="hx-hero" id="hx-hero">
      <div className="hx-hero__media" aria-hidden="true">
        <img className="hx-hero__poster" src={POSTER} alt="" />
        {playVideo && (
          <video
            className="hx-hero__video"
            src={VIDEO_URL}
            poster={POSTER}
            preload="none"
            autoPlay
            loop
            muted
            playsInline
            tabIndex={-1}
          />
        )}
        <div className="hx-hero__shade" />
      </div>

      <div className="hx-hero__content">
        <p className="hx-eyebrow hx-hero__eyebrow">{t('home.eyebrow')}</p>
        <h1 className="hx-hero__title">{t('home.title')}</h1>
        <p className="hx-hero__sub">{t('home.subtitle')}</p>

        <div className="hx-hero__actions">
          <Link to="/candle" className="hx-btn hx-btn--gold hx-btn--lg">
            <span className="hx-flame hx-flame--sm hx-flame--dark" aria-hidden="true" />
            {t('heroSection.lightCandle')}
          </Link>
          <Link to="/tour" className="hx-btn hx-btn--glass hx-btn--lg">
            {t('heroSection.tourButton')}
          </Link>
          <Link to="/shop" onClick={resetShopFilters} className="hx-btn hx-btn--glass hx-btn--lg">
            {t('heroSection.shopButton')}
          </Link>
        </div>

        <Link to="/shop" onClick={resetShopFilters} className="hx-hero__offer">
          {t('heroSection.discount')}
        </Link>
      </div>

      <button
        type="button"
        className="hx-hero__sound"
        onClick={toggleSound}
        aria-pressed={soundOn}
        aria-label={t('home.soundToggle')}
      >
        <i className={soundOn ? 'fas fa-volume-up' : 'fas fa-volume-mute'} aria-hidden="true" />
      </button>

      <a className="hx-hero__scroll" href="#hx-sites" aria-label={t('home.scroll')}>
        <span>{t('home.scroll')}</span>
        <i className="fas fa-chevron-down" aria-hidden="true" />
      </a>
    </header>
  );
}

export default HeroSection;
