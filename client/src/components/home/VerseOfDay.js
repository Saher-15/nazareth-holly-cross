import React from 'react';
import { useTranslation } from 'react-i18next';
import Reveal from './Reveal';

const VERSES = [1, 2, 3, 4, 5, 6];

// Same verse for everyone on the same calendar day (local date), rotating daily.
export function verseIndexFor(date = new Date()) {
  const days = Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12) / 864e5);
  return days % VERSES.length;
}

function VerseOfDay() {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const n = VERSES[verseIndexFor(now)];
  let dateLabel = '';
  try {
    dateLabel = now.toLocaleDateString(i18n.language || 'en', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch (e) {
    dateLabel = now.toDateString();
  }

  return (
    <Reveal as="section" className="hx-verse" aria-labelledby="hx-verse-eyebrow">
      <div className="hx-container">
        <figure className="hx-verse__card hx-glass">
          <p id="hx-verse-eyebrow" className="hx-eyebrow">
            {t('home.verseEyebrow')} <span className="hx-verse__date">· {dateLabel}</span>
          </p>
          <blockquote className="hx-verse__text">{t(`home.v${n}`)}</blockquote>
          <figcaption className="hx-verse__ref">{t(`home.r${n}`)}</figcaption>
        </figure>
      </div>
    </Reveal>
  );
}

export default VerseOfDay;
