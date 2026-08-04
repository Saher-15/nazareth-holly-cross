import React from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import { FaWhatsapp } from 'react-icons/fa';

const WHATSAPP_NUMBER = '972522208055'; // Replace with actual number

export default function WhatsAppButton() {
  return (
    <Tooltip title="Chat on WhatsApp" placement="right">
      <Box
        component="a"
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact us on WhatsApp"
        sx={{
          position: 'fixed',
          bottom: { xs: 28, md: 36 },
          left: { xs: 16, md: 28 },
          zIndex: 1400,
          width: 52, height: 52,
          borderRadius: '50%',
          backgroundColor: '#25D366',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 20px ${alpha('#25D366', 0.5)}`,
          textDecoration: 'none',
          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: -3,
            borderRadius: '50%',
            border: `2px solid ${alpha('#25D366', 0.35)}`,
            animation: 'waPulse 2s ease-in-out infinite',
          },
          '@keyframes waPulse': {
            '0%,100%': { transform: 'scale(1)', opacity: 0.7 },
            '50%': { transform: 'scale(1.15)', opacity: 0 },
          },
          '&:hover': {
            backgroundColor: '#1ebe5e',
            transform: 'translateY(-4px)',
            boxShadow: `0 8px 32px ${alpha('#25D366', 0.65)}`,
          },
        }}
      >
        <FaWhatsapp size={26} color="#FFFFFF" />
      </Box>
    </Tooltip>
  );
}
