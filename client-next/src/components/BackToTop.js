'use client';
import React, { useState, useEffect } from 'react';
import { Fab, Zoom, Tooltip } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Zoom in={visible}>
      <Tooltip title="Back to top" placement="left">
        <Fab
          onClick={scrollToTop}
          size="medium"
          aria-label="back to top"
          sx={{
            position: 'fixed',
            bottom: { xs: 80, md: 32 },
            right: { xs: 16, md: 24 },
            background: 'linear-gradient(135deg, #C9A84C 0%, #8A6107 100%)',
            color: '#1C1208',
            zIndex: 1000,
            boxShadow: '0 4px 16px rgba(201,168,76,0.5)',
            '&:hover': {
              background: 'linear-gradient(135deg, #E8C97A 0%, #C9A84C 100%)',
              transform: 'translateY(-2px)',
            },
          }}
        >
          <KeyboardArrowUpIcon />
        </Fab>
      </Tooltip>
    </Zoom>
  );
}
