import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Reveal from '../ui/Reveal';

const KEY = 'hx-flames';
const MAX_SHOWN = 9;

const today = () => new Date().toISOString().slice(0, 10);

function readCount() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && saved.day === today() && Number.isInteger(saved.count)) return saved.count;
  } catch (e) {
    /* storage unavailable: start from zero */
  }
  return 0;
}

// A symbolic "light a flame" counter kept in this browser only, plus a real
// link to the candle page where an actual candle can be requested.
function CandleStrip() {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);

  const countRef = useRef(0);

  useEffect(() => {
    countRef.current = readCount();
    setCount(countRef.current);
  }, []);

  const light = () => {
    const next = countRef.current + 1;
    countRef.current = next;
    setCount(next);
    try {
      localStorage.setItem(KEY, JSON.stringify({ day: today(), count: next }));
    } catch (e) {
      /* ignore */
    }
  };

  return (
    <Reveal as="section" className="hx-candle" aria-labelledby="hx-candle-title">
      <div className="hx-container hx-candle__inner">
        <div className="hx-candle__copy">
          <h2 id="hx-candle-title" className="hx-h2">{t('home.candleTitle')}</h2>
          <p>{t('home.candleText')}</p>
          <div className="hx-candle__actions">
            <Link to="/candle" className="hx-btn hx-btn--gold">{t('heroSection.lightCandle')}</Link>
            <button type="button" className="hx-btn hx-btn--ghost" onClick={light}>
              <span className="hx-flame hx-flame--sm" aria-hidden="true" />
              {t('home.flameBtn')}
            </button>
          </div>
          <p className="hx-candle__note">{t('home.flameNote')}</p>
        </div>

        <div className="hx-candle__stage">
          <ul className="hx-candles" aria-hidden="true">
            {Array.from({ length: MAX_SHOWN }, (_, i) => (
              <li key={i} className={i < count ? 'is-lit' : ''} style={{ '--i': i }}>
                <span className="hx-flame" />
                <span className="hx-wax" />
              </li>
            ))}
          </ul>
          <p className="hx-candle__count" role="status" aria-live="polite">
            {t('home.flameCount', { count })}
          </p>
        </div>
      </div>
    </Reveal>
  );
}

export default CandleStrip;
