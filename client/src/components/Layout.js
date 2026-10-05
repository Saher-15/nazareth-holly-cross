import React, { Suspense, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Footer from './Footer';
import NavBar from './Navbar';
import ScrollToTop from '../app/ScrollToTop';
import '../styles/Layout.css';

// Shown while a page's code is downloading.
function PageLoading() {
  const { t } = useTranslation();
  return (
    <div className="site-loading" role="status">
      <span className="site-loading__flame" aria-hidden="true" />
      <span>{t('shell.loading')}</span>
    </div>
  );
}

// Shared page frame: nav + routed page (lazy, so one Suspense for all) + footer.
const Layout = () => {
  const { t } = useTranslation();
  const contentRef = useRef(null);

  // Move keyboard focus past the navigation without touching the URL/router.
  const skipToContent = (e) => {
    e.preventDefault();
    const el = contentRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView();
  };

  return (
    <div className="site-shell">
      <a href="#content" className="site-skip" onClick={skipToContent}>
        {t('shell.skipToContent')}
      </a>
      <ScrollToTop />
      <NavBar />
      <div id="content" className="site-content" ref={contentRef} tabIndex={-1}>
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
