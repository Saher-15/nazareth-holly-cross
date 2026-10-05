import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import '../styles/Navbar.css';

// Wide enough for the longest translated labels (Russian "Live") on one line.
const DESKTOP_QUERY = '(min-width: 1024px)';

// Clears the shop's remembered search/sort/page so the shop opens fresh.
export function resetShopFilters() {
  localStorage.removeItem('searchQuery');
  localStorage.removeItem('sortOrder');
  localStorage.setItem('currentPage', 1);
}

// Main links. `section` lists related paths that keep the link highlighted
// (e.g. a product page belongs to the shop).
const LINKS = [
  { to: '/', label: 'navbar.home' },
  { to: '/live', label: 'navbar.live', live: true },
  { to: '/tour', label: 'navbar.tour' },
  { to: '/candle', label: 'navbar.candle', section: ['/checkoutcandle'] },
  { to: '/shop', label: 'navbar.shop', shop: true, section: ['/product', '/cart', '/checkout'] },
  { to: '/reviews', label: 'navbar.reviews' },
];

const matches = (pathname, path) =>
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);

function Navbar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggleRef = useRef(null);

  // The home page opens on a full-screen hero, so the bar floats over it there.
  const overlay = pathname === '/';

  const closeMobileMenu = () => setOpen(false);

  const handleShopClick = () => {
    // Reset filters before navigating
    resetShopFilters();
    closeMobileMenu();
    navigate('/shop');
  };

  // Stronger glass once the page has scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A new page always starts with the menu closed.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The mobile menu does not exist on wide screens: close it if the window grows.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e) => {
      if (e.matches) setOpen(false);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  // While the mobile menu is open: Escape closes it and the page behind does not scroll.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        if (toggleRef.current) toggleRef.current.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    // Scroll lock is applied by CSS below 1024px only, so it can never stick on desktop.
    const root = document.documentElement;
    root.classList.add('site-nav-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      root.classList.remove('site-nav-open');
    };
  }, [open]);

  const classes = ['site-nav'];
  if (overlay) classes.push('site-nav--overlay');
  if (scrolled) classes.push('is-scrolled');
  if (open) classes.push('is-open');

  return (
    <header className={classes.join(' ')}>
      <div className="site-nav__bar">
        <Link to="/" className="site-nav__brand" onClick={closeMobileMenu}>
          <img className="site-nav__logo" src="/images/logo.webp" alt="" width="44" height="44" />
          <span className="site-nav__name">
            <span className="site-nav__name-main">Nazareth</span>
            <span className="site-nav__name-sub">Holy Cross</span>
          </span>
        </Link>

        <nav
          id="site-menu"
          className={`site-nav__menu${open ? ' is-open' : ''}`}
          aria-label={t('shell.mainNav')}
        >
          <ul className="site-nav__list">
            {LINKS.map(({ to, label, live, shop, section = [] }, i) => {
              const exact = matches(pathname, to);
              const active = exact || section.some((p) => matches(pathname, p));
              const cls = ['site-nav__link'];
              if (active) cls.push('is-active');
              if (live) cls.push('site-nav__link--live');
              return (
                <li key={to} className="site-nav__item" style={{ '--i': i }}>
                  <Link
                    to={to}
                    className={cls.join(' ')}
                    aria-current={exact ? 'page' : undefined}
                    onClick={shop ? handleShopClick : closeMobileMenu}
                  >
                    {live && <span className="site-nav__live-dot" aria-hidden="true" />}
                    {t(label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="site-nav__tools">
          <LanguageSwitcher />
          <button
            ref={toggleRef}
            type="button"
            className="site-nav__toggle"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? t('shell.closeMenu') : t('shell.openMenu')}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="site-nav__burger" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
