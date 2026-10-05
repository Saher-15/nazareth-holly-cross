import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Reveal from './home/Reveal';
import '../styles/Home.css';

const SITES = [
  { path: '/latin', img: '/images/latin/latin1.jpg', key: 'siteLatin' },
  { path: '/greek', img: '/images/greek/greek1.jpg', key: 'siteGreek' },
  { path: '/maryswell', img: '/images/mary/mary4.jpg', key: 'siteMary' },
  { path: '/oldcity', img: '/images/old/old2.jpg', key: 'siteOld' },
  { path: '/city', img: '/images/nazareth/nazareth1.webp', key: 'siteCity' },
  { path: '/tour', img: '/images/jesus_city_tour.png', key: 'siteTour' },
];

// Horizontal scroll-snap carousel of the holy sites.
// Touch swipe is native; mouse drag, arrow buttons and the keyboard
// (Left/Right/Home/End on the track) are added on top.
function Cards() {
  const { t } = useTranslation();
  const trackRef = useRef(null);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth - 2;
    const left = Math.abs(el.scrollLeft);
    setEdges({ start: left <= 2, end: left >= max });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const step = () => {
    const el = trackRef.current;
    const card = el && el.querySelector('.hx-site');
    return card ? card.getBoundingClientRect().width + 16 : 300;
  };

  const go = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * step(), behavior: reduce ? 'auto' : 'smooth' });
  };

  const onKeyDown = (e) => {
    if (e.target !== trackRef.current) return; // let focused links keep their own keys
    const el = trackRef.current;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'Home') { e.preventDefault(); el.scrollTo({ left: 0 }); }
    else if (e.key === 'End') { e.preventDefault(); el.scrollTo({ left: el.scrollWidth }); }
  };

  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = trackRef.current;
    drag.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 5) {
      d.moved = true;
      trackRef.current.classList.add('is-dragging');
    }
    if (d.moved) trackRef.current.scrollLeft = d.startLeft - dx;
  };
  const endDrag = () => {
    drag.current.active = false;
    if (trackRef.current) trackRef.current.classList.remove('is-dragging');
  };
  // A drag must not count as a click on the card underneath.
  const onClickCapture = (e) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return (
    <Reveal as="section" className="hx-sites" id="hx-sites" aria-labelledby="hx-sites-title">
      <div className="hx-container hx-sites__head">
        <header className="hx-head hx-head--left">
          <p className="hx-eyebrow">{t('home.sitesEyebrow')}</p>
          <h2 id="hx-sites-title" className="hx-h2">{t('home.sitesTitle')}</h2>
        </header>
        <div className="hx-arrows">
          <button type="button" className="hx-arrow" onClick={() => go(-1)} disabled={edges.start} aria-label={t('home.prev')}>
            <i className="fas fa-chevron-left" aria-hidden="true" />
          </button>
          <button type="button" className="hx-arrow" onClick={() => go(1)} disabled={edges.end} aria-label={t('home.next')}>
            <i className="fas fa-chevron-right" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className="hx-sites__track"
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={t('home.sitesLabel')}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
      >
        {SITES.map((s, i) => (
          <Link
            key={s.path}
            to={s.path}
            className="hx-site"
            draggable={false}
            aria-label={`${t('home.' + s.key)} (${i + 1}/${SITES.length})`}
          >
            <img src={s.img} alt="" loading="lazy" draggable={false} />
            <span className="hx-site__shade" aria-hidden="true" />
            <span className="hx-site__body">
              <span className="hx-site__name">{t('home.' + s.key)}</span>
              <span className="hx-site__go">
                {t('home.explore')} <i className="fas fa-arrow-right" aria-hidden="true" />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </Reveal>
  );
}

export default Cards;
