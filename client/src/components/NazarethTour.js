import React, { useEffect } from 'react';
import '../styles/NazarethTour.css'; 
import "../App.css";
import { useTranslation } from 'react-i18next';  // Add this import

const NazarethTour = () => {
  const { t } = useTranslation();  // Initialize the translation hook

  useEffect(() => {
    // Scroll to the top of the page when the component is mounted
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container-tour">
      <h1 className="page-heading">{t('nazarethTour.pageHeading')}</h1>
      <div className="video-container">
        <video 
          src="https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Ftour.mp4?alt=media&token=af5c1463-2e97-4ae3-b205-a7566f45f9be" 
          type="video/mp4" 
          className="video-tour" 
          controls 
          poster="images/jesus_city_tour.png"
        >
          Your browser does not support the video tag.
        </video>
      </div>
      <p className="video-message">
        {t('nazarethTour.videoMessage')}
      </p>
      <p className="video-description">
        {t('nazarethTour.videoDescription')}
      </p>
      <a href="/" className="cta-button">
        {t('nazarethTour.ctaButton')}
      </a>
    </div>
  );
};

export default NazarethTour;
