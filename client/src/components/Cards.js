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

const CARDS = [
  {
    key: 'latin',
    title: 'cards.latinChurch',
    path: '/gallery/latin',
    img: '/images/latinChurch.jpg',
    icon: '⛪',
    color: '#C9A84C',
  },
  {
    key: 'greek',
    title: 'cards.greekChurch',
    path: '/gallery/greek',
    img: '/images/greekChurch.jpg',
    icon: '⛪',
    color: '#8B1A1A',
  },
  {
    key: 'maryswell',
    title: 'cards.marysWell',
    path: '/gallery/maryswell',
    img: '/images/maryswell.jpg',
    icon: '💧',
    color: '#3D6B8C',
  },
  {
    key: 'oldcity',
    title: 'cards.oldCity',
    path: '/gallery/old-city',
    img: '/images/oldcity.jpg',
    icon: '🏛',
    color: '#8A6107',
  },
  {
    key: 'nazareth',
    title: 'cards.cityOfNazareth',
    path: '/gallery/nazareth',
    img: '/images/nazareth.jpg',
    icon: '🌿',
    color: '#2E6B4F',
  },
];

export default function Cards() {
  const { t } = useTranslation();

  return (
    <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#EDE6D4' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: alpha(goldDark, 0.7), textTransform: 'uppercase', mb: 1.5 }}>
            Explore
          </Typography>
          <Typography variant="h2" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.6rem', md: '2.2rem' }, ...goldGradientText }}>
            {t('cards.title')}
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {CARDS.map((card) => (
            <Grid item xs={12} sm={6} md={4} key={card.key}>
              <Box
                component={Link}
                to={card.path}
                sx={{
                  display: 'block', position: 'relative', overflow: 'hidden',
                  borderRadius: '12px', textDecoration: 'none',
                  border: `1px solid ${alpha(gold, 0.2)}`,
                  boxShadow: `0 2px 16px ${alpha('#8A6107', 0.08)}`,
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: `0 12px 40px ${alpha('#8A6107', 0.18)}`,
                    borderColor: alpha(gold, 0.45),
                    '& .card-img': { transform: 'scale(1.06)', filter: 'brightness(0.55)' },
                    '& .card-btn': { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                {/* Image */}
                <Box sx={{ position: 'relative', height: 260, overflow: 'hidden', backgroundColor: '#1C0E06' }}>
                  <Box
                    className="card-img"
                    sx={{
                      position: 'absolute', inset: 0,
                      backgroundImage: `url(${card.img})`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      filter: 'brightness(0.65)',
                      transition: 'transform 0.5s ease, filter 0.4s ease',
                    }}
                  />
                  {/* Icon overlay */}
                  <Box sx={{ position: 'absolute', top: 16, left: 16 }}>
                    <Box sx={{ fontSize: '1.8rem' }}>{card.icon}</Box>
                  </Box>

                  {/* Explore button */}
                  <Box
                    className="card-btn"
                    sx={{
                      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%) translateY(10px)',
                      opacity: 0, transition: 'all 0.3s ease',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.8,
                        backgroundColor: alpha(gold, 0.9), borderRadius: '4px',
                        px: 2, py: 0.8,
                      }}
                    >
                      <ExploreIcon sx={{ fontSize: '0.9rem', color: '#1C1208' }} />
                      <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.14em', color: '#1C1208' }}>
                        EXPLORE
                      </Typography>
                    </Box>
                  </Box>

                  {/* Bottom gradient */}
                  <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(to top, rgba(28,14,6,0.9), transparent)' }} />

                  {/* Title on image */}
                  <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 2.5 }}>
                    <Typography
                      sx={{
                        fontFamily: '"Cinzel", serif', fontWeight: 700,
                        fontSize: { xs: '0.8rem', md: '0.88rem' },
                        color: '#F7F2E8', letterSpacing: '0.06em', lineHeight: 1.4,
                      }}
                    >
                      {t(card.title)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
