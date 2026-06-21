import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { gold, goldLight, crimson, goldGradientText } from '../theme';

const events = [
  { dateTime: new Date('2024-10-06T09:00:00+03:00'), description: 'Sunday Prayer from the Annunciation Church' },
];

const pastVideos = [
  {
    titleKey:       'videos.interview_nazareth.title',
    descriptionKey: 'videos.interview_nazareth.description',
    src:       'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Finterview.mp4?alt=media&token=8465ecc1-614f-4080-acc6-1113f1623ea6',
    thumbnail: 'images/interview.jpg',
  },
  {
    titleKey:       'videos.live_prayer_latin.title',
    descriptionKey: 'videos.live_prayer_latin.description',
    src:       'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Flive-17-9-24.mp4?alt=media&token=9bbb1fe2-4439-497c-adf6-038697cde4e0',
    thumbnail: 'images/live-17-9-24.jpg',
  },
];

export default function Live() {
  const { t } = useTranslation();
  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [inLiveMode,    setInLiveMode]    = useState(false);
  const [canJoinLive,   setCanJoinLive]   = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    const now = new Date();
    const upcoming = events
      .filter(e => new Date(e.dateTime) >= now)
      .sort((a, b) => a.dateTime - b.dateTime)[0] || null;

    if (!upcoming) {
      const live = events.find(e => {
        const start = new Date(e.dateTime);
        const end   = new Date(start.getTime() + 2 * 3600000);
        return now >= start && now <= end;
      });
      if (live) { setUpcomingEvent(live); setInLiveMode(true); setCanJoinLive(true); }
    } else {
      setUpcomingEvent(upcoming);
    }
  }, []);

  useEffect(() => {
    if (!upcomingEvent) return;
    const id = setInterval(() => {
      const diff = new Date(upcomingEvent.dateTime) - new Date();
      if (diff <= 0) { setTimeRemaining(t('live.event_has_started')); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000)  / 60000);
      const s = Math.floor((diff % 60000)    / 1000);
      setTimeRemaining(`${d}d ${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(id);
  }, [upcomingEvent, t]);

  return (
    <Box sx={{ minHeight: '80vh', py: { xs: 6, md: 10 }, px: { xs: 2, sm: 3 } }}>
      <Container maxWidth="lg">

        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <LiveTvIcon sx={{ color: crimson, fontSize: '1.4rem', filter: `drop-shadow(0 0 10px ${alpha(crimson, 0.75)})` }} />
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: crimson, animation: 'liveDot 1.6s ease-in-out infinite', '@keyframes liveDot': { '0%,100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.2, transform: 'scale(0.7)' } } }} />
          </Box>
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.5rem' }, ...goldGradientText, mb: 1 }}>
            Live Stream
          </Typography>
          <Box sx={{ width: 60, height: '2px', mx: 'auto', background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
          <Typography sx={{ mt: 1.5, fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.86rem', color: alpha(goldLight, 0.42) }}>
            Join us live from the sacred churches of Nazareth
          </Typography>
        </Box>

        {/* Upcoming / Live event */}
        {upcomingEvent ? (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3.5, md: 5.5 }, mb: 7,
              background: `linear-gradient(145deg, ${alpha('#16111A', 0.9)} 0%, ${alpha('#0F0B12', 0.96)} 100%)`,
              border: `1px solid ${alpha(inLiveMode ? crimson : gold, 0.22)}`,
              borderRadius: '14px', textAlign: 'center', position: 'relative',
              '&::before': {
                content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', borderRadius: '14px 14px 0 0',
                background: `linear-gradient(90deg, transparent, ${inLiveMode ? crimson : gold}, transparent)`,
              },
            }}
          >
            <Chip
              label={inLiveMode ? t('live.event_ongoing') : t('live.upcoming_event')}
              sx={{
                fontFamily: '"Cinzel", serif', fontSize: '0.6rem', letterSpacing: '0.15em',
                backgroundColor: inLiveMode ? alpha(crimson, 0.14) : alpha(gold, 0.09),
                color: inLiveMode ? '#FF6B6B' : gold,
                border: `1px solid ${inLiveMode ? alpha(crimson, 0.4) : alpha(gold, 0.3)}`,
                mb: 2.5,
              }}
            />

            <Typography sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 600, fontSize: { xs: '1.1rem', md: '1.4rem' }, color: goldLight, mb: 2 }}>
              {upcomingEvent.description}
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mb: 3 }}>
              <AccessTimeIcon sx={{ fontSize: '0.85rem', color: alpha(gold, 0.55) }} />
              <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.82rem', color: alpha(goldLight, 0.5) }}>
                {new Date(upcomingEvent.dateTime).toLocaleString()}
              </Typography>
            </Box>

            {/* Countdown */}
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1,
              px: 3.5, py: 1.4, borderRadius: '6px', mb: 3,
              backgroundColor: alpha(gold, 0.07),
              border: `1px solid ${alpha(gold, 0.18)}`,
              fontFamily: '"Cinzel", serif', fontSize: { xs: '1rem', md: '1.2rem' },
              fontWeight: 700, color: gold, letterSpacing: '0.08em',
            }}>
              {timeRemaining}
            </Box>

            {inLiveMode && (
              <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.8rem', color: alpha('#FF6B6B', 0.85), mb: 2 }}>
                {t('live.live_note')}
              </Typography>
            )}

            <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.76rem', color: alpha(goldLight, 0.35), mb: 3, fontStyle: 'italic' }}>
              {t('live.refresh_note')}
            </Typography>

            <Button
              variant={canJoinLive ? 'contained' : 'outlined'}
              disabled={!canJoinLive}
              startIcon={<LiveTvIcon />}
              onClick={() => window.open('https://www.instagram.com/nazareth_holy_cross/', '_blank')}
              sx={{
                fontFamily: '"Cinzel", serif', fontSize: '0.74rem', letterSpacing: '0.15em',
                py: 1.5, px: 4,
                ...(canJoinLive ? {
                  background: `linear-gradient(135deg, ${crimson}, #B22222)`,
                  color: '#fff', border: 'none',
                  boxShadow: `0 4px 20px ${alpha(crimson, 0.5)}`,
                  '&:hover': { boxShadow: `0 8px 30px ${alpha(crimson, 0.7)}`, transform: 'translateY(-2px)' },
                } : {
                  borderColor: alpha(gold, 0.25), color: alpha(goldLight, 0.35),
                }),
              }}
            >
              {t('live.join_live')}
            </Button>
          </Paper>
        ) : (
          <Box sx={{
            p: { xs: 3, md: 5 }, mb: 7, textAlign: 'center',
            border: `1px dashed ${alpha(gold, 0.15)}`, borderRadius: '14px',
          }}>
            <LiveTvIcon sx={{ fontSize: '2rem', color: alpha(gold, 0.2), mb: 1 }} />
            <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', color: alpha(goldLight, 0.35) }}>
              {t('live.no_upcoming_events')}
            </Typography>
          </Box>
        )}

        {/* Past videos */}
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 28, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.45)})` }} />
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.6rem', letterSpacing: '0.3em', color: alpha(gold, 0.6), textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            {t('live.past_live_events')}
          </Typography>
          <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.18)}, transparent)` }} />
        </Box>

        <Grid container spacing={3}>
          {pastVideos.map((video, i) => (
            <Grid size={{ xs: 12, md: 6 }} key={i}>
              <Paper
                elevation={0}
                sx={{
                  overflow: 'hidden',
                  background: `linear-gradient(145deg, ${alpha('#16111A', 0.9)} 0%, ${alpha('#0F0B12', 0.95)} 100%)`,
                  border: `1px solid ${alpha(gold, 0.1)}`,
                  borderRadius: '12px',
                  transition: 'all 0.35s ease',
                  '&:hover': { border: `1px solid ${alpha(gold, 0.28)}`, boxShadow: `0 16px 48px ${alpha('#000', 0.55)}`, transform: 'translateY(-5px)' },
                }}
              >
                <Box sx={{ position: 'relative' }}>
                  <Box
                    component="video" controls poster={video.thumbnail}
                    sx={{ width: '100%', display: 'block', borderBottom: `1px solid ${alpha(gold, 0.07)}` }}
                  >
                    <source src={video.src} type="video/mp4" />
                  </Box>
                  <Box sx={{
                    position: 'absolute', top: 12, right: 12,
                    background: alpha('#000', 0.6), backdropFilter: 'blur(8px)',
                    border: `1px solid ${alpha(gold, 0.25)}`, borderRadius: '50%',
                    width: 36, height: 36,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    <PlayCircleOutlineIcon sx={{ fontSize: '1rem', color: alpha(gold, 0.8) }} />
                  </Box>
                </Box>
                <Box sx={{ p: 2.5 }}>
                  <Typography sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 600, fontSize: '1rem', color: goldLight, mb: 0.8 }}>
                    {t(video.titleKey)}
                  </Typography>
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.82rem', color: alpha(goldLight, 0.48), lineHeight: 1.7 }}>
                    {t(video.descriptionKey)}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

      </Container>
    </Box>
  );
}
