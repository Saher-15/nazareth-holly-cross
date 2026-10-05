import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Reveal from '../ui/Reveal';
import PLACES, { TOUR } from './data';
import '../../styles/Pages.css';

// Photo cards linking to the holy places (optionally without one, optionally + the tour).
function PlaceCards({ exclude, withTour = false }) {
  const { t } = useTranslation();
  const items = PLACES.filter((p) => p.id !== exclude);
  if (withTour) items.push(TOUR);

  return (
    <ul className="pc-grid">
      {items.map((p, i) => (
        <Reveal as="li" key={p.id} className="pc-item" delay={Math.min(i, 5) * 70}>
          <Link to={p.path} className="pc-card">
            <img src={p.cover} alt="" loading="lazy" decoding="async" />
            <span className="pc-card__shade" aria-hidden="true" />
            <span className="pc-card__body">
              <span className="pc-card__name">{t(p.nameKey)}</span>
              <span className="pc-card__go" aria-hidden="true">
                {t('home.explore')} <span className="pc-card__arrow">&rarr;</span>
              </span>
            </span>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}

export default PlaceCards;
