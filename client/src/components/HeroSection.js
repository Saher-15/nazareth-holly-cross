import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Fade from '@mui/material/Fade';
import { alpha } from '@mui/material/styles';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ExploreIcon from '@mui/icons-material/Explore';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTranslation } from 'react-i18next';
import { gold, goldLight, goldDark, crimson, goldGradientText } from '../theme';

export default function HeroSection() {
  const { t } = useTranslation();
  const [mounted,   setMounted]   = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(new Audio('/sounds/christians.mp3'));
  const videoRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    const t = setTimeout(() => setMounted(true), 100);
    const audio = audioRef.current;
    audio.loop = true;

    // Force play on client-side navigation (browser autoplay policy workaround)
    const vid = videoRef.current;
    if (vid) {
      vid.play().catch(() => {});
    }

    return () => { audio.pause(); audio.currentTime = 0; clearTimeout(t); };
  }, []);

  const toggleAudio = () => {
    const audio = audioRef.current;
    isPlaying ? audio.pause() : audio.play();
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
        backgroundColor: '#07050A',
      }}
    >
      {/* ── Background video ── */}
      <Box
        ref={videoRef}
        component="video"
        src="https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fvideo-7.mp4?alt=media&token=b0173721-21a1-46d0-b15b-f2001b912e72"
        autoPlay loop muted playsInline
        sx={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: 0.85,
          filter: 'brightness(0.72) saturate(0.9)',
          zIndex: 0,
          transform: 'scale(1.02)',
        }}
      />

      {/* ── Gradient overlays — slightly lighter than before ── */}
      <Box sx={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: `
          linear-gradient(to bottom,
            rgba(0,0,0,0.38) 0%,
            rgba(0,0,0,0.04) 25%,
            rgba(0,0,0,0.04) 68%,
            rgba(0,0,0,0.52) 100%),
          linear-gradient(to right,
            rgba(0,0,0,0.18) 0%,
            transparent 30%,
            transparent 70%,
            rgba(0,0,0,0.18) 100%)
        `,
      }} />

      {/* ── Radial glow center ── */}
      <Box sx={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: `radial-gradient(ellipse at center 45%, ${alpha(crimson, 0.08)} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* ── Gold line top ── */}
      <Box sx={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '50%', height: '1px',
        background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.5)}, transparent)`,
        zIndex: 2,
      }} />

      {/* ── Main content ── */}
      <Box
        sx={{
          position: 'relative', zIndex: 3,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center',
          px: { xs: 3, sm: 4, md: 6 },
          maxWidth: '960px', mx: 'auto',
        }}
      >
        {/* Overline row */}
        <Fade in={mounted} timeout={700}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
            <Box sx={{ width: 36, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.55)})` }} />
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.6rem', letterSpacing: '0.42em', color: alpha(gold, 0.75), textTransform: 'uppercase' }}>
              The Sacred City
            </Typography>
            <Box sx={{ width: 36, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.55)}, transparent)` }} />
          </Box>
        </Fade>

        {/* Main heading */}
        <Fade in={mounted} timeout={900}>
          <Typography
            component="h1"
            sx={{
              fontFamily: '"Cinzel", serif',
              fontWeight: 900,
              fontSize: { xs: '2.6rem', sm: '3.8rem', md: '5.2rem', lg: '6.5rem' },
              lineHeight: 1.02,
              mb: 0.5,
              ...goldGradientText,
              filter: `drop-shadow(0 4px 40px ${alpha(gold, 0.2)})`,
            }}
          >
            {t('heroSection.heading')}
          </Typography>
        </Fade>

        {/* Subheading — gold tone readable on dark video */}
        <Fade in={mounted} timeout={1100}>
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic',
              color: alpha(gold, 0.88),
              fontSize: { xs: '1rem', sm: '1.25rem', md: '1.45rem' },
              fontWeight: 400,
              letterSpacing: '0.03em',
              mb: 5,
            }}
          >
            {t('heroSection.subHeading')}
          </Typography>
        </Fade>

        {/* CTA buttons */}
        <Fade in={mounted} timeout={1300}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, sm: 2 }, justifyContent: 'center', mb: 4.5 }}>
            {/* Primary — candle */}
            <Button
              variant="contained"
              startIcon={<LocalFireDepartmentIcon />}
              onClick={() => navigate('/candle')}
              sx={{
                px: { xs: 3, sm: 4.5 }, py: 1.6,
                fontSize: { xs: '0.68rem', sm: '0.74rem' },
                background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                color: '#07050A', fontWeight: 700,
                boxShadow: `0 4px 24px ${alpha(gold, 0.42)}`,
                '&:hover': {
                  background: `linear-gradient(135deg, ${alpha(gold, 0.95)} 0%, ${gold} 100%)`,
                  boxShadow: `0 8px 36px ${alpha(gold, 0.6)}`,
                  transform: 'translateY(-3px)',
                },
              }}
            >
              {t('heroSection.lightCandle')}
            </Button>

            {/* Secondary — shop */}
            <Button
              variant="outlined"
              startIcon={<StorefrontOutlinedIcon />}
              onClick={handleShopClick}
              sx={{
                px: { xs: 3, sm: 4.5 }, py: 1.6,
                fontSize: { xs: '0.68rem', sm: '0.74rem' },
                borderColor: alpha(gold, 0.45),
                color: alpha(gold, 0.92),
                backdropFilter: 'blur(10px)',
                background: alpha(gold, 0.05),
                '&:hover': {
                  borderColor: gold,
                  background: alpha(gold, 0.1),
                  boxShadow: `0 0 28px ${alpha(gold, 0.2)}`,
                  transform: 'translateY(-3px)',
                },
              }}
            >
              {t('heroSection.shopButton')}
            </Button>

            {/* Tertiary — tour */}
            <Button
              variant="text"
              startIcon={<ExploreIcon />}
              onClick={() => navigate('/tour')}
              sx={{
                px: { xs: 3, sm: 4.5 }, py: 1.6,
                fontSize: { xs: '0.68rem', sm: '0.74rem' },
                color: alpha(gold, 0.75),
                backdropFilter: 'blur(6px)',
                '&:hover': { color: gold, background: alpha(gold, 0.07), transform: 'translateY(-3px)' },
              }}
            >
              {t('heroSection.tourButton')}
            </Button>
          </Box>
        </Fade>

        {/* Discount banner — warm cream on dark video */}
        <Fade in={mounted} timeout={1500}>
          <Box
            onClick={handleShopClick}
            role="button" tabIndex={0}
            sx={{
              cursor: 'pointer', position: 'relative', overflow: 'hidden',
              border: `1px solid ${alpha(gold, 0.45)}`,
              borderRadius: '6px',
              px: { xs: 3, sm: 5 }, py: 1.8,
              maxWidth: '700px', width: '100%',
              backdropFilter: 'blur(12px)',
              background: alpha('#EDE6D4', 0.93),
              transition: 'all 0.35s ease',
              '&:hover': {
                borderColor: gold,
                background: '#EDE6D4',
                boxShadow: `0 0 32px ${alpha(gold, 0.22)}`,
                transform: 'translateY(-2px)',
              },
              '&::before': {
                content: '""', position: 'absolute',
                top: 0, left: 0, width: '90px', height: '100%',
                background: `linear-gradient(140deg, ${alpha(crimson, 0.85)} 0%, ${alpha(crimson, 0.45)} 100%)`,
                clipPath: 'polygon(0 0, 75% 0, 100% 100%, 0 100%)',
              },
              '&::after': {
                content: '"10% OFF"',
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)',
                fontFamily: '"Cinzel", serif', fontWeight: 900,
                fontSize: '0.6rem', letterSpacing: '0.08em',
                color: '#FFFFFF', zIndex: 1,
              },
            }}
          >
            <Typography sx={{
              position: 'relative', zIndex: 1, pl: { xs: 6, sm: 5 },
              fontFamily: '"Lato", sans-serif', fontWeight: 400,
              fontSize: { xs: '0.82rem', sm: '0.92rem' },
              color: '#5D3E2C',
            }}>
              {t('heroSection.discount')}
            </Typography>
          </Box>
        </Fade>
      </Box>

      {/* ── Audio toggle — slightly lighter background ── */}
      <IconButton
        onClick={toggleAudio}
        aria-label={isPlaying ? 'Mute' : 'Unmute'}
        sx={{
          position: 'absolute', bottom: { xs: 24, md: 32 }, right: { xs: 16, md: 28 },
          zIndex: 4,
          width: 42, height: 42,
          background: alpha('#000', 0.35),
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(gold, 0.28)}`,
          color: alpha(gold, 0.75),
          '&:hover': { background: alpha(gold, 0.12), color: gold, borderColor: gold, boxShadow: `0 0 16px ${alpha(gold, 0.3)}` },
        }}
      >
        {isPlaying ? <VolumeUpIcon sx={{ fontSize: '1rem' }} /> : <VolumeOffIcon sx={{ fontSize: '1rem' }} />}
      </IconButton>

      {/* ── Scroll indicator ── */}
      <Box
        sx={{
          position: 'absolute', bottom: { xs: 20, md: 28 }, left: '50%',
          transform: 'translateX(-50%)', zIndex: 4,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
          opacity: 0.55,
          animation: 'bounce 2.4s ease-in-out infinite',
          '@keyframes bounce': {
            '0%,100%': { transform: 'translateX(-50%) translateY(0)' },
            '50%':      { transform: 'translateX(-50%) translateY(10px)' },
          },
        }}
      >
        <Box sx={{ width: '1px', height: 36, background: `linear-gradient(to bottom, ${alpha(gold, 0.6)}, transparent)` }} />
        <KeyboardArrowDownIcon sx={{ fontSize: '0.9rem', color: alpha(gold, 0.6) }} />
      </Box>
    </Box>
  );
}
