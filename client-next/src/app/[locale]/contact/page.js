'use client';
import React, { useState } from 'react';
import {
  Box, Container, Grid, Typography, TextField, Button,
  Paper, Stack, Divider, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SendIcon from '@mui/icons-material/Send';
import { colors } from '@/lib/theme';
import api from '@/lib/api';

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/contact', formData);
      setSuccess(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ py: { xs: 6, md: 10 }, background: 'linear-gradient(160deg, #1C0E06, #2C1810)', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.5rem' }, color: '#F7F2E8', mb: 1.5 }}>
            Contact Us
          </Typography>
          <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: 'rgba(247,242,232,0.7)', fontSize: '1.05rem' }}>
            We are here to serve you from Nazareth
          </Typography>
          <Box sx={{ width: 60, height: 3, background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', mx: 'auto', mt: 2 }} />
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Grid container spacing={5}>
          {/* Contact Info */}
          <Grid xs={12} md={4}>
            <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.1rem', color: colors.textPrimary, mb: 3 }}>
              Get in Touch
            </Typography>
            <Stack spacing={3}>
              {[
                {
                  icon: <EmailIcon sx={{ color: colors.gold }} />,
                  title: 'Email',
                  value: 'info@nazarethhc.com',
                  href: 'mailto:info@nazarethhc.com',
                },
                {
                  icon: <WhatsAppIcon sx={{ color: '#25D366' }} />,
                  title: 'WhatsApp',
                  value: '+972 50-000-0000',
                  href: 'https://wa.me/972500000000',
                },
                {
                  icon: <LocationOnIcon sx={{ color: colors.crimson }} />,
                  title: 'Location',
                  value: 'Nazareth, Israel',
                  href: null,
                },
              ].map(({ icon, title, value, href }) => (
                <Box key={title} sx={{ display: 'flex', gap: 2 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {icon}
                  </Box>
                  <Box>
                    <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted, mb: 0.25 }}>
                      {title}
                    </Typography>
                    {href ? (
                      <Typography
                        component="a"
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ color: colors.goldDark, fontSize: '0.9rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {value}
                      </Typography>
                    ) : (
                      <Typography sx={{ color: colors.textSecondary, fontSize: '0.9rem' }}>{value}</Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Stack>

            <Divider sx={{ my: 4 }} />

            <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.85rem', color: colors.textPrimary, mb: 1.5 }}>
              Office Hours
            </Typography>
            {[
              { day: 'Sunday – Thursday', hours: '9:00 AM – 6:00 PM' },
              { day: 'Friday', hours: '9:00 AM – 2:00 PM' },
              { day: 'Saturday', hours: 'Closed' },
            ].map(({ day, hours }) => (
              <Box key={day} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: '0.82rem', color: colors.textSecondary }}>{day}</Typography>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: colors.textPrimary }}>{hours}</Typography>
              </Box>
            ))}
            <Typography sx={{ fontSize: '0.72rem', color: colors.textMuted, mt: 1, fontStyle: 'italic' }}>
              All times are Israel Standard Time (IST)
            </Typography>
          </Grid>

          {/* Contact Form */}
          <Grid xs={12} md={8}>
            <Paper elevation={2} sx={{ p: { xs: 3, md: 4 }, border: '1px solid rgba(201,168,76,0.15)', borderRadius: 2 }}>
              <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.1rem', color: colors.textPrimary, mb: 3 }}>
                Send a Message
              </Typography>
              <Box component="form" onSubmit={handleSubmit}>
                <Grid container spacing={2.5}>
                  <Grid xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Your Name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </Grid>
                  <Grid xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </Grid>
                  <Grid xs={12}>
                    <TextField
                      fullWidth
                      label="Subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                    />
                  </Grid>
                  <Grid xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={6}
                      label="Message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      placeholder="How can we help you?"
                    />
                  </Grid>
                  <Grid xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={loading}
                      startIcon={loading ? <CircularProgress size={18} /> : <SendIcon />}
                      sx={{
                        background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
                        color: '#1C1208',
                        fontFamily: 'Cinzel, serif',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        px: 5,
                        py: 1.75,
                        '&:hover': { background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' },
                        '&:disabled': { background: colors.surface, color: colors.textMuted },
                      }}
                    >
                      {loading ? 'Sending...' : 'Send Message'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      <Snackbar open={success} autoHideDuration={5000} onClose={() => setSuccess(false)}>
        <Alert severity="success">Your message has been sent! We will respond within 24 hours.</Alert>
      </Snackbar>
      <Snackbar open={error} autoHideDuration={4000} onClose={() => setError(false)}>
        <Alert severity="error">Failed to send message. Please try again or contact us via WhatsApp.</Alert>
      </Snackbar>
    </Box>
  );
}
