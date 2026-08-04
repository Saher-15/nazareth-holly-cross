'use client';
import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Container, Stack } from '@mui/material';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { colors } from '@/lib/theme';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import StorefrontIcon from '@mui/icons-material/Storefront';

export default function HeroSection() {
  const locale = useLocale();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #2C1810 0%, #1C0E06 40%, #0D0603 100%)',
      }}
    >
      {/* Background pattern */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9A84C' fill-opacity='0.04'%3E%3Cpath d='M50 50v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-40V6h-2v4h-4v2h4v4h2v-4h4V8h-4zM10 50v-4H8v4H4v2h4v4h2v-4h4v-2h-4zM10 10V6H8v4H4v2h4v4h2v-4h4V8h-4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          opacity: 0.6,
        }}
      />

      {/* Golden radial glow */}
      <Box
        sx={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Cross silhouette decoration */}
      <Box
        sx={{
          position: 'absolute',
          right: { xs: '-5%', md: '5%' },
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: { xs: '200px', md: '320px' },
          color: 'rgba(201,168,76,0.05)',
          lineHeight: 1,
          userSelect: 'none',
          fontFamily: 'serif',
        }}
      >
        ✝
      </Box>

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2, py: { xs: 8, md: 4 } }}>
        <Box
          sx={{
            maxWidth: 720,
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'translateY(0)' : 'translateY(40px)',
            transition: 'opacity 1s ease, transform 1s ease',
          }}
        >
          {/* Tagline */}
          <Typography
            sx={{
              fontFamily: 'Lato, sans-serif',
              fontWeight: 700,
              fontSize: { xs: '0.7rem', md: '0.8rem' },
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: '#C9A84C',
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box
              component="span"
              sx={{ width: 32, height: 1.5, backgroundColor: '#C9A84C', display: 'inline-block' }}
            />
            Sacred Ministry from Nazareth
            <Box
              component="span"
              sx={{ width: 32, height: 1.5, backgroundColor: '#C9A84C', display: 'inline-block' }}
            />
          </Typography>

          {/* Main Title */}
          <Typography
            component="h1"
            sx={{
              fontFamily: 'Cinzel, serif',
              fontWeight: 700,
              fontSize: { xs: 'clamp(2.2rem, 7vw, 3rem)', md: 'clamp(2.8rem, 6vw, 4.5rem)' },
              lineHeight: 1.15,
              color: '#F7F2E8',
              mb: 1,
              textShadow: '0 2px 20px rgba(0,0,0,0.5)',
            }}
          >
            Nazareth
          </Typography>
          <Typography
            component="span"
            sx={{
              fontFamily: 'Cinzel, serif',
              fontWeight: 700,
              fontSize: { xs: 'clamp(2.2rem, 7vw, 3rem)', md: 'clamp(2.8rem, 6vw, 4.5rem)' },
              lineHeight: 1.15,
              display: 'block',
              background: 'linear-gradient(135deg, #C9A84C 0%, #E8C97A 40%, #8A6107 70%, #C9A84C 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 3,
            }}
          >
            Holy Cross
          </Typography>

          {/* Subtitle */}
          <Typography
            sx={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontStyle: 'italic',
              fontSize: { xs: '1rem', md: '1.25rem' },
              color: 'rgba(247,242,232,0.75)',
              mb: 4,
              lineHeight: 1.7,
              maxWidth: 560,
            }}
          >
            Where faith was born — connecting the faithful with the holy city of Nazareth through sacred goods, candlelight prayers, and live spiritual experiences.
          </Typography>

          {/* Gold divider */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
            <Box sx={{ flex: 1, maxWidth: 80, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.5))' }} />
            <Box sx={{ color: '#C9A84C', fontSize: '1.1rem' }}>✦</Box>
            <Box sx={{ width: 120, height: '1px', background: 'linear-gradient(90deg, rgba(201,168,76,0.5), transparent)' }} />
          </Box>

          {/* CTA Buttons */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              component={Link}
              href={`/${locale}/shop`}
              variant="contained"
              size="large"
              startIcon={<StorefrontIcon />}
              sx={{
                background: 'linear-gradient(135deg, #C9A84C 0%, #8A6107 100%)',
                color: '#1C1208',
                fontFamily: 'Cinzel, serif',
                fontWeight: 700,
                fontSize: '0.85rem',
                letterSpacing: '0.12em',
                px: 4,
                py: 1.75,
                boxShadow: '0 4px 24px rgba(201,168,76,0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #E8C97A 0%, #C9A84C 100%)',
                  boxShadow: '0 8px 32px rgba(201,168,76,0.6)',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Explore Shop
            </Button>
            <Button
              component={Link}
              href={`/${locale}/candle`}
              variant="outlined"
              size="large"
              startIcon={<LocalFireDepartmentIcon />}
              sx={{
                borderColor: 'rgba(201,168,76,0.6)',
                borderWidth: '1.5px',
                color: '#C9A84C',
                fontFamily: 'Cinzel, serif',
                fontWeight: 600,
                fontSize: '0.85rem',
                letterSpacing: '0.12em',
                px: 4,
                py: 1.75,
                '&:hover': {
                  borderColor: '#C9A84C',
                  backgroundColor: 'rgba(201,168,76,0.1)',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Light a Candle
            </Button>
          </Stack>

          {/* Stats strip */}
          <Stack
            direction="row"
            spacing={{ xs: 3, md: 5 }}
            sx={{ mt: 6, pt: 4, borderTop: '1px solid rgba(201,168,76,0.15)' }}
          >
            {[
              { value: '10,000+', label: 'Candles Lit' },
              { value: '9', label: 'Languages' },
              { value: '50+', label: 'Products' },
            ].map(({ value, label }) => (
              <Box key={label}>
                <Typography
                  sx={{
                    fontFamily: 'Cinzel, serif',
                    fontWeight: 700,
                    fontSize: { xs: '1.4rem', md: '1.8rem' },
                    color: '#C9A84C',
                    lineHeight: 1,
                  }}
                >
                  {value}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'Lato, sans-serif',
                    fontSize: '0.72rem',
                    color: 'rgba(247,242,232,0.5)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    mt: 0.5,
                  }}
                >
                  {label}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Container>

      {/* Bottom fade */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 120,
          background: 'linear-gradient(transparent, #F7F2E8)',
          pointerEvents: 'none',
        }}
      />

      {/* Scroll indicator */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          zIndex: 2,
          opacity: loaded ? 1 : 0,
          transition: 'opacity 1.5s ease',
        }}
      >
        <Typography
          sx={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'rgba(247,242,232,0.3)', textTransform: 'uppercase' }}
        >
          Scroll
        </Typography>
        <Box
          sx={{
            width: 1.5,
            height: 40,
            background: 'linear-gradient(transparent, rgba(201,168,76,0.5))',
            animation: 'scrollFade 2s ease infinite',
            '@keyframes scrollFade': {
              '0%': { opacity: 0, transform: 'scaleY(0)', transformOrigin: 'top' },
              '50%': { opacity: 1 },
              '100%': { opacity: 0, transform: 'scaleY(1)', transformOrigin: 'top' },
            },
          }}
        />
      </Box>
    </Box>
  );
}
