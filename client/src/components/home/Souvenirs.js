import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../../config/env';
import Reveal from './Reveal';

const SIZE = 8;
const cleanUrl = (u) => (typeof u === 'string' ? u.replace(/&amp;/g, '&') : u);

function Souvenirs() {
  const { t } = useTranslation();
  const [state, setState] = useState('loading'); // loading | ok | error
  const [items, setItems] = useState([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    axios
      .get(`${API_URL}/product/getNProducts`, { params: { page: 1, size: SIZE }, timeout: 25000 })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data && res.data.data) ? res.data.data : [];
        setItems(list.filter((p) => p && p._id && p.name));
        setState('ok');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state === 'ok' && items.length === 0) return null;

  return (
    <Reveal as="section" className="hx-shop" aria-labelledby="hx-shop-title">
      <div className="hx-container">
        <header className="hx-head">
          <p className="hx-eyebrow">{t('home.shopEyebrow')}</p>
          <h2 id="hx-shop-title" className="hx-h2">{t('home.shopTitle')}</h2>
        </header>

        {state === 'error' ? (
          <div className="hx-note hx-glass" role="alert">
            <p>{t('home.shopError')}</p>
            <button type="button" className="hx-btn hx-btn--ghost" onClick={() => setAttempt((a) => a + 1)}>
              {t('home.retry')}
            </button>
          </div>
        ) : (
          <ul className="hx-products" aria-busy={state === 'loading'}>
            {state === 'loading'
              ? Array.from({ length: SIZE }, (_, i) => (
                  <li key={i} className="hx-product hx-skeleton" aria-hidden="true">
                    <span className="hx-skeleton__img" />
                    <span className="hx-skeleton__line" />
                    <span className="hx-skeleton__line hx-skeleton__line--short" />
                  </li>
                ))
              : items.map((p) => (
                  <li key={p._id} className="hx-product">
                    <Link to={`/product/${p._id}`} className="hx-product__link">
                      <span className="hx-product__imgwrap">
                        <img src={cleanUrl(p.img)} alt={p.name} loading="lazy" />
                      </span>
                      <span className="hx-product__name">{p.name}</span>
                      <span className="hx-product__price">${p.price}</span>
                    </Link>
                  </li>
                ))}
          </ul>
        )}

        <div className="hx-center">
          <Link to="/shop" className="hx-btn hx-btn--gold">{t('home.shopAll')}</Link>
        </div>
      </div>
    </Reveal>
  );
}

export default Souvenirs;
