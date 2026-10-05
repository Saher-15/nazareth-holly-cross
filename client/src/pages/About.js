import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHero from '../components/ui/PageHero';
import Reveal from '../components/ui/Reveal';
import '../styles/About.css';

// The three ways the site brings Nazareth to visitors, one per About paragraph.
const PILLARS = [
  { icon: 'fas fa-church', titleKey: 'places.aboutPillar1', textKey: 'about.description2', to: '/tour', ctaKey: 'heroSection.tourButton' },
  { icon: 'fas fa-gift', titleKey: 'places.aboutPillar2', textKey: 'about.description3', to: '/shop', ctaKey: 'home.shopAll' },
  { icon: 'fas fa-hands-helping', titleKey: 'places.aboutPillar3', textKey: 'about.description4', to: '/candle', ctaKey: 'home.stickyCandle' },
];

const About = () => {
  const { t } = useTranslation();

  return (
    <main className="ui-page about-page">
      <PageHero eyebrow={t('places.aboutEyebrow')} title={t('about.title')} image="/images/greek/greek10.jpg" />

      <section className="ui-section about-intro">
        <div className="ui-container">
          <Reveal className="about-intro__card ui-glass">
            <span className="about-intro__mark" aria-hidden="true" />
            <p className="about-intro__lead">{t('about.description1')}</p>
          </Reveal>
        </div>
      </section>

      <section className="ui-section about-pillars-section">
        <div className="ui-container">
          <ul className="about-pillars">
            {PILLARS.map((p, i) => (
              <Reveal as="li" key={p.titleKey} className="about-pillar ui-glass ui-card" delay={i * 90}>
                <span className="about-pillar__icon" aria-hidden="true">
                  <i className={p.icon} />
                </span>
                <h2 id={`about-pillar-${i}`} className="ui-h3">
                  {t(p.titleKey)}
                </h2>
                <p className="about-pillar__text">{t(p.textKey)}</p>
                <Link to={p.to} className="about-pillar__link">
                  {t(p.ctaKey)} <span aria-hidden="true">&rarr;</span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
};

export default About;
