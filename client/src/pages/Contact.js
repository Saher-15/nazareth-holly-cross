import React, { useState, useEffect } from 'react';
import { API_URL } from '../config.js';
import axios from 'axios';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import { alpha } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { gold, goldLight, goldDark, goldGradientText } from '../theme';

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: '#1C1208', fontSize: '0.9rem', borderRadius: '6px',
    backgroundColor: '#FFFFFF',
    '& fieldset': { borderColor: alpha(gold, 0.25) },
    '&:hover fieldset': { borderColor: alpha(gold, 0.5) },
    '&.Mui-focused fieldset': { borderColor: gold, boxShadow: `0 0 0 3px ${alpha(gold, 0.07)}` },
  },
  '& .MuiInputLabel-root': { color: '#9B7B6A', '&.Mui-focused': { color: goldDark } },
  '& .MuiInputBase-input': { caretColor: gold },
};

export default function Contact() {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', msg: '' });
  const [showSuccess, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.phone || !form.msg) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/contact/contact_us_request`, form);
      setForm({ fullName: '', email: '', phone: '', msg: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '80vh', py: { xs: 6, md: 10 }, px: { xs: 2, sm: 3 }, backgroundColor: '#F7F2E8' }}>
      <Container maxWidth="sm">

        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
            <Box sx={{
              width: 52, height: 52, borderRadius: '50%',
              border: `1px solid ${alpha(gold, 0.35)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: alpha(gold, 0.08),
            }}>
              <MailOutlineIcon sx={{ fontSize: '1.4rem', color: gold }} />
            </Box>
          </Box>
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.4rem' }, ...goldGradientText, mb: 1 }}>
            Contact Us
          </Typography>
          <Box sx={{ width: 56, height: '2px', mx: 'auto', background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
          <Typography sx={{ mt: 2, fontFamily: '"Lato", sans-serif', fontWeight: 400, fontSize: '0.88rem', color: '#9B7B6A' }}>
            We'd love to hear from you — reach out anytime
          </Typography>
        </Box>

        {/* Form */}
        <Paper
          elevation={0}
          component="form"
          onSubmit={handleSubmit}
          sx={{
            p: { xs: 3, md: 5 },
            backgroundColor: '#FFFFFF',
            border: `1px solid ${alpha(gold, 0.2)}`,
            borderRadius: '14px',
            position: 'relative',
            boxShadow: `0 8px 32px ${alpha('#8A6107', 0.1)}`,
            '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', borderRadius: '14px 14px 0 0', background: `linear-gradient(90deg, transparent, ${gold}, transparent)` },
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField fullWidth label="Full Name"     name="fullName" value={form.fullName} onChange={handleChange} required size="small" sx={inputSx} />
            <TextField fullWidth label="Email Address" name="email"    type="email" value={form.email} onChange={handleChange} required size="small" sx={inputSx} />
            <TextField fullWidth label="Phone Number"  name="phone"    value={form.phone} onChange={handleChange} required size="small" sx={inputSx} />
            <TextField fullWidth label="Message"       name="msg"      value={form.msg} onChange={handleChange} required multiline rows={5} sx={inputSx} />
          </Box>

          <Collapse in={showSuccess} sx={{ mt: 2 }}>
            <Alert
              severity="success"
              sx={{ background: alpha('#2E7D32', 0.1), border: `1px solid ${alpha('#4CAF50', 0.35)}`, color: '#1C1208', borderRadius: '8px', '& .MuiAlert-icon': { color: '#4CAF50' } }}
            >
              Message submitted successfully! We'll be in touch soon.
            </Alert>
          </Collapse>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            endIcon={<SendIcon />}
            disabled={loading}
            sx={{
              mt: 3, py: 1.6,
              background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
              color: '#FFFFFF', fontWeight: 700,
              boxShadow: `0 4px 20px ${alpha(gold, 0.35)}`,
              '&:hover': { background: `linear-gradient(135deg, #D4B060 0%, ${gold} 100%)`, boxShadow: `0 8px 30px ${alpha(gold, 0.5)}`, transform: 'translateY(-2px)' },
              '&.Mui-disabled': { background: alpha(gold, 0.25), color: alpha('#1C1208', 0.4) },
            }}
          >
            {loading ? 'Sending…' : 'Send Message'}
          </Button>
        </Paper>

        {/* Info cards */}
        <Box sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {[
            { icon: '✉', label: 'Email', value: 'nazarethholycross@gmail.com', href: 'mailto:nazarethholycross@gmail.com' },
            { icon: '📍', label: 'Location', value: 'Nazareth, Holy Land', href: null },
          ].map(({ icon, label, value, href }) => (
            <Box
              key={label}
              component={href ? 'a' : 'div'}
              href={href}
              sx={{
                flex: 1, minWidth: 140,
                p: 2, borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                border: `1px solid ${alpha(gold, 0.25)}`,
                textDecoration: 'none',
                boxShadow: `0 2px 12px ${alpha('#8A6107', 0.07)}`,
                transition: 'all 0.25s ease',
                '&:hover': { borderColor: alpha(gold, 0.5), boxShadow: `0 6px 20px ${alpha('#8A6107', 0.13)}` },
              }}
            >
              <Box sx={{ fontSize: '1.2rem', mb: 0.5 }}>{icon}</Box>
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.6rem', letterSpacing: '0.18em', color: goldDark, textTransform: 'uppercase', mb: 0.4 }}>
                {label}
              </Typography>
              <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 400, fontSize: '0.78rem', color: '#5D3E2C' }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
