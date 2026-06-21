import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import ChurchIcon from '@mui/icons-material/Church';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PeopleIcon from '@mui/icons-material/People';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { gold, goldLight, crimson, goldGradientText } from '../theme';

const pillars = [
  { Icon: ChurchIcon,    label: 'Faith',          color: crimson },
  { Icon: LocationOnIcon,label: 'The Holy Land',   color: gold },
  { Icon: PeopleIcon,    label: 'Community',       color: crimson },
  { Icon: FavoriteIcon,  label: 'Devotion',        color: gold },
];

export default function About() {
  const { t } = useTranslation();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <Box sx={{ minHeight: '80vh', pb: { xs: 8, md: 12 } }}>

      {/* ── Hero banner ── */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: 280, md: 360 },
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', mb: { xs: 7, md: 9 },
          '&::before': {
            content: '""', position: 'absolute', inset: 0,
            backgroundImage: 'url(/images/latin/latin1.jpg)',
            backgroundSize: 'cover', backgroundPosition: 'center 30%',
            filter: 'brightness(0.16) saturate(0.7)',
          },
          '&::after': {
            content: '""', position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, ${alpha('#000', 0.3)} 0%, transparent 40%, #07050A 100%)`,
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center', px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2.5 }}>
            <Box sx={{ width: 48, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.6)})` }} />
            <i className="fas fa-cross" style={{ color: crimson, fontSize: '1.1rem', filter: `drop-shadow(0 0 12px ${alpha(crimson, 0.85)})` }} />
            <Box sx={{ width: 48, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.6)}, transparent)` }} />
          </Box>
          <Typography component="h1" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.9rem', md: '2.7rem' }, letterSpacing: '0.06em', ...goldGradientText, mb: 1 }}>
            {t('about.title')}
          </Typography>
          <Box sx={{ width: 60, height: '2px', mx: 'auto', background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
        </Box>
      </Box>

      <Container maxWidth="lg">

        {/* ── Main content ── */}
        <Paper
          elevation={0}
          sx={{
            mb: { xs: 6, md: 8 },
            overflow: 'hidden',
            background: `linear-gradient(145deg, ${alpha('#16111A', 0.88)} 0%, ${alpha('#0F0B12', 0.93)} 100%)`,
            border: `1px solid ${alpha(gold, 0.12)}`,
            borderRadius: '14px',
            position: 'relative',
            '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${gold}, transparent)` },
          }}
        >
          {/* Decorative large quote */}
          <Typography aria-hidden sx={{ position: 'absolute', top: -12, left: { xs: 16, md: 28 }, fontFamily: '"Playfair Display", serif', fontSize: '9rem', lineHeight: 1, color: alpha(gold, 0.03), userSelect: 'none', pointerEvents: 'none' }}>
            "
          </Typography>

          <Grid container>
            {/* Text side */}
            <Grid size={{ xs: 12, md: 7 }} sx={{ p: { xs: 4, md: 6 } }}>
              {[t('about.description1'), t('about.description2')].map((desc, i) => (
                <Typography key={i} sx={{
                  fontFamily: '"Lato", sans-serif', fontWeight: 300,
                  fontSize: { xs: '0.93rem', md: '1.02rem' },
                  color: alpha(goldLight, 0.7), lineHeight: 1.95,
                  mb: i === 0 ? 3 : 0,
                  pl: 3, position: 'relative',
                  '&::before': {
                    content: '""', position: 'absolute', left: 0, top: '0.65em',
                    width: 16, height: '1px',
                    background: `linear-gradient(90deg, ${alpha(crimson, 0.7)}, transparent)`,
                  },
                }}>
                  {desc}
                </Typography>
              ))}
            </Grid>

            {/* Image side */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Box sx={{ height: { xs: 220, md: '100%' }, minHeight: { md: 320 }, position: 'relative', overflow: 'hidden' }}>
                <Box
                  component="img" src="/images/greek/greek1.jpg" alt="Nazareth"
                  onError={e => { e.target.style.display = 'none'; }}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'brightness(0.75) saturate(0.85)', transition: 'transform 0.6s ease', '&:hover': { transform: 'scale(1.04)' } }}
                />
                <Box sx={{ position: 'absolute', inset: 0, background: { xs: 'linear-gradient(to top, #07050A 0%, transparent 50%)', md: 'linear-gradient(to right, #16111A 0%, transparent 40%)' } }} />
              </Box>
            </Grid>
          </Grid>

          {/* Lower paragraphs */}
          <Box sx={{ px: { xs: 4, md: 6 }, pb: { xs: 4, md: 6 }, pt: 0, borderTop: `1px solid ${alpha(gold, 0.07)}` }}>
            {[t('about.description3'), t('about.description4')].map((desc, i) => (
              <Typography key={i} sx={{
                fontFamily: '"Lato", sans-serif', fontWeight: 300,
                fontSize: { xs: '0.9rem', md: '0.97rem' },
                color: alpha(goldLight, i === 1 ? 0.48 : 0.62),
                lineHeight: 1.95, mt: 3,
                fontStyle: i === 1 ? 'italic' : 'normal',
                pl: 3, position: 'relative',
                '&::before': {
                  content: '""', position: 'absolute', left: 0, top: '0.65em',
                  width: 16, height: '1px',
                  background: `linear-gradient(90deg, ${alpha(gold, 0.5)}, transparent)`,
                },
              }}>
                {desc}
              </Typography>
            ))}
          </Box>
        </Paper>

        {/* ── Mission pillars ── */}
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 28, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.45)})` }} />
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.6rem', letterSpacing: '0.3em', color: alpha(gold, 0.6), textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Our Mission
          </Typography>
          <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.2)}, transparent)` }} />
        </Box>

        <Grid container spacing={2.5}>
          {pillars.map(({ Icon, label, color }, i) => (
            <Grid size={{ xs: 6, md: 3 }} key={label}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2.5, md: 3 }, textAlign: 'center',
                  background: `linear-gradient(145deg, ${alpha('#16111A', 0.7)} 0%, ${alpha('#0F0B12', 0.8)} 100%)`,
                  border: `1px solid ${alpha(gold, 0.1)}`,
                  borderRadius: '12px',
                  transition: 'all 0.3s ease',
                  '&:hover': { border: `1px solid ${alpha(color, 0.3)}`, transform: 'translateY(-5px)', boxShadow: `0 14px 40px ${alpha('#000', 0.45)}` },
                }}
              >
                <Icon sx={{ fontSize: '1.8rem', color, mb: 1.5, filter: `drop-shadow(0 0 8px ${alpha(color, 0.4)})` }} />
                <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.15em', color: alpha(goldLight, 0.62), textTransform: 'uppercase' }}>
                  {label}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
