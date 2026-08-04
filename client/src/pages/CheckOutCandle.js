import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import PaypalCandle from '../components/PaypalCandle';
import { gold, goldGradientText, crimson } from '../theme';

export default function CheckOutCandle() {
  const location = useLocation();
  const state = location.state;

  if (!state?.form) return <Navigate to="/candle" replace />;

  const { form } = state;

  return (
    <Box sx={{ backgroundColor: '#F7F2E8', minHeight: '80vh' }}>
      <Box sx={{
        position: 'relative', py: { xs: 8, md: 10 },
        background: 'linear-gradient(160deg, #1C0E06 0%, #2C1810 50%, #1C0E06 100%)',
        textAlign: 'center', overflow: 'hidden',
        '&::after': { content: '""', position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', background: 'linear-gradient(to bottom, transparent, #F7F2E8)' },
      }}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: alpha(gold, 0.7), textTransform: 'uppercase', mb: 2 }}>
            Sacred Candle Payment
          </Typography>
          <Typography variant="h1" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.6rem' }, ...goldGradientText }}>
            Light Your Candle
          </Typography>
        </Box>
      </Box>
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
        <PaypalCandle form={form} />
      </Container>
    </Box>
  );
}
