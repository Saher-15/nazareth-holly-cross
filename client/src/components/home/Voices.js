import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../../config/env';
import Reveal from '../ui/Reveal';

const clip = (s, n = 220) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

// Hidden entirely when there are no reviews (or the request fails).
function Voices() {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API_URL}/review/getReviews`, { timeout: 25000 })
      .then((res) => {
        if (cancelled || !Array.isArray(res.data)) return;
        setReviews(res.data.filter((r) => r && r.msg && r.fullName).slice(0, 8));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (reviews.length === 0) return null;

  return (
    <Reveal as="section" className="hx-voices" aria-labelledby="hx-voices-title">
      <div className="hx-container">
        <header className="hx-head">
          <p className="hx-eyebrow">{t('home.voicesEyebrow')}</p>
          <h2 id="hx-voices-title" className="hx-h2">{t('home.voicesTitle')}</h2>
        </header>
        <ul className="hx-voices__strip">
          {reviews.map((r, i) => (
            <li key={r._id || i} className="hx-voice hx-glass">
              <blockquote>{clip(r.msg)}</blockquote>
              <p className="hx-voice__by">{r.fullName}</p>
            </li>
          ))}
        </ul>
        <div className="hx-center">
          <Link to="/reviews" className="hx-btn hx-btn--ghost">{t('home.voicesAll')}</Link>
        </div>
      </div>
    </Reveal>
  );
}

export default Voices;
