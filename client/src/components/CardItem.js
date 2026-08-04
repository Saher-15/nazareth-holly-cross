import React from 'react';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { gold, goldDark } from '../theme';

export default function CardItem({ src, text, label, path }) {
  return (
    <Box
      component={Link}
      to={path}
      sx={{
        display: 'block', textDecoration: 'none',
        height: '100%', position: 'relative',
        borderRadius: '10px', overflow: 'hidden',
        border: `1px solid ${alpha(gold, 0.25)}`,
        background: '#FFFFFF',
        transition: 'all 0.45s cubic-bezier(0.4,0,0.2,1)',
        cursor: 'pointer',
        boxShadow: `0 2px 16px ${alpha('#8A6107', 0.08)}`,
        '&:hover': {
          border: `1px solid ${alpha(gold, 0.42)}`,
          boxShadow: `0 24px 60px ${alpha('#8A6107', 0.2)}, 0 0 36px ${alpha(gold, 0.12)}`,
          transform: 'translateY(-8px)',
          '& .ci-img': { transform: 'scale(1.09)', filter: 'brightness(0.65) saturate(1.15)' },
          '& .ci-overlay': { opacity: 1 },
          '& .ci-bar': { width: '100%' },
          '& .ci-explore': { opacity: 1, transform: 'translateY(0)' },
          '& .ci-chip': { opacity: 1 },
        },
      }}
    >
      {/* Image */}
      <Box sx={{ position: 'relative', overflow: 'hidden', height: { xs: 200, sm: 240, md: 270 } }}>
        <Box
          className="ci-img"
          component="img"
          src={src}
          alt={label}
          loading="lazy"
          sx={{
            width: '100%', height: '100%', objectFit: 'cover',
            filter: 'brightness(0.8) saturate(0.9)',
            transition: 'all 0.55s cubic-bezier(0.4,0,0.2,1)',
          }}
        />

        {/* Gradient overlay */}
        <Box className="ci-overlay" sx={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(to top, ${alpha('#000', 0.78)} 0%, ${alpha('#000', 0.18)} 50%, transparent 100%)`,
          opacity: 0.4,
          transition: 'opacity 0.4s ease',
        }} />

        {/* Category chip */}
        <Box
          className="ci-chip"
          sx={{
            position: 'absolute', top: 12, left: 12,
            px: 1.5, py: 0.5,
            background: alpha('#2C1810', 0.82),
            backdropFilter: 'blur(12px)',
            border: `1px solid ${alpha(gold, 0.4)}`,
            borderRadius: '4px',
            fontFamily: '"Cinzel", serif',
            fontSize: '0.55rem',
            letterSpacing: '0.14em',
            fontWeight: 600,
            color: gold,
            opacity: 0.9,
            transition: 'opacity 0.35s ease',
          }}
        >
          {label}
        </Box>

        {/* Bottom gold bar slide-in */}
        <Box className="ci-bar" sx={{
          position: 'absolute', bottom: 0, left: 0,
          width: '0%', height: '2px',
          background: `linear-gradient(90deg, ${gold}, ${goldDark})`,
          transition: 'width 0.45s ease',
        }} />
      </Box>

      {/* Text */}
      <Box sx={{
        px: 2.5, pt: 2, pb: 2.5,
        background: '#FFFFFF',
      }}>
        <Typography sx={{
          fontFamily: '"Playfair Display", serif',
          fontWeight: 400, fontStyle: 'italic',
          fontSize: '0.88rem',
          color: '#5D3E2C',
          lineHeight: 1.65,
          mb: 1.5,
        }}>
          {text}
        </Typography>

        {/* Explore cue */}
        <Box className="ci-explore" sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          fontFamily: '"Cinzel", serif',
          fontSize: '0.62rem', letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: goldDark,
          opacity: 0, transform: 'translateY(6px)',
          transition: 'all 0.35s ease 0.05s',
        }}>
          Explore
          <Box sx={{ flex: 1, maxWidth: 40, height: '1px', background: `linear-gradient(90deg, ${alpha(goldDark, 0.7)}, transparent)` }} />
          →
        </Box>
      </Box>
    </Box>
  );
}
