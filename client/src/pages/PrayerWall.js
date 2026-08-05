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
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import { alpha } from '@mui/material/styles';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import PublicIcon from '@mui/icons-material/Public';
import SendIcon from '@mui/icons-material/Send';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import api from '../api';
import { gold, goldDark, crimson, textSecondary, goldGradientText } from '../theme';

const CATEGORIES = ['All', 'Peace', 'Health', 'Gratitude', 'Family', 'Personal', 'World Peace'];

export default function PrayerWall() {
  const [prayers,       setPrayers]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [submitting,    setSubmitting]    = useState(false);
  const [success,       setSuccess]       = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [likedIds,      setLikedIds]      = useState(() => {
    try { return JSON.parse(localStorage.getItem('nhc_liked_prayers') || '[]'); } catch { return []; }
  });

  const [form, setForm] = useState({
    fullName: '', country: '', category: 'Personal', prayer: '',
  });

  const fetchPrayers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/prayer/getPrayers');
      setPrayers(Array.isArray(data) ? data : data.prayers || []);
    } catch { setPrayers([]); } finally { setLoading(false); }
  };

  useEffect(() => { fetchPrayers(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.prayer) return;
    setSubmitting(true);
    try {
      await api.post('/prayer/create', form);
      setForm({ fullName: '', country: '', category: 'Personal', prayer: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      fetchPrayers();
    } catch { /* ignore */ } finally { setSubmitting(false); }
  };

  const handleLike = async (id) => {
    if (likedIds.includes(id)) return;
    try {
      await api.post(`/prayer/like/${id}`);
      const updated = [...likedIds, id];
      setLikedIds(updated);
      localStorage.setItem('nhc_liked_prayers', JSON.stringify(updated));
      setPrayers(prev => prev.map(p => p._id === id ? { ...p, likes: (p.likes || 0) + 1 } : p));
    } catch { /* ignore */ }
  };

  const filtered = activeCategory === 'All' ? prayers : prayers.filter(p => p.category === activeCategory);

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
          <SelfImprovementIcon sx={{ color: gold, fontSize: '2rem', mb: 1, display: 'block', mx: 'auto' }} />
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: alpha(gold, 0.7), textTransform: 'uppercase', mb: 2 }}>
            Community
          </Typography>
          <Typography variant="h1" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '3rem' }, ...goldGradientText, mb: 2 }}>
            Prayer Wall
          </Typography>
          <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', color: alpha('#F7F2E8', 0.65), fontSize: '0.95rem', maxWidth: 480, mx: 'auto', px: 3 }}>
            Voices from Around the World — your prayers, carried from here to the Holy Land
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        <Grid container spacing={{ xs: 4, md: 6 }}>
          {/* Submit form */}
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
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '0.9rem', color: '#1C1208', mb: 3, letterSpacing: '0.05em' }}>
                Share a Prayer
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField fullWidth label="Your Name" name="fullName" value={form.fullName} onChange={handleChange} required size="small" />
                <TextField fullWidth label="Country (optional)" name="country" value={form.country} onChange={handleChange} size="small" InputProps={{ startAdornment: <PublicIcon sx={{ fontSize: '1rem', color: alpha(goldDark, 0.5), mr: 0.5 }} /> }} />
                <TextField
                  select
                  fullWidth label="Category" name="category" value={form.category} onChange={handleChange}
                  size="small"
                  SelectProps={{ native: true }}
                >
                  {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                </TextField>
                <TextField
                  fullWidth label="Your Prayer" name="prayer" value={form.prayer} onChange={handleChange}
                  required multiline rows={5}
                  inputProps={{ maxLength: 400 }}
                  helperText={`${form.prayer.length}/400 characters`}
                />
              </Box>
              <Collapse in={success}>
                <Alert severity="success" sx={{ mt: 2 }}>Your prayer has been added to the wall. Blessings!</Alert>
              </Collapse>
              <Button
                type="submit" variant="contained" fullWidth disabled={submitting}
                startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}
                sx={{
                  mt: 3, background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                  color: '#1C1208', py: 1.3,
                  '&:hover': { boxShadow: `0 6px 20px ${alpha(gold, 0.45)}`, transform: 'translateY(-2px)' },
                }}
              >
                {submitting ? 'Sharing...' : 'Share Prayer'}
              </Button>
            </Paper>
          </Grid>

          {/* Prayer wall */}
          <Grid item xs={12} md={8}>
            {/* Category filter */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 4 }}>
              {CATEGORIES.map(cat => (
                <Chip
                  key={cat} label={cat}
                  onClick={() => setActiveCategory(cat)}
                  variant={activeCategory === cat ? 'filled' : 'outlined'}
                  sx={{
                    fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.08em',
                    cursor: 'pointer',
                    ...(activeCategory === cat
                      ? { background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`, color: '#1C1208', border: 'none' }
                      : { borderColor: alpha(gold, 0.35), color: goldDark, '&:hover': { background: alpha(gold, 0.1) } }
                    ),
                  }}
                />
              ))}
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rectangular" height={140} sx={{ borderRadius: '12px' }} />)}
              </Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Box sx={{ fontSize: '3rem', mb: 2 }}>🙏</Box>
                <Typography sx={{ fontFamily: '"Cinzel", serif', color: goldDark }}>
                  No prayers in this category yet. Be the first!
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {filtered.map((prayer, i) => (
                  <Box
                    key={prayer._id || i}
                    sx={{
                      p: { xs: 3, md: 3.5 }, backgroundColor: '#FFFFFF', borderRadius: '12px',
                      border: `1px solid ${alpha(gold, 0.18)}`,
                      boxShadow: `0 2px 12px ${alpha('#8A6107', 0.06)}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box>
                        <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '0.85rem', color: '#1C1208', mb: 0.3 }}>
                          {prayer.fullName || 'Anonymous'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {prayer.country && (
                            <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.72rem', color: alpha(goldDark, 0.6), display: 'flex', alignItems: 'center', gap: 0.3 }}>
                              <PublicIcon sx={{ fontSize: '0.72rem' }} />{prayer.country}
                            </Typography>
                          )}
                          {prayer.category && (
                            <Chip label={prayer.category} size="small" sx={{ height: 18, fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }} />
                          )}
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.75rem', color: textSecondary }}>
                          {prayer.likes || 0}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleLike(prayer._id)}
                          disabled={likedIds.includes(prayer._id)}
                          sx={{ color: likedIds.includes(prayer._id) ? crimson : alpha(crimson, 0.4), p: 0.5 }}
                        >
                          {likedIds.includes(prayer._id) ? <FavoriteIcon sx={{ fontSize: '1rem' }} /> : <FavoriteBorderIcon sx={{ fontSize: '1rem' }} />}
                        </IconButton>
                      </Box>
                    </Box>
                    <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: '0.9rem', color: textSecondary, lineHeight: 1.85 }}>
                      "{prayer.prayer || prayer.msg}"
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
