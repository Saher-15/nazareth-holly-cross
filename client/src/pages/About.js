import React, { useEffect } from "react";
import { useTranslation } from 'react-i18next';

import "../styles/About.css";

const About = () => {
  const { t } = useTranslation(); // Initialize translation hook

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="about-container">
      <div>
        <h2 className="about-title">{t('about.title')}</h2>
        <p className="about-description">{t('about.description1')}</p>
        <p className="about-description">{t('about.description2')}</p>
        <p className="about-description">{t('about.description3')}</p>
        <p className="about-description">{t('about.description4')}</p>
      </div>
    </div>
  );
};

export default About;
