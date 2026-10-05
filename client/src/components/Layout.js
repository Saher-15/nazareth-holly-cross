import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Footer from './Footer';
import NavBar from './Navbar';
import ScrollToTop from '../app/ScrollToTop';

// Shared page frame: nav + routed page (lazy, so one Suspense for all) + footer.
const Layout = () => (
  <div>
    <ScrollToTop />
    <NavBar />
    <Suspense fallback={<div className="page-loading">Loading...</div>}>
      <Outlet />
    </Suspense>
    <Footer />
  </div>
);

export default Layout;
