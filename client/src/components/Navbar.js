import React, { useState } from 'react';
import { Link, useNavigate } from "react-router-dom";
import '../styles/Navbar.css';
import LanguageSwitcher from './LanguageSwitcher'; // Make sure to import the LanguageSwitcher component
import { useTranslation } from 'react-i18next'; // Import useTranslation

function Navbar({ currentLanguage, onLanguageChange }) {
  const { t } = useTranslation(); // Initialize useTranslation
  const [click, setClick] = useState(false);
  const handleClick = () => setClick(!click);
  const closeMobileMenu = () => setClick(false);
  const navigate = useNavigate();

  const handleShopClick = () => {
    // Reset filters before navigating
    localStorage.removeItem('searchQuery');
    localStorage.removeItem('sortOrder');
    localStorage.setItem('currentPage', 1);
    closeMobileMenu();
    // Navigate to the shop page
    navigate('/shop');
  };

  return (
    <>
      <nav className='navbar'>
        <Link to='/' className='navbar-logo' onClick={closeMobileMenu}>
          <i className="fas fa-cross" style={{ color: "rgba(255, 0, 0, 0.5)", fontSize: "2em", marginRight: "10px" }}></i>
          <span>NAZARETH HOLY CROSS</span>
        </Link>

        <div className='navbar-container'>

          <div className='menu-icon' onClick={handleClick}>
            <i className={click ? 'fas fa-times' : 'fas fa-bars'} />
          </div>
          <ul className={click ? 'nav-menu active' : 'nav-menu'}>

            <li className='nav-item'>
              <Link to='/' className='nav-links' onClick={closeMobileMenu}>{t('navbar.home')}</Link> {/* Use translation for Home */}
            </li>
            <li className='nav-item'>
              <Link to='/live' style={{ color: "rgba(255, 0, 0, 0.5)" }} className='nav-links' onClick={closeMobileMenu}>{t('navbar.live')}</Link> {/* Use translation for Live */}
            </li>
            <li className='nav-item'>
              <Link to='/tour' className='nav-links' onClick={closeMobileMenu}>{t('navbar.tour')}</Link> {/* Use translation for Tour */}
            </li>
            <li className='nav-item'>
              <Link to='/candle' className='nav-links' onClick={closeMobileMenu}>{t('navbar.candle')}</Link> {/* Use translation for Candle */}
            </li>
            <li className='nav-item'>
              <Link to="/shop" className="nav-links" onClick={handleShopClick}>{t('navbar.shop')}</Link> {/* Use translation for Shop */}
            </li>
            <li className='nav-item'>
              <Link to='/reviews' className='nav-links' onClick={closeMobileMenu}>{t('navbar.reviews')}</Link> {/* Use translation for Reviews */}
            </li>

          </ul>
          <LanguageSwitcher currentLanguage={currentLanguage} onLanguageChange={onLanguageChange} onClick={closeMobileMenu} /> {/* Include the LanguageSwitcher */}


        </div>

      </nav>

    </>
  );
}

export default Navbar;
