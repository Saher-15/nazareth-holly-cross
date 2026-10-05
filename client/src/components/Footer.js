import React from "react";
import { Link } from "react-router-dom";
import { FaRegEnvelope, FaLinkedin, FaInstagram, FaFacebook, FaYoutube } from "react-icons/fa";
import { useTranslation } from 'react-i18next';
import { resetShopFilters } from './Navbar';
import '../styles/Footer.css';

const PAGES = [
  { to: '/', label: 'navbar.home' },
  { to: '/live', label: 'navbar.live' },
  { to: '/tour', label: 'navbar.tour' },
  { to: '/candle', label: 'navbar.candle' },
  { to: '/shop', label: 'navbar.shop', shop: true },
  { to: '/reviews', label: 'navbar.reviews' },
  { to: '/about', label: 'footer.aboutUs' },
];

const SITES = [
  { to: '/latin', label: 'home.siteLatin' },
  { to: '/greek', label: 'home.siteGreek' },
  { to: '/maryswell', label: 'home.siteMary' },
  { to: '/oldcity', label: 'home.siteOld' },
  { to: '/city', label: 'home.siteCity' },
];

const SOCIAL = [
  { href: 'https://www.instagram.com/nazareth_holy_cross/', label: 'footer.followInstagram', Icon: FaInstagram },
  { href: 'https://www.facebook.com/profile.php?id=61566447860803', label: 'footer.followFacebook', Icon: FaFacebook },
  { href: 'https://www.youtube.com/@nazarethholycross', label: 'footer.subscribeYoutube', Icon: FaYoutube },
];

const CREDITS = [
  { href: 'https://www.linkedin.com/in/saher-saadi-a637b11b5/', label: 'footer.creditLink1' },
  { href: 'http://linkedin.com/in/haythamt95', label: 'footer.creditLink2' },
];

function scrollToTop() {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}

function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__grid">
          <section className="site-footer__brand" aria-labelledby="footer-about">
            <div className="site-footer__lockup">
              <img className="site-footer__logo" src='/images/logo.webp' alt="Nazareth Holy Cross Logo" width="72" height="72" loading="lazy" />
              <div>
                <p className="site-footer__wordmark">Nazareth <span>Holy Cross</span></p>
                <p className="site-footer__tagline">{t('home.eyebrow')}</p>
              </div>
            </div>
            <h2 id="footer-about" className="site-footer__title">{t('footer.aboutUs')}</h2>
            <p className="site-footer__about">{t('footer.aboutUsDescription')}</p>
            <Link to='/about' className='site-footer__more'>
              {t('footer.learnMore')}
              <i className="fas fa-arrow-right" aria-hidden="true" />
            </Link>
          </section>

          <nav className="site-footer__col" aria-labelledby="footer-explore">
            <h2 id="footer-explore" className="site-footer__title">{t('shell.explore')}</h2>
            <ul className="site-footer__links">
              {PAGES.map(({ to, label, shop }) => (
                <li key={to}>
                  <Link to={to} onClick={shop ? resetShopFilters : undefined}>{t(label)}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="site-footer__col" aria-labelledby="footer-sites">
            <h2 id="footer-sites" className="site-footer__title">{t('home.sitesEyebrow')}</h2>
            <ul className="site-footer__links">
              {SITES.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to}>{t(label)}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <section className="site-footer__col site-footer__contact" aria-labelledby="footer-contact">
            <h2 id="footer-contact" className="site-footer__title">{t('footer.contactUs')}</h2>
            <a href="mailto:nazarethholycross@gmail.com" className="site-footer__email">
              <FaRegEnvelope className="site-footer__email-icon" aria-hidden="true" />
              <span>{t('footer.email')}</span>
            </a>
            <p className="site-footer__follow">{t('shell.followUs')}</p>
            <ul className="site-footer__social">
              {SOCIAL.map(({ href, label, Icon }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="site-footer__social-link"
                    aria-label={`${t(label)} ${t('shell.newTab')}`}
                    title={t(label)}
                  >
                    <Icon aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="site-footer__bottom">
          <p className="site-footer__copy">{t('footer.copyright')}</p>
          <div className="site-footer__credits">
            <span className="site-footer__credits-label">{t('footer.credits')}</span>
            {CREDITS.map(({ href, label }) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="site-footer__credit">
                <FaLinkedin aria-hidden="true" />
                <span>{t(label)}</span>
                <span className="site-footer__sr">{` ${t('shell.newTab')}`}</span>
              </a>
            ))}
          </div>
          <button type="button" className="site-footer__top" onClick={scrollToTop}>
            <i className="fas fa-arrow-up" aria-hidden="true" />
            <span>{t('shell.backToTop')}</span>
          </button>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
