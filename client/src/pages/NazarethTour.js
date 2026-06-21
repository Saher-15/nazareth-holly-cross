import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import HomeIcon from '@mui/icons-material/Home';
import { gold, goldLight, goldDark, crimson, goldGradientText } from '../theme';

const NazarethTour = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <Box sx={{ minHeight: '80vh', py: { xs: 6, md: 10 }, px: { xs: 2, sm: 3 } }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ width: 40, height: 1, background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.6)})` }} />
            <Typography variant="overline" sx={{ color: alpha(gold, 0.7), letterSpacing: '0.35em', fontSize: '0.62rem', fontFamily: '"Cinzel", serif' }}>
              Virtual Experience
            </Typography>
            <Box sx={{ width: 40, height: 1, background: `linear-gradient(90deg, ${alpha(gold, 0.6)}, transparent)` }} />
          </Box>

          <Typography
            component="h1"
            sx={{
              fontFamily: '"Cinzel", serif',
              fontWeight: 700,
              fontSize: { xs: '2rem', sm: '2.6rem', md: '3.2rem' },
              ...goldGradientText,
              mb: 2,
            }}
          >
            {t('nazarethTour.pageHeading')}
          </Typography>

          <Box sx={{ width: 60, height: 2, mx: 'auto', background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
        </Box>

        {/* Video */}
        <Box
          sx={{
            borderRadius: '12px',
            overflow: 'hidden',
            border: `1px solid ${alpha(gold, 0.2)}`,
            boxShadow: `0 20px 60px ${alpha('#000', 0.7)}, 0 0 40px ${alpha(gold, 0.08)}`,
            mb: 5,
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: `linear-gradient(90deg, transparent, ${gold}, transparent)`,
              zIndex: 1,
            },
          }}
        >
          <Box
            component="video"
            src="https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Ftour.mp4?alt=media&token=af5c1463-2e97-4ae3-b205-a7566f45f9be"
            controls
            poster="images/jesus_city_tour.png"
            sx={{ width: '100%', display: 'block' }}
          />
        </Box>

        {/* Description */}
        <Box
          sx={{
            p: { xs: 3, md: 4 },
            background: `linear-gradient(145deg, ${alpha('#1A1215', 0.7)} 0%, ${alpha('#0D0810', 0.8)} 100%)`,
            border: `1px solid ${alpha(gold, 0.1)}`,
            borderRadius: '12px',
            mb: 4,
            textAlign: 'center',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              borderRadius: '12px 12px 0 0',
              background: `linear-gradient(90deg, transparent, ${gold}, transparent)`,
            },
          }}
        >
          <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: { xs: '1rem', md: '1.15rem' }, color: alpha(goldLight, 0.7), lineHeight: 1.9, mb: 2 }}>
            {t('nazarethTour.videoMessage')}
          </Typography>
          <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.92rem', color: alpha(goldLight, 0.55), lineHeight: 1.8 }}>
            {t('nazarethTour.videoDescription')}
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<HomeIcon />}
            onClick={() => navigate('/')}
            sx={{
              borderColor: alpha(gold, 0.4),
              color: alpha(goldLight, 0.75),
              px: 4,
              py: 1.5,
              fontFamily: '"Cinzel", serif',
              fontSize: '0.75rem',
              letterSpacing: '0.15em',
              '&:hover': {
                borderColor: gold,
                backgroundColor: alpha(gold, 0.08),
                color: gold,
              },
            }}
          >
            {t('nazarethTour.ctaButton')}
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default NazarethTour;
