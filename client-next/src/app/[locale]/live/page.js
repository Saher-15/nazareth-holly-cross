'use client';
import React, { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Grid, Paper, Chip, Button,
} from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { colors } from '@/lib/theme';
import api from '@/lib/api';

export default function LivePage() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api.get('/live/getEvents').then(r => setEvents(r.data || [])).catch(() => {});
  }, []);

  const now = new Date();
  const activeEvent = events.find((e) => e.isLive || e.status === 'live');
  const upcomingEvents = events.filter((e) => !e.isLive && new Date(e.startTime) > now);
  const pastEvents = events.filter((e) => new Date(e.startTime) < now && !e.isLive);

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ py: { xs: 8, md: 12 }, background: 'linear-gradient(160deg, #1C0E06, #2C1810)', textAlign: 'center', position: 'relative' }}>
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          {activeEvent && (
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
        {/* Active Live Event */}
        {activeEvent && (
          <Paper
            elevation={3}
            sx={{
              p: { xs: 3, md: 5 },
              mb: 5,
              background: 'linear-gradient(135deg, rgba(139,26,26,0.08), rgba(201,168,76,0.08))',
              border: '2px solid rgba(139,26,26,0.4)',
              borderRadius: 2,
              position: 'relative',
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
                {activeEvent.title}
              </Typography>
            </Box>
            <Typography sx={{ color: colors.textSecondary, mb: 3, lineHeight: 1.7 }}>
              {activeEvent.description || 'A sacred event is happening live from Nazareth right now.'}
            </Typography>
            <Button
              href={activeEvent.url || '#'}
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
              Join Live Stream
            </Button>
          </Paper>
        )}

        {/* No active events */}
        {!activeEvent && events.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography sx={{ fontSize: '4rem', mb: 2 }}>📺</Typography>
            <Typography sx={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: colors.textPrimary, mb: 1 }}>
              No Live Events at the Moment
            </Typography>
            <Typography sx={{ color: colors.textMuted }}>
              Check back soon for upcoming streams from Nazareth
            </Typography>
          </Box>
        )}

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <Box sx={{ mb: 6 }}>
            <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.2rem', color: colors.textPrimary, mb: 3 }}>
              Upcoming Events
            </Typography>
            <Grid container spacing={2.5}>
              {upcomingEvents.map((event) => (
                <Grid xs={12} sm={6} md={4} key={event._id || event.id}>
                  <Paper elevation={1} sx={{ p: 3, border: '1px solid rgba(201,168,76,0.15)', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <CalendarTodayIcon sx={{ fontSize: '1rem', color: colors.gold }} />
                      <Typography sx={{ fontSize: '0.78rem', color: colors.textMuted }}>
                        {new Date(event.startTime).toLocaleString()}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.95rem', color: colors.textPrimary, mb: 1 }}>
                      {event.title}
                    </Typography>
                    {event.description && (
                      <Typography sx={{ fontSize: '0.82rem', color: colors.textSecondary, lineHeight: 1.6 }}>
                        {event.description}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <Box>
            <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.2rem', color: colors.textPrimary, mb: 3 }}>
              Past Live Events
            </Typography>
            <Grid container spacing={2.5}>
              {pastEvents.slice(0, 6).map((event) => (
                <Grid xs={12} sm={6} md={4} key={event._id || event.id}>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 3,
                      border: '1px solid rgba(201,168,76,0.1)',
                      borderRadius: 2,
                      opacity: 0.7,
                    }}
                  >
                    <Typography sx={{ fontSize: '0.72rem', color: colors.textMuted, mb: 1 }}>
                      {new Date(event.startTime).toLocaleDateString()}
                    </Typography>
                    <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.9rem', color: colors.textPrimary }}>
                      {event.title}
                    </Typography>
                    {event.recordingUrl && (
                      <Button
                        href={event.recordingUrl}
                        target="_blank"
                        size="small"
                        startIcon={<PlayCircleOutlineIcon />}
                        sx={{ mt: 1, color: colors.goldDark, fontSize: '0.72rem', p: 0, '&:hover': { backgroundColor: 'transparent' } }}
                      >
                        Watch Recording
                      </Button>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Container>
    </Box>
  );
}
