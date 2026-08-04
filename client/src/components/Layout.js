import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Navbar from './Navbar';
import Footer from './Footer';
import BackToTop from './BackToTop';
import LiveBanner from './LiveBanner';
import WhatsAppButton from './WhatsAppButton';
import CookieConsent from './CookieConsent';
import { gold, goldDark } from '../theme';

function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop || document.body.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (progress <= 0) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1500,
        width: `${progress}%`,
        height: '2px',
        background: `linear-gradient(90deg, ${goldDark}, ${gold})`,
        boxShadow: `0 0 8px ${alpha(gold, 0.6)}`,
        transition: 'width 0.1s linear',
        pointerEvents: 'none',
      }}
    />
  );
}

export default function Layout() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F7F2E8' }}>
      <ScrollProgress />
      <LiveBanner />
      <Navbar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: { xs: '64px', md: '72px' },
        }}
      >
        <Outlet />
      </Box>
      <Footer />
      <BackToTop />
      <WhatsAppButton />
      <CookieConsent />
    </Box>
  );
}
