import React from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { gold } from '../../theme';

const LoadingLogo = () => {
  return (
    <Box
      sx={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
      }}
    >
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress
          size={56}
          thickness={1.5}
          sx={{
            color: alpha(gold, 0.3),
            position: 'absolute',
          }}
          variant="determinate"
          value={100}
        />
        <CircularProgress
          size={56}
          thickness={1.5}
          sx={{ color: gold }}
        />
        <i
          className="fas fa-cross"
          style={{
            position: 'absolute',
            fontSize: '1.2rem',
            color: alpha(gold, 0.7),
          }}
        />
      </Box>
      <Typography
        sx={{
          fontFamily: '"Cinzel", serif',
          fontSize: '0.65rem',
          letterSpacing: '0.4em',
          color: alpha(gold, 0.5),
          textTransform: 'uppercase',
          animation: 'pulse 2s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 0.4 },
            '50%': { opacity: 1 },
          },
        }}
      >
        Loading
      </Typography>
    </Box>
  );
};

export default LoadingLogo;
