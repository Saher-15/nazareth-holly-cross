import React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import CardItem from './CardItem';
import { useTranslation } from 'react-i18next';
import { gold, crimson, goldGradientText } from '../theme';

const destinations = [
  { src: 'images/latin/latin1.jpg',         textKey: 'cards.latinChurch',   label: 'Latin Church',        path: '/latin' },
  { src: 'images/greek/greek1.jpg',          textKey: 'cards.greekChurch',   label: 'Greek Church',        path: '/greek' },
  { src: 'images/mary/mary4.jpg',            textKey: 'cards.marysWell',     label: "Mary's Well",         path: '/maryswell' },
  { src: 'images/old/old2.jpg',              textKey: 'cards.oldCity',       label: 'Old City',            path: '/oldcity' },
  { src: 'images/nazareth/nazareth1.webp',   textKey: 'cards.cityOfNazareth',label: 'City of Nazareth',   path: '/city' },
];

export default function Cards() {
  const { t } = useTranslation();

  return (
    <Box
      component="section"
      sx={{
        py: { xs: 8, md: 12 },
        px: { xs: 2, sm: 3 },
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#F7F2E8',
        '&::before': {
          content: '""', position: 'absolute',
          top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: '700px', height: '700px', borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(gold, 0.018)} 0%, transparent 70%)`,
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="lg">

        {/* ── Section header ── */}
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 9 } }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
            <Box sx={{ width: 48, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.55)})` }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: alpha(crimson, 0.9), boxShadow: `0 0 8px ${alpha(crimson, 0.7)}` }} />
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.6rem', letterSpacing: '0.42em', color: alpha(gold, 0.7), textTransform: 'uppercase' }}>
                Discover
              </Typography>
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: alpha(crimson, 0.9), boxShadow: `0 0 8px ${alpha(crimson, 0.7)}` }} />
            </Box>
            <Box sx={{ width: 48, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.55)}, transparent)` }} />
          </Box>

          <Typography
            variant="h2"
            sx={{
              fontFamily: '"Cinzel", serif', fontWeight: 700,
              fontSize: { xs: '1.8rem', sm: '2.4rem', md: '3rem' },
              ...goldGradientText, mb: 2,
            }}
          >
            {t('cards.title')}
          </Typography>

          <Typography sx={{
            fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
            color: '#9B7B6A',
            fontSize: { xs: '0.9rem', md: '1rem' },
            maxWidth: 520, mx: 'auto',
          }}>
            Walk in the footsteps of history — sacred sites of the Holy Land
          </Typography>
        </Box>

        {/* ── Cards grid ──
          Top row: 2 large cards (md=6 each)
          Bottom row: 3 equal cards (md=4 each)
        ── */}
        <Grid container spacing={{ xs: 2, md: 3 }} justifyContent="center">
          {destinations.map((dest, i) => (
            <Grid
              key={dest.path}
              size={{ xs: 12, sm: 6, md: i < 2 ? 6 : 4 }}
              sx={{
                opacity: 0,
                animation: 'cardFadeUp 0.6s ease forwards',
                animationDelay: `${i * 0.1}s`,
                '@keyframes cardFadeUp': {
                  from: { opacity: 0, transform: 'translateY(28px)' },
                  to:   { opacity: 1, transform: 'translateY(0)' },
                },
              }}
            >
              <CardItem
                src={dest.src}
                text={t(dest.textKey)}
                label={dest.label}
                path={dest.path}
              />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
