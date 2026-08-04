import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import StarIcon from '@mui/icons-material/Star';
import ForumIcon from '@mui/icons-material/Forum';
import PersonIcon from '@mui/icons-material/Person';
import PublicIcon from '@mui/icons-material/Public';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { gold, goldDark, crimson, textSecondary, goldGradientText } from '../theme';

function StarRating({ count = 5 }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.25 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon key={i} sx={{ fontSize: '0.9rem', color: i < count ? gold : alpha(gold, 0.2) }} />
      ))}
    </Box>
  );
}

export default function Reviews() {
  const { t } = useTranslation();
  const [formData,    setFormData]    = useState({ fullName: '', email: '', phone: '000', msg: '' });
  const [messages,    setMessages]    = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading,     setLoading]     = useState(false);

  const fetchMessages = async () => {
    try {
      const { data } = await api.get('/review/getReviews');
      setMessages(Array.isArray(data) ? data : []);
    } catch { setMessages([]); }
  };

  useEffect(() => { fetchMessages(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.msg) return;
    setLoading(true);
    try {
      await api.post('/review/addReview', formData);
      setFormData({ fullName: '', email: '', phone: '000', msg: '' });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
      fetchMessages();
    } catch { /* ignore */ } finally { setLoading(false); }
  };

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
            Testimonials
          </Typography>
          <Typography variant="h1" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '2rem', md: '3rem' }, ...goldGradientText }}>
            Reviews & Testimonials
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        <Grid container spacing={{ xs: 4, md: 6 }}>
          {/* Review Form */}
          <Grid item xs={12} md={4}>
            <Paper
              elevation={0}
              component="form"
              onSubmit={handleSubmit}
              sx={{
                p: { xs: 3, md: 4 }, borderRadius: '12px',
                border: `1px solid ${alpha(gold, 0.2)}`,
                boxShadow: `0 4px 24px ${alpha('#8A6107', 0.1)}`,
                position: { md: 'sticky' }, top: { md: 90 },
                '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, borderRadius: '12px 12px 0 0' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <ForumIcon sx={{ color: gold, fontSize: '1.4rem' }} />
                <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '0.9rem', color: '#1C1208', letterSpacing: '0.05em' }}>
                  Leave a Review
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField fullWidth label="Full Name" name="fullName" value={formData.fullName} onChange={handleChange} required size="small" InputProps={{ startAdornment: <PersonIcon sx={{ fontSize: '1rem', color: alpha(goldDark, 0.5), mr: 0.5 }} /> }} />
                <TextField fullWidth label="Email" type="email" name="email" value={formData.email} onChange={handleChange} required size="small" />
                <TextField fullWidth label="Country (optional)" name="phone" value={formData.phone === '000' ? '' : formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value || '000' }))} size="small" InputProps={{ startAdornment: <PublicIcon sx={{ fontSize: '1rem', color: alpha(goldDark, 0.5), mr: 0.5 }} /> }} />
                <TextField fullWidth label="Your Review" name="msg" value={formData.msg} onChange={handleChange} required multiline rows={4} />
              </Box>
              <Collapse in={showSuccess}>
                <Alert severity="success" sx={{ mt: 2 }}>Thank you for your review!</Alert>
              </Collapse>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
                startIcon={<SendIcon />}
                sx={{
                  mt: 3, background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                  color: '#1C1208', py: 1.3,
                  '&:hover': { boxShadow: `0 6px 20px ${alpha(gold, 0.45)}`, transform: 'translateY(-2px)' },
                }}
              >
                {loading ? 'Submitting...' : 'Submit Review'}
              </Button>
            </Paper>
          </Grid>

          {/* Reviews list */}
          <Grid item xs={12} md={8}>
            {messages.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Box sx={{ fontSize: '3rem', mb: 2 }}>✝</Box>
                <Typography sx={{ fontFamily: '"Cinzel", serif', color: goldDark, fontSize: '1rem' }}>
                  Be the first to share your experience
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {messages.map((msg, i) => (
                  <Box
                    key={i}
                    sx={{
                      p: { xs: 3, md: 4 }, backgroundColor: '#FFFFFF', borderRadius: '12px',
                      border: `1px solid ${alpha(gold, 0.18)}`, boxShadow: `0 2px 12px ${alpha('#8A6107', 0.06)}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box>
                        <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '0.88rem', color: '#1C1208', mb: 0.4 }}>
                          {msg.fullName || 'Anonymous'}
                        </Typography>
                        {msg.phone && msg.phone !== '000' && (
                          <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.75rem', color: alpha(goldDark, 0.6), display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PublicIcon sx={{ fontSize: '0.75rem' }} />{msg.phone}
                          </Typography>
                        )}
                      </Box>
                      <StarRating count={5} />
                    </Box>
                    <Divider sx={{ mb: 2, borderColor: alpha(gold, 0.12) }} />
                    <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: '0.9rem', color: textSecondary, lineHeight: 1.85 }}>
                      "{msg.msg}"
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
