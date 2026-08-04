import React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { gold, goldLight, crimson, goldGradientText } from '../theme';

const scriptures = [
  { key: 'whatIsNew.scriptureNotes.matthew', ref: 'Mt 2:23' },
  { key: 'whatIsNew.scriptureNotes.luke1',   ref: 'Lk 1:26' },
  { key: 'whatIsNew.scriptureNotes.john',    ref: 'Jn 1:46' },
  { key: 'whatIsNew.scriptureNotes.luke4',   ref: 'Lk 4:16' },
];

const paragraphs = ['part1', 'part2', 'part3', 'part4', 'part5'];

export default function WhatIsNew() {
  const { t } = useTranslation();

  return (
    <Box
      component="section"
      sx={{
        py: { xs: 8, md: 14 },
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""', position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `
            radial-gradient(ellipse at 15% 50%, ${alpha(crimson, 0.05)} 0%, transparent 60%),
            radial-gradient(ellipse at 85% 50%, ${alpha(gold, 0.04)} 0%, transparent 60%)
          `,
        },
      }}
    >
      <Container maxWidth="lg">

        {/* ── Scripture header ── */}
        <Box sx={{ textAlign: 'center', mb: { xs: 7, md: 10 } }}>
          {/* Ornament */}
          <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 50, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.45)})` }} />
            <i className="fas fa-cross" style={{ fontSize: '1.6rem', color: alpha(crimson, 0.85), filter: `drop-shadow(0 0 14px ${alpha(crimson, 0.6)})` }} />
            <Box sx={{ width: 50, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.45)}, transparent)` }} />
          </Box>

          <Typography
            variant="h2"
            sx={{
              fontFamily: '"Cinzel", serif', fontWeight: 700,
              fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
              ...goldGradientText, mb: 1.5,
            }}
          >
            {t('whatIsNew.title')}
          </Typography>

          <Typography sx={{
            fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
            color: alpha(goldLight, 0.45), fontSize: { xs: '0.88rem', md: '0.95rem' },
            maxWidth: 480, mx: 'auto',
          }}>
            The city where every stone tells a sacred story
          </Typography>
        </Box>

        {/* ── Scripture cards ── */}
        <Grid container spacing={2.5} justifyContent="center" sx={{ mb: { xs: 8, md: 12 } }}>
          {scriptures.map(({ key, ref }) => (
            <Grid item xs={12} sm={6} md={3} key={key}>
              <Paper
                elevation={0}
                sx={{
                  p: 3, height: '100%',
                  background: `linear-gradient(145deg, ${alpha('#16111A', 0.85)} 0%, ${alpha('#0F0B12', 0.92)} 100%)`,
                  border: `1px solid ${alpha(gold, 0.1)}`,
                  borderRadius: '10px',
                  position: 'relative', overflow: 'hidden',
                  transition: 'all 0.4s ease',
                  '&:hover': {
                    border: `1px solid ${alpha(gold, 0.28)}`,
                    boxShadow: `0 12px 40px ${alpha('#000', 0.55)}, 0 0 20px ${alpha(gold, 0.07)}`,
                    transform: 'translateY(-5px)',
                  },
                  '&::before': {
                    content: '""', position: 'absolute', top: 0, left: 0, right: 0,
                    height: '2px',
                    background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.45)}, transparent)`,
                  },
                  '&::after': {
                    content: `"${ref}"`,
                    position: 'absolute', bottom: 10, right: 14,
                    fontFamily: '"Cinzel", serif', fontSize: '0.58rem',
                    letterSpacing: '0.12em', color: alpha(gold, 0.3),
                    textTransform: 'uppercase',
                  },
                }}
              >
                {/* Large decorative quote */}
                <Typography aria-hidden sx={{
                  position: 'absolute', top: -8, left: 8,
                  fontFamily: '"Playfair Display", serif',
                  fontSize: '5rem', lineHeight: 1,
                  color: alpha(gold, 0.05), userSelect: 'none', pointerEvents: 'none',
                }}>
                  "
                </Typography>

                <Typography sx={{
                  fontFamily: '"Playfair Display", serif',
                  fontStyle: 'italic',
                  fontSize: { xs: '0.84rem', md: '0.88rem' },
                  color: alpha(goldLight, 0.72),
                  lineHeight: 1.82,
                  fontWeight: 400,
                  position: 'relative', zIndex: 1,
                }}>
                  {t(key)}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* ── Touching the Sacred ── */}
        <Box sx={{ maxWidth: 840, mx: 'auto' }}>
          {/* Ornamental divider */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 5, justifyContent: 'center' }}>
            <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.35)})` }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: alpha(gold, 0.5), boxShadow: `0 0 10px ${alpha(gold, 0.4)}` }} />
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: alpha(crimson, 0.7), boxShadow: `0 0 12px ${alpha(crimson, 0.5)}` }} />
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: alpha(gold, 0.5), boxShadow: `0 0 10px ${alpha(gold, 0.4)}` }} />
            </Box>
            <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.35)}, transparent)` }} />
          </Box>

          <Typography
            variant="h3"
            sx={{
              fontFamily: '"Cinzel", serif', fontWeight: 700,
              fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.1rem' },
              ...goldGradientText, textAlign: 'center', mb: 6,
            }}
          >
            {t('whatIsNew.touchingTheSacred')}
          </Typography>

          <Box
            sx={{
              background: `linear-gradient(145deg, ${alpha('#16111A', 0.65)} 0%, ${alpha('#0F0B12', 0.7)} 100%)`,
              border: `1px solid ${alpha(gold, 0.08)}`,
              borderRadius: '12px',
              p: { xs: 3.5, md: 5 },
              position: 'relative',
              '&::before': {
                content: '""', position: 'absolute',
                top: 0, left: 0, right: 0, height: '2px',
                background: `linear-gradient(90deg, transparent, ${alpha(crimson, 0.5)}, ${alpha(gold, 0.5)}, transparent)`,
              },
            }}
          >
            {paragraphs.map((part, i) => (
              <Typography
                key={part}
                sx={{
                  fontFamily: '"Lato", sans-serif',
                  fontWeight: 300,
                  fontSize: { xs: '0.93rem', md: '1rem' },
                  color: alpha(goldLight, 0.62),
                  lineHeight: 1.95, mb: i < 4 ? 2.5 : 0,
                  // Drop cap on first paragraph only
                  ...(i === 0 ? {
                    '&::first-letter': {
                      fontFamily: '"Playfair Display", serif',
                      fontSize: '3em',
                      fontWeight: 700,
                      color: alpha(gold, 0.75),
                      float: 'left',
                      lineHeight: 0.75,
                      marginRight: '0.08em',
                      marginTop: '0.06em',
                    },
                  } : {}),
                }}
              >
                {t(`whatIsNew.introParagraphs.${part}`)}
              </Typography>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
