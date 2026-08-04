'use client';
import React from 'react';
import {
  Box, Container, Grid, Typography, Paper, Button, Stack, Chip,
} from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined';
import MapIcon from '@mui/icons-material/Map';
import { colors } from '@/lib/theme';

const TOUR_STOPS = [
  {
    id: 'basilica',
    title: 'Basilica of the Annunciation',
    subtitle: 'Where the Angel Gabriel appeared to Mary',
    description: 'The largest church in the Middle East, built over the site of the Annunciation. The lower church contains the Grotto of the Annunciation — the traditional site of Gabriel\'s message to Mary.',
    youtubeId: null,
    emoji: '⛪',
    facts: ['Built in 1969', '6,000 capacity', 'UNESCO significance'],
  },
  {
    id: 'maryswell',
    title: "Mary's Well",
    subtitle: 'Ancient spring of Nazareth',
    description: 'According to tradition, Mary drew water from this spring daily. The Greek Orthodox Church of the Annunciation is built over the original spring, which still flows today.',
    youtubeId: null,
    emoji: '💧',
    facts: ['2,000+ years old', 'Ancient spring', 'Greek Orthodox Church'],
  },
  {
    id: 'greek-church',
    title: 'Greek Orthodox Church',
    subtitle: 'Built over the ancient spring',
    description: 'The Greek Orthodox Church of the Annunciation houses the spring where tradition says the Archangel Gabriel first appeared to Mary while she was drawing water.',
    youtubeId: null,
    emoji: '🏛',
    facts: ['19th century building', 'Ancient foundations', 'Active parish'],
  },
  {
    id: 'old-city',
    title: 'Old City Market',
    subtitle: 'The soul of ancient Nazareth',
    description: 'The vibrant market of Nazareth Old City, where artisans, spice sellers, and craftspeople carry on traditions thousands of years old. The narrow streets feel timeless.',
    youtubeId: null,
    emoji: '🕌',
    facts: ['Medieval architecture', 'Living heritage', 'Local artisans'],
  },
];

export default function TourPage() {
  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ py: { xs: 8, md: 12 }, background: 'linear-gradient(160deg, #1C0E06, #2C1810)', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.5rem' }, color: '#F7F2E8', mb: 1.5 }}>
            Virtual Tour of Nazareth
          </Typography>
          <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: 'rgba(247,242,232,0.7)', fontSize: '1.05rem', mb: 4, maxWidth: 480, mx: 'auto', lineHeight: 1.75 }}>
            Walk the streets where Jesus walked. Explore the holy sites of Nazareth from anywhere in the world.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="outlined"
              startIcon={<MapIcon />}
              sx={{
                borderColor: 'rgba(201,168,76,0.5)',
                color: '#C9A84C',
                fontFamily: 'Cinzel, serif',
                fontSize: '0.78rem',
                '&:hover': { borderColor: '#C9A84C', backgroundColor: 'rgba(201,168,76,0.08)' },
              }}
              href="https://maps.google.com/?q=Nazareth,Israel"
              target="_blank"
            >
              Open in Maps
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* Tour Stops */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Typography
          sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.3rem', color: colors.textPrimary, mb: 1, textAlign: 'center' }}
        >
          Sacred Sites of Nazareth
        </Typography>
        <Typography sx={{ color: colors.textSecondary, textAlign: 'center', mb: 5, fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
          Explore each holy site through our guided virtual tour
        </Typography>

        <Grid container spacing={4}>
          {TOUR_STOPS.map((stop, index) => (
            <Grid xs={12} md={6} key={stop.id}>
              <Paper
                elevation={1}
                sx={{
                  overflow: 'hidden',
                  border: '1px solid rgba(201,168,76,0.15)',
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': { boxShadow: '0 12px 40px rgba(28,18,8,0.12)', borderColor: 'rgba(201,168,76,0.3)' },
                }}
              >
                {/* Image/Video placeholder */}
                <Box
                  sx={{
                    aspectRatio: '16/9',
                    background: `linear-gradient(160deg, ${['#2C1810', '#1A1A2C', '#0D1A12', '#1A1209'][index % 4]} 0%, rgba(201,168,76,0.1) 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                >
                  <Typography sx={{ fontSize: '4rem' }}>{stop.emoji}</Typography>
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0,0,0,0.0)',
                      transition: 'background-color 0.3s',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.2)' },
                    }}
                  >
                    <PlayCircleOutlineIcon sx={{ fontSize: '3.5rem', color: 'rgba(247,242,232,0.6)', opacity: 0.7 }} />
                  </Box>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                    }}
                  >
                    <Chip
                      label={`Stop ${index + 1}`}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(201,168,76,0.9)',
                        color: '#1C1208',
                        fontFamily: 'Cinzel, serif',
                        fontWeight: 700,
                        fontSize: '0.65rem',
                        letterSpacing: '0.08em',
                      }}
                    />
                  </Box>
                </Box>

                <Box sx={{ p: 3 }}>
                  <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1rem', color: colors.textPrimary, mb: 0.5 }}>
                    {stop.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: colors.gold, fontFamily: 'Lato, sans-serif', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', mb: 1.5 }}>
                    {stop.subtitle}
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: colors.textSecondary, lineHeight: 1.75, mb: 2 }}>
                    {stop.description}
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }} sx={{ gap: 0.75 }}>
                    {stop.facts.map((fact) => (
                      <Chip
                        key={fact}
                        label={fact}
                        size="small"
                        sx={{
                          fontSize: '0.65rem',
                          backgroundColor: 'rgba(201,168,76,0.08)',
                          color: colors.textSecondary,
                          border: '1px solid rgba(201,168,76,0.2)',
                          fontFamily: 'Lato, sans-serif',
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Google Maps Embed */}
        <Box sx={{ mt: 8 }}>
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.1rem', color: colors.textPrimary, mb: 3, textAlign: 'center' }}>
            Nazareth on the Map
          </Typography>
          <Box
            sx={{
              borderRadius: 2,
              overflow: 'hidden',
              border: '1px solid rgba(201,168,76,0.2)',
              boxShadow: '0 4px 24px rgba(28,18,8,0.08)',
            }}
          >
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d13454.024889539!2d35.29082!3d32.70032!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x151c4b9d51d3d5b9%3A0x43e1c35dae553fb4!2sNazareth%2C%20Israel!5e0!3m2!1sen!2sus!4v1234567890"
              width="100%"
              height="400"
              style={{ border: 0, display: 'block' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Nazareth, Israel Map"
            />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
