'use client';
import React, { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Paper, Chip, Button,
} from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined';
import { colors } from '@/lib/theme';
import api from '@/lib/api';

export default function LivePage() {
  const [roomID, setRoomID] = useState('');

  useEffect(() => {
    const fetch = () => {
      api.get('/live/room_id').then(r => setRoomID(r.data?.roomID || '')).catch(() => {});
    };
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, []);

  const isLive = Boolean(roomID);

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ py: { xs: 8, md: 12 }, background: 'linear-gradient(160deg, #1C0E06, #2C1810)', textAlign: 'center', position: 'relative' }}>
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          {isLive && (
            <Chip
              icon={<FiberManualRecordIcon sx={{ fontSize: '0.7rem !important', color: '#FF6B6B !important' }} />}
              label="LIVE NOW"
              sx={{
                mb: 2,
                backgroundColor: 'rgba(139,26,26,0.8)',
                color: '#FFFFFF',
                fontFamily: 'Cinzel, serif',
                fontWeight: 700,
                letterSpacing: '0.15em',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            />
          )}
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.5rem' }, color: '#F7F2E8', mb: 1.5 }}>
            Live from Nazareth
          </Typography>
          <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: 'rgba(247,242,232,0.7)', fontSize: '1.05rem' }}>
            Join sacred events and ceremonies streaming live from the Holy Land
          </Typography>
          <Box sx={{ width: 60, height: 3, background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', mx: 'auto', mt: 2 }} />
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        {isLive ? (
          <Paper
            elevation={3}
            sx={{
              p: { xs: 3, md: 5 },
              background: 'linear-gradient(135deg, rgba(139,26,26,0.08), rgba(201,168,76,0.08))',
              border: '2px solid rgba(139,26,26,0.4)',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Chip
                icon={<FiberManualRecordIcon sx={{ fontSize: '0.7rem !important', color: '#FF6B6B !important' }} />}
                label="LIVE NOW"
                size="small"
                sx={{ backgroundColor: colors.crimson, color: '#FFFFFF', fontFamily: 'Cinzel, serif', fontWeight: 700 }}
              />
              <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.2rem', color: colors.textPrimary }}>
                Sacred Live Event
              </Typography>
            </Box>
            <Typography sx={{ color: colors.textSecondary, mb: 3, lineHeight: 1.7 }}>
              A sacred event is happening live from Nazareth right now. Join us in prayer and worship.
            </Typography>
            <Box sx={{ borderRadius: 2, overflow: 'hidden', mb: 3, backgroundColor: '#000', minHeight: 400, position: 'relative' }}>
              <iframe
                src={`https://meet.jit.si/${roomID}`}
                title="Live Stream from Nazareth"
                allow="camera; microphone; fullscreen; display-capture"
                style={{ width: '100%', height: '500px', border: 'none' }}
              />
            </Box>
            <Button
              href={`https://meet.jit.si/${roomID}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="contained"
              size="large"
              startIcon={<PlayCircleOutlineIcon />}
              sx={{
                backgroundColor: colors.crimson,
                color: '#FFFFFF',
                fontFamily: 'Cinzel, serif',
                px: 4,
                '&:hover': { backgroundColor: colors.crimsonDark },
              }}
            >
              Open Full Screen
            </Button>
          </Paper>
        ) : (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Typography sx={{ fontSize: '5rem', mb: 2.5 }}>📺</Typography>
            <Typography sx={{ fontFamily: 'Cinzel, serif', fontSize: { xs: '1.2rem', md: '1.5rem' }, color: colors.textPrimary, mb: 1.5 }}>
              No Live Event at the Moment
            </Typography>
            <Typography sx={{ color: colors.textMuted, fontSize: '0.95rem', maxWidth: 420, mx: 'auto', lineHeight: 1.7 }}>
              We broadcast live masses, special ceremonies, and events from the holy churches of Nazareth.
              Check back soon or follow us for updates.
            </Typography>
            <Box
              sx={{
                mt: 5,
                p: 4,
                borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(201,168,76,0.06), rgba(139,26,26,0.06))',
                border: '1px solid rgba(201,168,76,0.15)',
                maxWidth: 480,
                mx: 'auto',
              }}
            >
              <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: '1rem', color: colors.textSecondary, lineHeight: 1.8 }}>
                &ldquo;For where two or three gather in my name, there am I with them.&rdquo;
              </Typography>
              <Typography sx={{ fontFamily: 'Lato, sans-serif', fontSize: '0.75rem', color: colors.gold, mt: 1.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Matthew 18:20
              </Typography>
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  );
}
