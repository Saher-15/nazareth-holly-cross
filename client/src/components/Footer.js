import React from "react";
import { Link } from "react-router-dom";
import { FaRegEnvelope, FaLinkedin, FaInstagram, FaFacebook, FaYoutube } from "react-icons/fa";
import '../styles/Footer.css';
import { useTranslation } from 'react-i18next'; // Import the translation hook

function Footer() {
  const { t } = useTranslation(); // Initialize the translation hook

  return (
    <div className="footer-container">
      <div className="footer-content">
        <div className="footer-section about-us">
          <h2>{t('footer.aboutUs')}</h2>
          <p>{t('footer.aboutUsDescription')}</p>
          <Link to='/about' className='about-us-link'>
            {t('footer.learnMore')}
          </Link>
        </div>

        <div className="footer-section contact-us">
          <h2>{t('footer.contactUs')}</h2>
          <div className="contact-details">
            <a href="mailto:nazarethholycross@gmail.com" className="email-button">
              <FaRegEnvelope className="icon" />
              <span>{t('footer.email')}</span>
            </a>
            <a href="https://www.instagram.com/nazareth_holy_cross/" target="_blank" rel="noopener noreferrer" className="instagram-button">
              <FaInstagram className="icon" />
              <span>{t('footer.followInstagram')}</span>
            </a>
            <a href="https://www.facebook.com/profile.php?id=61566447860803" target="_blank" rel="noopener noreferrer" className="instagram-button">
              <FaFacebook className="icon" />
              <span>{t('footer.followFacebook')}</span>
            </a>
            <a href="https://www.youtube.com/@nazarethholycross" target="_blank" rel="noopener noreferrer" className="instagram-button">
              <FaYoutube className="icon" />
              <span>{t('footer.subscribeYoutube')}</span>
            </a>
          </div>
        </div>

        <div className="footer-section credits">
          <h2>{t('footer.credits')}</h2>
          <div className="credit-item">
            <a href="https://www.linkedin.com/in/saher-saadi-a637b11b5/" target="_blank" rel="noopener noreferrer" className="linkedin-link">
              <FaLinkedin className="linkedin-icon" />
              {t('footer.creditLink1')}
            </a>
          </div>
          <div className="credit-item">
            <a href="http://linkedin.com/in/haythamt95" target="_blank" rel="noopener noreferrer" className="linkedin-link">
              <FaLinkedin className="linkedin-icon" />
              {t('footer.creditLink2')}
            </a>
          </div>
        </div>
      </div>
      <div className="footer-logo">
        <img src='/images/logo.webp' alt="Nazareth Holy Cross Logo" />
      </div>
      <div className="footer-bottom">
        <p className="copyright-text">
          {t('footer.copyright')}
        </p>
      </div>
    </div>
  );
}

export default Footer;
