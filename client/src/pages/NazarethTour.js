import React from 'react';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import ExploreIcon from '@mui/icons-material/Explore';
import { useTranslation } from 'react-i18next';
import { gold, goldDark, crimson, textSecondary, goldGradientText } from '../theme';

const SITES = [
  { title: 'Latin Church',         subtitle: 'Basilica of the Annunciation', path: '/gallery/latin',    img: '/images/latinChurch.jpg',   icon: '⛪' },
  { title: 'Greek Orthodox Church', subtitle: 'Church of the Annunciation', path: '/gallery/greek',    img: '/images/greekChurch.jpg',   icon: '⛪' },
  { title: "Mary's Well",           subtitle: 'The Sacred Spring',           path: '/gallery/maryswell', img: '/images/maryswell.jpg',     icon: '💧' },
  { title: 'Old City',              subtitle: 'Historic Heart of Nazareth',  path: '/gallery/old-city',  img: '/images/oldcity.jpg',       icon: '🏛' },
  { title: 'Nazareth',              subtitle: 'The City of Jesus',           path: '/gallery/nazareth',  img: '/images/nazareth.jpg',      icon: '🌿' },
];

export default function NazarethTour() {
  const { t } = useTranslation();

  return (
    <Box sx={{ backgroundColor: '#F7F2E8', minHeight: '80vh' }}>
      {/* Header */}
      <Box sx={{
        position: 'relative', py: { xs: 10, md: 14 },
        background: 'linear-gradient(160deg, #1C0E06 0%, #2C1810 50%, #1C0E06 100%)',
        textAlign: 'center', overflow: 'hidden',
        '&::after': { content: '""', position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', background: 'linear-gradient(to bottom, transparent, #F7F2E8)' },
      }}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <ExploreIcon sx={{ color: gold, fontSize: '1.2rem' }} />
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: alpha(gold, 0.7), textTransform: 'uppercase' }}>
              Virtual Tour
            </Typography>
          </Box>
          <Typography variant="h1" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '2rem', md: '3rem' }, ...goldGradientText, mb: 2 }}>
            {t('nazarethTour.pageHeading')}
          </Typography>
          <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', color: alpha('#F7F2E8', 0.65), maxWidth: 560, mx: 'auto', px: 3, fontSize: '0.95rem' }}>
            {t('nazarethTour.videoMessage')}
          </Typography>
        </Box>
      </Box>

      {/* Video intro */}
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 7 } }}>
        <Box
          component="video"
          src="https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fvideo-7.mp4?alt=media&token=b0173721-21a1-46d0-b15b-f2001b912e72"
          controls
          poster="/images/nazareth.jpg"
          sx={{
            width: '100%', borderRadius: '12px',
            border: `1px solid ${alpha(gold, 0.2)}`,
            boxShadow: `0 8px 32px ${alpha('#8A6107', 0.15)}`,
            display: 'block',
          }}
        />
        <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.82rem', color: textSecondary, textAlign: 'center', mt: 2, fontStyle: 'italic' }}>
          {t('nazarethTour.videoDescription')}
        </Typography>
      </Container>

      {/* Holy Sites Grid */}
      <Box sx={{ py: { xs: 6, md: 10 }, backgroundColor: '#EDE6D4' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
            <Typography variant="h2" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.6rem', md: '2.2rem' }, ...goldGradientText }}>
              Explore Holy Sites
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {SITES.map((site) => (
              <Grid item xs={12} sm={6} md={4} key={site.path}>
                <Box
                  component={Link}
                  to={site.path}
                  sx={{
                    display: 'block', position: 'relative', overflow: 'hidden',
                    borderRadius: '12px', textDecoration: 'none',
                    border: `1px solid ${alpha(gold, 0.2)}`,
                    boxShadow: `0 2px 16px ${alpha('#8A6107', 0.08)}`,
                    transition: 'all 0.35s ease',
                    '&:hover': { transform: 'translateY(-8px)', boxShadow: `0 12px 40px ${alpha('#8A6107', 0.18)}`, borderColor: alpha(gold, 0.45) },
                    '&:hover .site-img': { transform: 'scale(1.06)' },
                  }}
                >
                  <Box sx={{ position: 'relative', height: 220, overflow: 'hidden', backgroundColor: '#1C0E06' }}>
                    <Box
                      className="site-img"
                      sx={{
                        position: 'absolute', inset: 0,
                        backgroundImage: `url(${site.img})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        filter: 'brightness(0.65)',
                        transition: 'transform 0.5s ease',
                      }}
                    />
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box sx={{ fontSize: '2.5rem' }}>{site.icon}</Box>
                    </Box>
                  </Box>
                  <Box sx={{ p: 2.5, backgroundColor: '#FFFFFF' }}>
                    <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '0.85rem', color: '#1C1208', mb: 0.5, letterSpacing: '0.05em' }}>
                      {site.title}
                    </Typography>
                    <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.78rem', color: textSecondary }}>
                      {site.subtitle}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
