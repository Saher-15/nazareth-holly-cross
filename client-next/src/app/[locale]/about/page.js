'use client';
import React from 'react';
import {
  Box, Container, Grid, Typography, Paper, Stack, Divider,
} from '@mui/material';
import { colors } from '@/lib/theme';

export default function AboutPage() {
  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ py: { xs: 8, md: 12 }, background: 'linear-gradient(160deg, #1C0E06, #2C1810)', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.5rem' }, color: '#F7F2E8', mb: 1.5 }}>
            About Nazareth Holy Cross
          </Typography>
          <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: 'rgba(247,242,232,0.7)', fontSize: '1.05rem' }}>
            A ministry rooted in faith, serving the world from Nazareth
          </Typography>
          <Box sx={{ width: 60, height: 3, background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', mx: 'auto', mt: 2 }} />
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        {/* Mission */}
        <Grid container spacing={6} alignItems="center" sx={{ mb: 8 }}>
          <Grid xs={12} md={6}>
            <Typography sx={{ fontFamily: 'Lato, sans-serif', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: colors.gold, mb: 1.5 }}>
              Our Mission
            </Typography>
            <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.4rem', md: '1.8rem' }, color: colors.textPrimary, mb: 2.5, lineHeight: 1.3 }}>
              The Heart of Christian Faith
            </Typography>
            <Typography sx={{ color: colors.textSecondary, lineHeight: 1.85, mb: 2, fontSize: '0.92rem' }}>
              The heart of Christian faith beats in Nazareth. We understand that not everyone can physically visit Nazareth — a city where Jesus grew and where spiritual experiences await every visitor. Therefore, we are pleased to offer you the opportunity to bring Nazareth to you.
            </Typography>
            <Typography sx={{ color: colors.textSecondary, lineHeight: 1.85, mb: 2, fontSize: '0.92rem' }}>
              Through our website, you can take a virtual tour of the main churches and holy sites of Nazareth, connect to the rich history and religious tradition that characterizes the place.
            </Typography>
            <Typography sx={{ color: colors.textSecondary, lineHeight: 1.85, fontSize: '0.92rem' }}>
              We invite you to open your hearts and feel the warmth of our community through every product you choose to buy. Every purchase supports the local community and helps preserve the rich heritage of Nazareth for future generations.
            </Typography>
          </Grid>
          <Grid xs={12} md={6}>
            <Box
              sx={{
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: '0 16px 60px rgba(28,18,8,0.15)',
                aspectRatio: '4/3',
                background: 'linear-gradient(160deg, #2C1810 0%, #8A6107 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '8rem',
                color: 'rgba(201,168,76,0.25)',
              }}
            >
              ✝
            </Box>
          </Grid>
        </Grid>

        {/* Bible Quotes */}
        <Box sx={{ mb: 8 }}>
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.2rem', textAlign: 'center', color: colors.textPrimary, mb: 4 }}>
            Biblical References to Nazareth
          </Typography>
          <Grid container spacing={3}>
            {[
              { ref: 'Matthew 2:23', text: '"And he came and dwelt in a city called Nazareth, that it might be fulfilled which was spoken by the prophets, \'He shall be called a Nazarene.\'"' },
              { ref: 'Luke 1:26-27', text: '"Now in the sixth month, the angel Gabriel was sent by God to a city of Galilee named Nazareth, to a virgin betrothed to a man whose name was Joseph..."' },
              { ref: 'John 1:46', text: '"And Nathanael said to him, \'Can anything good come out of Nazareth?\' Philip said to him, \'Come and see.\'"' },
              { ref: 'Luke 4:16', text: '"So He came to Nazareth, where He had been brought up. And as His custom was, He went into the synagogue on the Sabbath day, and stood up to read."' },
            ].map(({ ref, text }) => (
              <Grid xs={12} sm={6} key={ref}>
                <Paper
                  elevation={1}
                  sx={{
                    p: 3,
                    height: '100%',
                    border: '1px solid rgba(201,168,76,0.15)',
                    borderLeft: `4px solid ${colors.gold}`,
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': { boxShadow: '0 8px 24px rgba(28,18,8,0.08)', borderColor: 'rgba(201,168,76,0.3)' },
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: 'Lato, sans-serif',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: colors.gold,
                      mb: 1.5,
                    }}
                  >
                    {ref}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: 'Playfair Display, serif',
                      fontStyle: 'italic',
                      color: colors.textSecondary,
                      fontSize: '0.88rem',
                      lineHeight: 1.8,
                    }}
                  >
                    {text}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Values */}
        <Box sx={{ py: 6, px: { xs: 0, md: 4 }, borderRadius: 3, background: 'linear-gradient(135deg, rgba(201,168,76,0.06), rgba(139,26,26,0.06))', border: '1px solid rgba(201,168,76,0.15)' }}>
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.2rem', textAlign: 'center', color: colors.textPrimary, mb: 4 }}>
            Our Values
          </Typography>
          <Grid container spacing={3}>
            {[
              { icon: '🙏', title: 'Faith', desc: 'Rooted in the Christian faith of Nazareth, we serve believers of all denominations with reverence and love.' },
              { icon: '✝', title: 'Authenticity', desc: 'Every product comes directly from Nazareth. Every candle is lit by real hands in real holy places.' },
              { icon: '🌍', title: 'Community', desc: 'We connect faithful hearts around the world with the holy city, building a global community of believers.' },
              { icon: '💝', title: 'Service', desc: 'We exist to serve — our local community in Nazareth, and the faithful who cannot visit but long to connect.' },
            ].map(({ icon, title, desc }) => (
              <Grid xs={12} sm={6} md={3} key={title}>
                <Box sx={{ textAlign: 'center', px: 2 }}>
                  <Typography sx={{ fontSize: '2.5rem', mb: 1.5 }}>{icon}</Typography>
                  <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.95rem', color: colors.textPrimary, mb: 1 }}>{title}</Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: colors.textSecondary, lineHeight: 1.7 }}>{desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}
