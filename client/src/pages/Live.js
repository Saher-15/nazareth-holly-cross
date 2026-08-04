import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { gold, goldDark, crimson, textSecondary, goldGradientText } from '../theme';

const pastVideos = [
  {
    titleKey:       'videos.interview_nazareth.title',
    descriptionKey: 'videos.interview_nazareth.description',
    src:       'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Finterview.mp4?alt=media&token=8465ecc1-614f-4080-acc6-1113f1623ea6',
    thumbnail: '/images/interview.jpg',
  },
  {
    titleKey:       'videos.live_prayer_latin.title',
    descriptionKey: 'videos.live_prayer_latin.description',
    src:       'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Flive-17-9-24.mp4?alt=media&token=9bbb1fe2-4439-497c-adf6-038697cde4e0',
    thumbnail: '/images/live-17-9-24.jpg',
  },
];

export default function Live() {
  const { t } = useTranslation();
  const [roomId,   setRoomId]   = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.get('/live/room_id')
      .then(({ data }) => setRoomId(data?.roomId || null))
      .catch(() => setRoomId(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ backgroundColor: '#F7F2E8', minHeight: '80vh' }}>
      {/* Header */}
      <Box sx={{
        position: 'relative', py: { xs: 10, md: 14 },
        background: 'linear-gradient(160deg, #1C0E06 0%, #2C1810 50%, #1C0E06 100%)',
        textAlign: 'center', overflow: 'hidden',
        '&::after': { content: '""', position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', background: 'linear-gradient(to bottom, transparent, #F7F2E8)' },
      }}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: crimson, animation: 'livePulse 1.4s ease-in-out infinite', '@keyframes livePulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: crimson, textTransform: 'uppercase' }}>
              Live Stream
            </Typography>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: crimson, animation: 'livePulse 1.4s ease-in-out infinite', '@keyframes livePulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
          </Box>
          <Typography variant="h1" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '2rem', md: '3rem' }, ...goldGradientText }}>
            {t('live.event_ongoing') || 'Live from Nazareth'}
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        {/* Live embed or offline message */}
        {!loading && roomId ? (
          <Box sx={{ mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Chip
                icon={<LiveTvIcon sx={{ fontSize: '1rem !important' }} />}
                label="LIVE NOW"
                sx={{ backgroundColor: alpha(crimson, 0.12), color: crimson, fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.12em', border: `1px solid ${alpha(crimson, 0.3)}` }}
              />
              <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.82rem', color: textSecondary }}>
                {t('live.refresh_note')}
              </Typography>
            </Box>
            <Box
              sx={{
                position: 'relative', paddingTop: '56.25%',
                borderRadius: '12px', overflow: 'hidden',
                border: `2px solid ${alpha(crimson, 0.3)}`,
                boxShadow: `0 0 40px ${alpha(crimson, 0.15)}`,
              }}
            >
              <Box
                component="iframe"
                src={`https://meet.jit.si/${roomId}#userInfo.displayName=Visitor`}
                allow="camera; microphone; fullscreen; display-capture"
                sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
              />
            </Box>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                size="small"
                href={`https://meet.jit.si/${roomId}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.12em', borderColor: alpha(gold, 0.4), color: goldDark }}
              >
                Open Full Screen →
              </Button>
            </Box>
          </Box>
        ) : !loading && !roomId ? (
          <Box
            sx={{
              textAlign: 'center', py: { xs: 6, md: 8 }, mb: 6,
              p: { xs: 4, md: 6 }, backgroundColor: '#FFFFFF', borderRadius: '12px',
              border: `1px solid ${alpha(gold, 0.2)}`,
              boxShadow: `0 4px 24px ${alpha('#8A6107', 0.08)}`,
            }}
          >
            <LiveTvIcon sx={{ fontSize: '3rem', color: alpha(gold, 0.4), mb: 2 }} />
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.2rem', md: '1.6rem' }, ...goldGradientText, mb: 2 }}>
              {t('live.no_upcoming_events')}
            </Typography>
            <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', color: textSecondary, mb: 4, maxWidth: 480, mx: 'auto' }}>
              "He came to Nazareth, where He had been brought up." — Luke 4:16
            </Typography>
            <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.85rem', color: textSecondary }}>
              Check back soon for our next sacred live event from the Holy Land.
            </Typography>
          </Box>
        ) : null}

        {/* Past Videos */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: alpha(goldDark, 0.7), textTransform: 'uppercase', mb: 1.5 }}>
            Archive
          </Typography>
          <Typography variant="h3" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.4rem', md: '1.8rem' }, ...goldGradientText, mb: 4 }}>
            {t('live.past_live_events')}
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {pastVideos.map((v, i) => (
            <Grid item xs={12} md={6} key={i}>
              <Paper
                elevation={0}
                sx={{
                  overflow: 'hidden', borderRadius: '12px',
                  border: `1px solid ${alpha(gold, 0.18)}`,
                  boxShadow: `0 2px 16px ${alpha('#8A6107', 0.07)}`,
                }}
              >
                <Box
                  component="video"
                  src={v.src}
                  controls
                  poster={v.thumbnail}
                  sx={{ width: '100%', display: 'block', backgroundColor: '#1C0E06', maxHeight: 280 }}
                />
                <Box sx={{ p: 2.5 }}>
                  <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 600, fontSize: '0.85rem', color: '#1C1208', mb: 0.8 }}>
                    {t(v.titleKey)}
                  </Typography>
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.82rem', color: textSecondary }}>
                    {t(v.descriptionKey)}
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
