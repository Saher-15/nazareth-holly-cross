import React from 'react';
import { useTranslation } from 'react-i18next';
import Reveal from './home/Reveal';
import '../styles/Home.css';

const NOTES = ['matthew', 'luke1', 'john', 'luke4'];
const PARTS = ['part1', 'part2', 'part3', 'part4', 'part5'];

const WhatIsNew = () => {
  const { t } = useTranslation();

  return (
    <Reveal as="section" className="hx-story" aria-labelledby="hx-story-title">
      <div className="hx-container">
        <header className="hx-head">
          <p className="hx-eyebrow">{t('home.storyEyebrow')}</p>
          <h2 id="hx-story-title" className="hx-h2">{t('whatIsNew.title')}</h2>
        </header>

        <ul className="hx-notes">
          {NOTES.map((k) => (
            <li key={k} className="hx-note-card hx-glass">
              {t(`whatIsNew.scriptureNotes.${k}`)}
            </li>
          ))}
        </ul>

        <h3 className="hx-h3">{t('whatIsNew.touchingTheSacred')}</h3>
        <div className="hx-prose">
          {PARTS.map((p) => (
            <p key={p}>{t(`whatIsNew.introParagraphs.${p}`)}</p>
          ))}
        </div>
      </div>
    </Reveal>
  );
};

export default WhatIsNew;
