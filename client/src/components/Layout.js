import React from 'react';
import Box from '@mui/material/Box';
import Footer from './Footer';
import Navbar from './Navbar';
import LiveBanner from './LiveBanner';
import BackToTop from './BackToTop';

const Layout = ({ children }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      <Navbar />
      <Box
        component="main"
        sx={{
          flex: 1,
          pt: { xs: '64px', md: '72px' }, // offset for fixed AppBar
        }}
      >
        <LiveBanner />
        {children}
      </Box>
      <Footer />
      <BackToTop />
    </Box>
  );
};

export default Layout;
