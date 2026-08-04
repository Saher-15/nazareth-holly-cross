'use client';
import React, { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Slide, IconButton, Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CookieIcon from '@mui/icons-material/Cookie';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('nhc_cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('nhc_cookie_consent', 'accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('nhc_cookie_consent', 'declined');
    setVisible(false);
  };

  return (
    <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(28,18,8,0.97)',
          backdropFilter: 'blur(10px)',
          color: '#F7F2E8',
          p: { xs: 2, md: 3 },
          zIndex: 2000,
          borderTop: '2px solid rgba(201,168,76,0.5)',
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
            justifyContent="space-between"
          >
            <Stack direction="row" alignItems="flex-start" spacing={1.5}>
              <CookieIcon sx={{ color: '#C9A84C', mt: 0.5, flexShrink: 0 }} />
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ color: '#C9A84C', fontFamily: 'Cinzel, serif', mb: 0.5 }}
                >
                  We use cookies
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(247,242,232,0.8)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                  We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic.
                  By clicking &quot;Accept All&quot;, you consent to our use of cookies.
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleDecline}
                sx={{
                  borderColor: 'rgba(247,242,232,0.3)',
                  color: 'rgba(247,242,232,0.7)',
                  fontSize: '0.7rem',
                  px: 2,
                  '&:hover': { borderColor: '#F7F2E8', color: '#F7F2E8' },
                }}
              >
                Decline
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleAccept}
                sx={{
                  background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
                  color: '#1C1208',
                  fontSize: '0.7rem',
                  px: 2,
                  fontFamily: 'Cinzel, serif',
                  '&:hover': { background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' },
                }}
              >
                Accept All
              </Button>
            </Stack>
          </Stack>
        </Box>
        <IconButton
          onClick={handleDecline}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: 'rgba(247,242,232,0.5)',
            '&:hover': { color: '#F7F2E8' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Slide>
  );
}
