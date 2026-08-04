'use client';
import React from 'react';
import { Fab, Tooltip, Zoom } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

export default function WhatsAppButton() {
  const whatsappNumber = '+97250-0000000';
  const message = encodeURIComponent('Hello! I found you through the Nazareth Holy Cross website.');
  const url = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${message}`;

  return (
    <Zoom in={true} style={{ transitionDelay: '500ms' }}>
      <Tooltip title="Chat with us on WhatsApp" placement="left">
        <Fab
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          component="a"
          size="medium"
          aria-label="Contact us on WhatsApp"
          sx={{
            position: 'fixed',
            bottom: { xs: 140, md: 90 },
            right: { xs: 16, md: 24 },
            backgroundColor: '#25D366',
            color: '#FFFFFF',
            zIndex: 1000,
            boxShadow: '0 4px 16px rgba(37,211,102,0.5)',
            '&:hover': {
              backgroundColor: '#1EBE5D',
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 24px rgba(37,211,102,0.6)',
            },
          }}
        >
          <WhatsAppIcon />
        </Fab>
      </Tooltip>
    </Zoom>
  );
}
