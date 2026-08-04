import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Slide from '@mui/material/Slide';
import { alpha } from '@mui/material/styles';
import CookieIcon from '@mui/icons-material/Cookie';
import { gold, goldDark, textSecondary } from '../theme';

const CONSENT_KEY = 'nhc_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
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
          zIndex: 1600,
          backgroundColor: '#FFFFFF',
          borderTop: `2px solid ${alpha(gold, 0.3)}`,
          boxShadow: `0 -8px 32px ${alpha('#8A6107', 0.15)}`,
          px: { xs: 3, md: 6 },
          py: { xs: 2.5, md: 2 },
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1 }}>
          <CookieIcon sx={{ color: gold, fontSize: '1.4rem', flexShrink: 0, mt: 0.2 }} />
          <Box>
            <Typography
              sx={{
                fontFamily: '"Cinzel", serif', fontSize: '0.72rem',
                fontWeight: 600, color: '#1C1208', letterSpacing: '0.06em', mb: 0.4,
              }}
            >
              We use cookies
            </Typography>
            <Typography
              sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.80rem', color: textSecondary, lineHeight: 1.6 }}
            >
              We use cookies to enhance your experience on our holy site. They help us remember your preferences and keep your cart items.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
          <Button
            onClick={decline}
            variant="outlined"
            size="small"
            sx={{
              fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.1em',
              color: textSecondary, borderColor: alpha(gold, 0.35),
              '&:hover': { borderColor: gold, color: goldDark, background: alpha(gold, 0.05) },
            }}
          >
            Decline
          </Button>
          <Button
            onClick={accept}
            variant="contained"
            size="small"
            sx={{
              fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.1em',
              background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
              color: '#1C1208',
              '&:hover': { boxShadow: `0 4px 16px ${alpha(gold, 0.4)}`, transform: 'none' },
            }}
          >
            Accept
          </Button>
        </Box>
      </Box>
    </Slide>
  );
}
