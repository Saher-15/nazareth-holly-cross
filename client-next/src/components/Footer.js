'use client';
import React, { useState } from 'react';
import {
  Box, Container, Grid, Typography, TextField, Button,
  IconButton, Stack, Divider, Link as MuiLink, Snackbar, Alert,
} from '@mui/material';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { colors } from '@/lib/theme';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import YouTubeIcon from '@mui/icons-material/YouTube';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import api from '@/lib/api';

export default function Footer() {
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState(false);

  const handleNewsletter = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/contact/newsletter', { email });
      setSubscribed(true);
      setEmail('');
    } catch (err) {
      setError(true);
    }
  };

  const footerLinks = {
    Pages: [
      { label: 'Home', href: '/' },
      { label: 'Shop', href: '/shop' },
      { label: 'Light a Candle', href: '/candle' },
      { label: 'Virtual Tour', href: '/tour' },
      { label: 'Reviews', href: '/reviews' },
      { label: 'Live Stream', href: '/live' },
    ],
    Gallery: [
      { label: 'Latin Church', href: '/gallery/latin' },
      { label: 'Greek Church', href: '/gallery/greek' },
      { label: "Mary's Well", href: '/gallery/maryswell' },
      { label: 'Old City', href: '/gallery/old-city' },
      { label: 'Nazareth', href: '/gallery/nazareth' },
    ],
    Info: [
      { label: 'Contact Us', href: '/contact' },
      { label: 'Prayer Wall', href: '/prayer-wall' },
      { label: 'Donate', href: '/donation' },
    ],
  };

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: '#1C1208',
        color: '#F7F2E8',
        pt: 8,
        pb: 4,
        borderTop: '2px solid rgba(201,168,76,0.3)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9A84C' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          pointerEvents: 'none',
        },
      }}
    >
      {/* CTA Banner */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, rgba(201,168,76,0.15) 0%, rgba(139,26,26,0.15) 100%)',
          border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: 2,
          p: { xs: 3, md: 4 },
          mb: 6,
          mx: { xs: 2, md: 4 },
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Typography
          variant="h4"
          sx={{ fontFamily: 'Cinzel, serif', fontStyle: 'normal', color: '#C9A84C', mb: 1, fontSize: { xs: '1.2rem', md: '1.5rem' } }}
        >
          Light a Candle from Anywhere in the World
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(247,242,232,0.7)', mb: 3, maxWidth: 500, mx: 'auto' }}>
          Connect with the holy sites of Nazareth through prayer and candlelight, no matter where you are.
        </Typography>
        <Button
          component={Link}
          href={`/${locale}/candle`}
          variant="contained"
          sx={{
            background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
            color: '#1C1208',
            fontFamily: 'Cinzel, serif',
            px: 4,
            '&:hover': { background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' },
          }}
        >
          Light a Candle
        </Button>
      </Box>

      <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
        <Grid container spacing={4}>
          {/* Brand Column */}
          <Grid xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  color: '#1C1208',
                  flexShrink: 0,
                }}
              >
                ✝
              </Box>
              <Box>
                <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#F7F2E8', lineHeight: 1.2 }}>
                  Nazareth Holy Cross
                </Typography>
                <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: '0.7rem', color: 'rgba(247,242,232,0.5)' }}>
                  Sacred Ministry
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(247,242,232,0.6)', lineHeight: 1.8, mb: 3, fontSize: '0.85rem' }}>
              Bringing the holy city of Nazareth to faithful hearts around the world. Sacred goods, candle prayers, and live connections from the land where Jesus walked.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <LocationOnIcon sx={{ fontSize: '0.9rem', color: '#C9A84C' }} />
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(247,242,232,0.5)' }}>Nazareth, Israel</Typography>
              </Stack>
            </Stack>
            <Stack direction="row" spacing={1}>
              {[
                { icon: <FacebookIcon />, href: '#', label: 'Facebook' },
                { icon: <InstagramIcon />, href: '#', label: 'Instagram' },
                { icon: <YouTubeIcon />, href: '#', label: 'YouTube' },
              ].map(({ icon, href, label }) => (
                <IconButton
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  aria-label={label}
                  sx={{
                    color: 'rgba(247,242,232,0.5)',
                    border: '1px solid rgba(201,168,76,0.2)',
                    '&:hover': { color: '#C9A84C', borderColor: '#C9A84C', backgroundColor: 'rgba(201,168,76,0.1)' },
                  }}
                >
                  {icon}
                </IconButton>
              ))}
            </Stack>
          </Grid>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <Grid xs={6} sm={4} md={2} key={title}>
              <Typography
                sx={{
                  fontFamily: 'Cinzel, serif',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  letterSpacing: '0.12em',
                  color: '#C9A84C',
                  textTransform: 'uppercase',
                  mb: 2,
                }}
              >
                {title}
              </Typography>
              <Stack spacing={0.75}>
                {links.map((link) => (
                  <MuiLink
                    key={link.href}
                    component={Link}
                    href={`/${locale}${link.href === '/' ? '' : link.href}`}
                    sx={{
                      color: 'rgba(247,242,232,0.6)',
                      textDecoration: 'none',
                      fontSize: '0.82rem',
                      fontFamily: 'Lato, sans-serif',
                      transition: 'color 0.2s',
                      '&:hover': { color: '#C9A84C' },
                    }}
                  >
                    {link.label}
                  </MuiLink>
                ))}
              </Stack>
            </Grid>
          ))}

          {/* Newsletter */}
          <Grid xs={12} md={2}>
            <Typography
              sx={{
                fontFamily: 'Cinzel, serif',
                fontWeight: 700,
                fontSize: '0.75rem',
                letterSpacing: '0.12em',
                color: '#C9A84C',
                textTransform: 'uppercase',
                mb: 2,
              }}
            >
              Newsletter
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(247,242,232,0.6)', mb: 2, lineHeight: 1.6 }}>
              Receive blessings and updates from Nazareth.
            </Typography>
            <Box component="form" onSubmit={handleNewsletter}>
              <TextField
                fullWidth
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                size="small"
                sx={{
                  mb: 1.5,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(247,242,232,0.05)',
                    color: '#F7F2E8',
                    fontSize: '0.82rem',
                    '& fieldset': { borderColor: 'rgba(201,168,76,0.3)' },
                    '&:hover fieldset': { borderColor: '#C9A84C' },
                    '&.Mui-focused fieldset': { borderColor: '#C9A84C' },
                  },
                  '& .MuiInputBase-input::placeholder': { color: 'rgba(247,242,232,0.3)' },
                }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="small"
                startIcon={<EmailIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
                  color: '#1C1208',
                  fontFamily: 'Cinzel, serif',
                  fontSize: '0.7rem',
                  '&:hover': { background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' },
                }}
              >
                Subscribe
              </Button>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ borderColor: 'rgba(201,168,76,0.15)', my: 4 }} />

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'rgba(247,242,232,0.4)', textAlign: { xs: 'center', md: 'left' } }}>
            © {new Date().getFullYear()} Nazareth Holy Cross. All rights reserved. Made with ✝ in Nazareth.
          </Typography>
          <Stack direction="row" spacing={3}>
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((item) => (
              <Typography
                key={item}
                sx={{ fontSize: '0.72rem', color: 'rgba(247,242,232,0.3)', cursor: 'pointer', '&:hover': { color: '#C9A84C' } }}
              >
                {item}
              </Typography>
            ))}
          </Stack>
        </Box>
      </Container>

      <Snackbar open={subscribed} autoHideDuration={4000} onClose={() => setSubscribed(false)}>
        <Alert severity="success" onClose={() => setSubscribed(false)}>
          Thank you for subscribing! Blessings from Nazareth.
        </Alert>
      </Snackbar>
      <Snackbar open={error} autoHideDuration={4000} onClose={() => setError(false)}>
        <Alert severity="error" onClose={() => setError(false)}>
          Subscription failed. Please try again.
        </Alert>
      </Snackbar>
    </Box>
  );
}
