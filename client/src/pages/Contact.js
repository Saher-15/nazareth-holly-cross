import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import RoomIcon from '@mui/icons-material/Room';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import api from '../api';
import { gold, goldDark, crimson, textSecondary, goldGradientText } from '../theme';

export default function Contact() {
  const [form,    setForm]    = useState({ fullName: '', email: '', phone: '', msg: '' });
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.msg) return;
    setLoading(true);
    try {
      await api.post('/contact/contact_us_request', form);
      setForm({ fullName: '', email: '', phone: '', msg: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const contactInfo = [
    { icon: <RoomIcon sx={{ color: gold, fontSize: '1.2rem' }} />, label: 'Address', value: 'Nazareth, Israel — The Holy Land' },
    { icon: <MailOutlineIcon sx={{ color: gold, fontSize: '1.2rem' }} />, label: 'Email', value: 'nazarethholycross@gmail.com', href: 'mailto:nazarethholycross@gmail.com' },
    { icon: <AccessTimeIcon sx={{ color: gold, fontSize: '1.2rem' }} />, label: 'Response Time', value: 'Within 24 hours of your message' },
  ];

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
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: alpha(gold, 0.7), textTransform: 'uppercase', mb: 2 }}>
            Reach Out
          </Typography>
          <Typography variant="h1" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '2rem', md: '3rem' }, ...goldGradientText }}>
            Contact Us
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mt: 3 }}>
            <Box sx={{ width: 60, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.6)})` }} />
            <Box sx={{ fontSize: '1rem', color: alpha(crimson, 0.8) }}>✝</Box>
            <Box sx={{ width: 60, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.6)}, transparent)` }} />
          </Box>
        </Box>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        <Grid container spacing={{ xs: 4, md: 6 }} alignItems="flex-start">
          {/* Contact Info */}
          <Grid item xs={12} md={4}>
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1rem', color: '#1C1208', mb: 3, letterSpacing: '0.05em' }}>
              Get in Touch
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
              {contactInfo.map(({ icon, label, value, href }) => (
                <Box key={label} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box sx={{ pt: 0.3 }}>{icon}</Box>
                  <Box>
                    <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.68rem', letterSpacing: '0.18em', color: goldDark, mb: 0.4, textTransform: 'uppercase' }}>
                      {label}
                    </Typography>
                    {href ? (
                      <Typography component="a" href={href} sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.88rem', color: textSecondary, textDecoration: 'none', '&:hover': { color: goldDark } }}>
                        {value}
                      </Typography>
                    ) : (
                      <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.88rem', color: textSecondary }}>
                        {value}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ borderRadius: '12px', overflow: 'hidden', border: `1px solid ${alpha(gold, 0.2)}` }}>
              <iframe
                title="Nazareth Map"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d13408.678!2d35.2952!3d32.7021!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x151c4c7cd5e6d2a3%3A0x37b2d4daa9a20b2f!2sNazareth!5e0!3m2!1sen!2sil!4v1"
                width="100%"
                height="220"
                style={{ border: 0, display: 'block' }}
                allowFullScreen=""
                loading="lazy"
              />
            </Box>
          </Grid>

          {/* Form */}
          <Grid item xs={12} md={8}>
            <Paper
              elevation={0}
              component="form"
              onSubmit={handleSubmit}
              sx={{
                p: { xs: 3, md: 4 }, borderRadius: '12px',
                border: `1px solid ${alpha(gold, 0.2)}`,
                boxShadow: `0 8px 32px ${alpha('#8A6107', 0.1)}`,
                position: 'relative',
                '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, borderRadius: '12px 12px 0 0' },
              }}
            >
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1rem', color: '#1C1208', mb: 3, letterSpacing: '0.05em' }}>
                Send a Message
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Full Name" name="fullName" value={form.fullName} onChange={handleChange} required size="small" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Email Address" type="email" name="email" value={form.email} onChange={handleChange} required size="small" />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Phone (optional)" name="phone" value={form.phone} onChange={handleChange} size="small" />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Your Message" name="msg" value={form.msg} onChange={handleChange} required multiline rows={5} />
                </Grid>
              </Grid>
              <Collapse in={success}>
                <Alert severity="success" sx={{ mt: 2 }}>
                  Thank you! Your message has been received. We will respond within 24 hours.
                </Alert>
              </Collapse>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
                sx={{
                  mt: 3, background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                  color: '#1C1208', py: 1.4,
                  '&:hover': { boxShadow: `0 8px 24px ${alpha(gold, 0.5)}`, transform: 'translateY(-2px)' },
                  '&.Mui-disabled': { background: alpha(gold, 0.25) },
                }}
              >
                {loading ? 'Sending...' : 'Send Message'}
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
