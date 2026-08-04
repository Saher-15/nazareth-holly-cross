'use client';
import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Chip, Collapse } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import CloseIcon from '@mui/icons-material/Close';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined';
import { colors } from '@/lib/theme';

export default function LiveBanner({ event }) {
  const [open, setOpen] = useState(true);

  if (!event || !open) return null;

  return (
    <Collapse in={open}>
      <Box
        sx={{
          background: 'linear-gradient(135deg, #8B1A1A 0%, #5C0E0E 100%)',
          color: '#F7F2E8',
          py: 1.5,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          position: 'relative',
        }}
      >
        <Chip
          icon={
            <FiberManualRecordIcon
              sx={{ fontSize: '0.7rem !important', animation: 'pulse 1.5s infinite', color: '#FF6B6B !important' }}
            />
          }
          label="LIVE"
          size="small"
          sx={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: '#FFFFFF',
            fontFamily: 'Cinzel, serif',
            fontWeight: 700,
            letterSpacing: '0.1em',
            fontSize: '0.7rem',
            border: '1px solid rgba(255,255,255,0.3)',
          }}
        />
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'Lato, sans-serif',
            color: 'rgba(247,242,232,0.9)',
            fontSize: { xs: '0.8rem', md: '0.9rem' },
          }}
        >
          {event.title || 'Live Event in Progress'}
        </Typography>
        <Button
          href={event.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          startIcon={<PlayCircleOutlineIcon />}
          sx={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: '#FFFFFF',
            fontFamily: 'Cinzel, serif',
            fontSize: '0.7rem',
            letterSpacing: '0.08em',
            border: '1px solid rgba(255,255,255,0.3)',
            py: 0.5,
            px: 2,
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.25)' },
          }}
        >
          Join Live
        </Button>
        <Box
          onClick={() => setOpen(false)}
          sx={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.6)',
            display: 'flex',
            alignItems: 'center',
            '&:hover': { color: '#FFFFFF' },
          }}
        >
          <CloseIcon fontSize="small" />
        </Box>
      </Box>
    </Collapse>
  );
}
