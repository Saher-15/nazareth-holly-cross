import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTranslation } from 'react-i18next';
import { gold, goldDark, crimson, goldGradient, goldGradientText } from '../theme';

export default function HeroSection() {
  const { t } = useTranslation();
  const [mounted,   setMounted]   = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    audioRef.current = new Audio('/sounds/christians.mp3');
    audioRef.current.loop = true;
    if (videoRef.current) videoRef.current.play().catch(() => {});
    return () => {
      clearTimeout(timer);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    };
  }, []);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    isPlaying ? audioRef.current.pause() : audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleShopClick = () => {
    localStorage.removeItem('searchQuery');
    localStorage.removeItem('sortOrder');
    localStorage.setItem('currentPage', 1);
    navigate('/shop');
  };

  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#1C0E06',
        mt: '-64px',
      }}
    >
      {/* Background video */}
      <Box
        ref={videoRef}
        component="video"
        src="https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fvideo-7.mp4?alt=media&token=b0173721-21a1-46d0-b15b-f2001b912e72"
        autoPlay
        loop
        muted
        playsInline
        sx={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: 0.85,
          filter: 'brightness(0.55) saturate(0.85)',
        }}
      />

      {/* Gradient overlays */}
      <Box sx={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(160deg, rgba(28,14,6,0.72) 0%, rgba(44,24,16,0.45) 50%, rgba(28,14,6,0.75) 100%)',
      }} />
      <Box sx={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
        background: 'linear-gradient(to bottom, transparent, #F7F2E8)',
      }} />

      {/* Content */}
      <Box
        sx={{
          position: 'relative', zIndex: 2, textAlign: 'center', px: { xs: 3, md: 5 },
          maxWidth: 900, mx: 'auto',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Overline */}
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box sx={{ width: 50, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.8)})` }} />
          <Typography
            sx={{
              fontFamily: '"Cinzel", serif', fontSize: { xs: '0.6rem', md: '0.7rem' },
              letterSpacing: '0.35em', color: alpha(gold, 0.85), textTransform: 'uppercase',
            }}
          >
            THE HOLY LAND
          </Typography>
          <Box sx={{ width: 50, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.8)}, transparent)` }} />
        </Box>

        {/* Headline */}
        <Typography
          variant="h1"
          sx={{
            fontFamily: '"Cinzel", serif', fontWeight: 900,
            fontSize: { xs: '2.4rem', sm: '3.5rem', md: '5rem', lg: '6rem' },
            lineHeight: 1.05, mb: 2,
            ...goldGradientText,
            letterSpacing: '0.04em',
          }}
        >
          {t('heroSection.heading')}
        </Typography>

        {/* Divider */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 3 }}>
          <Box sx={{ width: 80, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.6)})` }} />
          <Box sx={{ fontSize: '1rem', color: alpha(crimson, 0.8) }}>✝</Box>
          <Box sx={{ width: 80, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.6)}, transparent)` }} />
        </Box>

        {/* Subtitle */}
        <Typography
          sx={{
            fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
            fontSize: { xs: '1rem', md: '1.25rem' },
            color: alpha('#F7F2E8', 0.75), mb: 5,
            letterSpacing: '0.05em',
          }}
        >
          {t('heroSection.subHeading')}
        </Typography>

        {/* CTAs */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" alignItems="center">
          <Button
            variant="contained"
            startIcon={<StorefrontOutlinedIcon />}
            onClick={handleShopClick}
            sx={{
              background: goldGradient,
              color: '#1C1208',
              py: 1.6, px: 4,
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              boxShadow: `0 4px 24px ${alpha(gold, 0.45)}`,
              '&:hover': {
                background: `linear-gradient(135deg, #D4B060 0%, ${gold} 100%)`,
                boxShadow: `0 8px 36px ${alpha(gold, 0.6)}`,
                transform: 'translateY(-3px)',
              },
            }}
          >
            {t('heroSection.shopButton')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<LocalFireDepartmentIcon />}
            href="/candle"
            sx={{
              border: `1px solid ${alpha(gold, 0.55)}`,
              color: alpha('#F7F2E8', 0.88),
              py: 1.6, px: 4,
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              '&:hover': {
                border: `1px solid ${gold}`,
                background: alpha(gold, 0.1),
                color: gold,
                transform: 'translateY(-3px)',
              },
            }}
          >
            {t('heroSection.lightCandle')}
          </Button>
        </Stack>
      </Box>

      {/* Audio toggle */}
      <IconButton
        onClick={toggleAudio}
        aria-label="Toggle audio"
        sx={{
          position: 'absolute', bottom: { xs: 80, md: 100 }, right: { xs: 16, md: 30 },
          zIndex: 3,
          color: alpha('#F7F2E8', 0.55),
          border: `1px solid ${alpha(gold, 0.2)}`,
          width: 38, height: 38,
          transition: 'all 0.25s ease',
          '&:hover': { color: gold, borderColor: alpha(gold, 0.55), background: alpha(gold, 0.08) },
        }}
      >
        {isPlaying ? <VolumeUpIcon sx={{ fontSize: '1rem' }} /> : <VolumeOffIcon sx={{ fontSize: '1rem' }} />}
      </IconButton>

      {/* Scroll indicator */}
      <Box
        sx={{
          position: 'absolute', bottom: { xs: 20, md: 32 }, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 3,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
          opacity: 0.6,
          animation: 'bounce 2s ease-in-out infinite',
          '@keyframes bounce': {
            '0%,100%': { transform: 'translateX(-50%) translateY(0)' },
            '50%': { transform: 'translateX(-50%) translateY(8px)' },
          },
        }}
      >
        <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.55rem', letterSpacing: '0.25em', color: alpha(gold, 0.7) }}>
          SCROLL
        </Typography>
        <KeyboardArrowDownIcon sx={{ color: alpha(gold, 0.7), fontSize: '1.1rem' }} />
      </Box>
    </Box>
  );
}
