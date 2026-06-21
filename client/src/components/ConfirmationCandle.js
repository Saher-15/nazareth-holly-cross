import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import { alpha } from '@mui/material/styles';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { gold, goldLight, goldDark, crimson, goldGradientText } from '../theme';

const ConfirmationCandle = ({ firstName, lastName, email, prayer }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const send = async () => {
      try {
        await axios.post('https://nazareth-holy-cross-c5896e0462c5.herokuapp.com/candle/lightACandle', {
          firstName, lastName, email, prayer,
        });
        setTimeout(() => navigate('/'), 5000);
      } catch (err) {
        console.error('Error sending candle details:', err);
      }
    };
    send();
  }, [firstName, lastName, email, prayer, navigate]);

  return (
    <Box
      sx={{
        mt: 4,
        p: { xs: 3, md: 4 },
        background: `linear-gradient(145deg, ${alpha('#1A1215', 0.95)} 0%, ${alpha('#0D0810', 0.98)} 100%)`,
        border: `1px solid ${alpha(crimson, 0.3)}`,
        borderRadius: '16px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${crimson}, ${gold}, ${crimson}, transparent)`,
        },
      }}
    >
      {/* Flame icon */}
      <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
        <LocalFireDepartmentIcon
          sx={{
            fontSize: '3rem',
            color: crimson,
            filter: `drop-shadow(0 0 16px ${alpha(crimson, 0.8)}) drop-shadow(0 0 32px ${alpha('#FF6B35', 0.5)})`,
            animation: 'flicker 2s ease-in-out infinite alternate',
            '@keyframes flicker': {
              '0%': { transform: 'scale(1) rotate(-2deg)', opacity: 0.9 },
              '100%': { transform: 'scale(1.08) rotate(2deg)', opacity: 1 },
            },
          }}
        />
        <CheckCircleIcon
          sx={{
            fontSize: '1.1rem',
            color: '#4CAF50',
            position: 'absolute',
            bottom: -4,
            right: -4,
            filter: `drop-shadow(0 0 4px ${alpha('#4CAF50', 0.8)})`,
          }}
        />
      </Box>

      <Typography
        sx={{
          fontFamily: '"Cinzel", serif',
          fontWeight: 700,
          fontSize: { xs: '1.3rem', md: '1.6rem' },
          ...goldGradientText,
          mb: 1.5,
        }}
      >
        {t('confirmationCandle.thankYou')}
      </Typography>

      <Box sx={{ width: 50, height: 1, mx: 'auto', background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, mb: 2.5 }} />

      {[
        t('confirmationCandle.paymentSuccess'),
        t('confirmationCandle.receipt'),
        t('confirmationCandle.gratitude'),
      ].map((text, i) => (
        <Typography
          key={i}
          sx={{
            fontFamily: '"Lato", sans-serif',
            fontWeight: 300,
            fontSize: '0.88rem',
            color: alpha(goldLight, i === 2 ? 0.5 : 0.7),
            lineHeight: 1.8,
            mb: 1,
            fontStyle: i === 2 ? 'italic' : 'normal',
          }}
        >
          {text}
        </Typography>
      ))}

      <Box sx={{ mt: 3, px: 2 }}>
        <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.6rem', letterSpacing: '0.2em', color: alpha(gold, 0.45), textTransform: 'uppercase', mb: 1 }}>
          Redirecting to home
        </Typography>
        <LinearProgress
          sx={{
            height: 2,
            borderRadius: 1,
            backgroundColor: alpha(gold, 0.12),
            '& .MuiLinearProgress-bar': {
              background: `linear-gradient(90deg, ${crimson}, ${gold})`,
              animation: 'progress 5s linear forwards',
              '@keyframes progress': { '0%': { width: '0%' }, '100%': { width: '100%' } },
            },
          }}
        />
      </Box>
    </Box>
  );
};

export default ConfirmationCandle;
