import React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { gold, goldDark, crimson, textSecondary, goldGradientText } from '../theme';

const BIBLE_QUOTES = [
  { ref: 'Matthew 2:23', text: '"He came and dwelt in a city called Nazareth, that it might be fulfilled which was spoken by the prophets, He shall be called a Nazarene."' },
  { ref: 'Luke 1:26-27', text: '"The angel Gabriel was sent by God to a city of Galilee named Nazareth, to a virgin betrothed to a man whose name was Joseph."' },
  { ref: 'John 1:46',    text: '"Can anything good come out of Nazareth? Come and see."' },
  { ref: 'Luke 4:16',    text: '"He came to Nazareth, where He had been brought up. As His custom was, He went into the synagogue on the Sabbath day."' },
];

const VALUES = [
  { icon: '✝', title: 'Faith',         desc: 'Rooted in the Christian tradition of Nazareth, every service we offer is a bridge between you and the Holy Land.' },
  { icon: '🕊', title: 'Authenticity', desc: 'Our products and services are sourced locally from artisans and clergy in the Holy City.' },
  { icon: '🌍', title: 'Community',    desc: 'We connect believers from every corner of the world to the heartbeat of Christianity.' },
  { icon: '🙏', title: 'Service',      desc: 'Every candle lit, every prayer delivered, every product shipped — a service of love from Nazareth to you.' },
];

export default function About() {
  const { t } = useTranslation();

  return (
    <Box sx={{ backgroundColor: '#F7F2E8', minHeight: '80vh' }}>
      {/* Page Header */}
      <Box sx={{
        position: 'relative', py: { xs: 10, md: 14 },
        background: 'linear-gradient(160deg, #1C0E06 0%, #2C1810 50%, #1C0E06 100%)',
        textAlign: 'center', overflow: 'hidden',
        '&::after': { content: '""', position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', background: 'linear-gradient(to bottom, transparent, #F7F2E8)' },
      }}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: alpha(gold, 0.7), textTransform: 'uppercase', mb: 2 }}>
            Who We Are
          </Typography>
          <Typography variant="h1" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '2rem', md: '3rem' }, ...goldGradientText, mb: 2 }}>
            About Nazareth Holy Cross
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mt: 2 }}>
            <Box sx={{ width: 60, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.6)})` }} />
            <Box sx={{ fontSize: '1rem', color: alpha(crimson, 0.8) }}>✝</Box>
            <Box sx={{ width: 60, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.6)}, transparent)` }} />
          </Box>
        </Box>
      </Box>

      {/* Mission */}
      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: alpha(goldDark, 0.7), textTransform: 'uppercase', mb: 2 }}>
              Our Mission
            </Typography>
            <Typography variant="h2" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.6rem', md: '2.2rem' }, ...goldGradientText, mb: 3 }}>
              {t('about.title')}
            </Typography>
            {['about.description1', 'about.description2', 'about.description3'].map((key) => (
              <Typography key={key} sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.9rem', color: textSecondary, lineHeight: 1.9, mb: 2 }}>
                {t(key)}
              </Typography>
            ))}
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{
              p: { xs: 3, md: 5 }, backgroundColor: '#1C0E06', borderRadius: '12px',
              border: `1px solid ${alpha(gold, 0.2)}`, textAlign: 'center', position: 'relative',
              '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, borderRadius: '12px 12px 0 0' },
            }}>
              <Box sx={{ fontSize: '5rem', mb: 2 }}>✝</Box>
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.2rem', md: '1.6rem' }, ...goldGradientText, mb: 1 }}>NAZARETH</Typography>
              <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', color: alpha('#F7F2E8', 0.55), fontSize: '0.9rem' }}>The City of Jesus</Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* Bible Quotes */}
      <Box sx={{ py: { xs: 7, md: 10 }, backgroundColor: '#EDE6D4' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: alpha(goldDark, 0.7), textTransform: 'uppercase', mb: 1.5 }}>
              Scripture
            </Typography>
            <Typography variant="h2" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.6rem', md: '2.2rem' }, ...goldGradientText }}>
              Biblical References to Nazareth
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {BIBLE_QUOTES.map((q) => (
              <Grid item xs={12} md={6} key={q.ref}>
                <Box sx={{
                  p: { xs: 3, md: 4 }, backgroundColor: '#FFFFFF', borderRadius: '12px',
                  border: `1px solid ${alpha(gold, 0.2)}`, boxShadow: `0 2px 16px ${alpha('#8A6107', 0.06)}`,
                  height: '100%', position: 'relative',
                  '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, borderRadius: '12px 12px 0 0' },
                }}>
                  <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: '0.95rem', color: textSecondary, lineHeight: 1.85, mb: 2 }}>
                    {q.text}
                  </Typography>
                  <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.15em', color: goldDark }}>
                    — {q.ref}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Values */}
      <Box sx={{ py: { xs: 7, md: 10 }, backgroundColor: '#F7F2E8' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
            <Typography variant="h2" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.6rem', md: '2.2rem' }, ...goldGradientText }}>
              Our Values
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {VALUES.map((v) => (
              <Grid item xs={12} sm={6} md={3} key={v.title}>
                <Box sx={{
                  textAlign: 'center', p: { xs: 3, md: 4 }, height: '100%',
                  backgroundColor: '#FFFFFF', borderRadius: '12px',
                  border: `1px solid ${alpha(gold, 0.18)}`, boxShadow: `0 2px 16px ${alpha('#8A6107', 0.06)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': { transform: 'translateY(-6px)', boxShadow: `0 8px 32px ${alpha('#8A6107', 0.14)}`, borderColor: alpha(gold, 0.4) },
                }}>
                  <Box sx={{ fontSize: '2.5rem', mb: 2 }}>{v.icon}</Box>
                  <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '0.9rem', color: '#1C1208', mb: 1.5, letterSpacing: '0.08em' }}>{v.title}</Typography>
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.83rem', color: textSecondary, lineHeight: 1.8 }}>{v.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
