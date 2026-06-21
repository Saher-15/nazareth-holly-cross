import React from 'react';
import { Link } from 'react-router-dom';
import MuiButton from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import { gold, goldLight, goldDark } from '../theme';

const styleMap = {
  'btn--primary': {
    variant: 'contained',
    sx: {
      background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
      color: '#0a0608',
      boxShadow: `0 4px 20px ${alpha(gold, 0.35)}`,
      '&:hover': {
        background: `linear-gradient(135deg, ${goldLight} 0%, ${gold} 100%)`,
        boxShadow: `0 8px 30px ${alpha(gold, 0.55)}`,
        transform: 'translateY(-2px)',
      },
    },
  },
  'btn--outline': {
    variant: 'outlined',
    sx: {
      borderColor: alpha(gold, 0.5),
      color: goldLight,
      '&:hover': {
        borderColor: gold,
        backgroundColor: alpha(gold, 0.1),
        boxShadow: `0 0 20px ${alpha(gold, 0.2)}`,
        transform: 'translateY(-2px)',
      },
    },
  },
  'btn--half': {
    variant: 'outlined',
    sx: {
      borderColor: alpha(goldLight, 0.35),
      color: alpha(goldLight, 0.8),
      '&:hover': {
        borderColor: goldLight,
        backgroundColor: alpha(goldLight, 0.08),
        transform: 'translateY(-2px)',
      },
    },
  },
};

const sizeMap = {
  'btn--medium': { size: 'medium', padding: '8px 24px', fontSize: '0.72rem' },
  'btn--large': { size: 'large', padding: '12px 32px', fontSize: '0.78rem' },
};

export const Button = ({ children, type, onClick, buttonStyle, buttonSize, destination }) => {
  const style = styleMap[buttonStyle] || styleMap['btn--primary'];
  const size = sizeMap[buttonSize] || sizeMap['btn--medium'];

  const button = (
    <MuiButton
      variant={style.variant}
      type={type}
      onClick={onClick}
      size={size.size}
      sx={{
        ...style.sx,
        py: size.padding.split(' ')[0],
        px: size.padding.split(' ')[1],
        fontSize: size.fontSize,
        fontFamily: '"Cinzel", serif',
        fontWeight: 600,
        letterSpacing: '0.12em',
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {children}
    </MuiButton>
  );

  if (destination) {
    return (
      <Link to={destination} style={{ textDecoration: 'none' }}>
        {button}
      </Link>
    );
  }

  return button;
};
