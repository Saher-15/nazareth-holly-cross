'use client';
import React, { useState, useEffect } from 'react';
import {
  Box, Container, Grid, Typography, Paper, Chip, IconButton,
  TextField, Button, Select, MenuItem, FormControl, InputLabel,
  Stack, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Snackbar, Alert,
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import AddIcon from '@mui/icons-material/Add';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { colors } from '@/lib/theme';
import api from '@/lib/api';

const PRAYER_CATEGORIES = [
  'All', 'Healing', 'Peace', 'Gratitude', 'Family', 'Love', 'Guidance', 'Memorial', 'Other',
];

const samplePrayers = [
  { _id: '1', name: 'Maria', country: 'Portugal', category: 'Healing', prayer: 'Please pray for my father who is ill. May God bring him healing and strength.', likes: 24, date: new Date() },
  { _id: '2', name: 'Johannes', country: 'Germany', category: 'Peace', prayer: 'A prayer for peace in the world and understanding between all peoples.', likes: 18, date: new Date() },
  { _id: '3', name: 'Elena', country: 'Russia', category: 'Gratitude', prayer: 'Thank you Lord for the blessings in my life and the beauty of this world.', likes: 31, date: new Date() },
  { _id: '4', name: 'Anonymous', country: 'France', category: 'Memorial', prayer: 'In loving memory of my mother who passed away last year. May she rest in eternal peace.', likes: 47, date: new Date() },
  { _id: '5', name: 'Isabella', country: 'Italy', category: 'Family', prayer: 'Praying for my family to be united, healthy, and filled with love.', likes: 12, date: new Date() },
  { _id: '6', name: 'Ana', country: 'Poland', category: 'Guidance', prayer: 'Lord, guide my steps as I face difficult decisions. Help me find your path.', likes: 19, date: new Date() },
];

export default function PrayerWallPage() {
  const [prayers, setPrayers] = useState(samplePrayers);
  const [category, setCategory] = useState('All');
  const [likedPrayers, setLikedPrayers] = useState(new Set());
  const [submitOpen, setSubmitOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', country: '', category: 'Other', prayer: '' });
  const [submitting, setSubmitting] = useState(false);
  const [successSnack, setSuccessSnack] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const liked = JSON.parse(localStorage.getItem('nhc_liked_prayers') || '[]');
    setLikedPrayers(new Set(liked));
  }, []);

  useEffect(() => {
    const fetchPrayers = async () => {
      try {
        const res = await api.get('/api/prayers');
        if (res.data && res.data.length > 0) {
          setPrayers(res.data);
        }
      } catch {
        // Use sample data
      }
    };
    fetchPrayers();
  }, []);

  const filteredPrayers = category === 'All'
    ? prayers
    : prayers.filter((p) => p.category === category);

  const handleLike = async (prayerId) => {
    const newLiked = new Set(likedPrayers);
    const alreadyLiked = newLiked.has(prayerId);
    if (alreadyLiked) {
      newLiked.delete(prayerId);
    } else {
      newLiked.add(prayerId);
      try {
        await api.post(`/api/prayers/${prayerId}/like`);
      } catch {}
    }
    setLikedPrayers(newLiked);
    localStorage.setItem('nhc_liked_prayers', JSON.stringify([...newLiked]));
    setPrayers((prev) =>
      prev.map((p) =>
        p._id === prayerId
          ? { ...p, likes: alreadyLiked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  };

  const handleSubmit = async () => {
    if (!formData.prayer.trim() || !formData.name.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/api/prayers', formData);
      setPrayers((prev) => [
        { ...formData, _id: Date.now().toString(), likes: 0, date: new Date() },
        ...prev,
      ]);
      setSuccessSnack(true);
      setSubmitOpen(false);
      setFormData({ name: '', country: '', category: 'Other', prayer: '' });
    } catch {
      // Add to local state anyway
      setPrayers((prev) => [
        { ...formData, _id: Date.now().toString(), likes: 0, date: new Date() },
        ...prev,
      ]);
      setSuccessSnack(true);
      setSubmitOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const categoryColorMap = {
    Healing: '#2196F3',
    Peace: '#4CAF50',
    Gratitude: '#C9A84C',
    Family: '#E91E63',
    Love: '#E91E63',
    Guidance: '#9C27B0',
    Memorial: '#607D8B',
    Other: '#9B7B6A',
  };

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ py: { xs: 8, md: 12 }, background: 'linear-gradient(160deg, #1C0E06, #2C1810)', textAlign: 'center', position: 'relative' }}>
        <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <Container maxWidth="md" sx={{ position: 'relative' }}>
          <Typography sx={{ fontSize: '3rem', mb: 2 }}>🙏</Typography>
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.5rem' }, color: '#F7F2E8', mb: 1.5 }}>
            Prayer Wall
          </Typography>
          <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: 'rgba(247,242,232,0.7)', fontSize: '1.05rem', mb: 4, maxWidth: 500, mx: 'auto' }}>
            A sacred space where prayers from around the world unite in faith
          </Typography>
          <Button
            onClick={() => setSubmitOpen(true)}
            variant="contained"
            startIcon={<AddIcon />}
            sx={{
              background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
              color: '#1C1208',
              fontFamily: 'Cinzel, serif',
              fontWeight: 700,
              px: 4,
              py: 1.5,
              '&:hover': { background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' },
            }}
          >
            Add Your Prayer
          </Button>
        </Container>
      </Box>

      {/* Filter */}
      <Box sx={{ py: 2, backgroundColor: colors.surface, borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} sx={{ gap: 1 }}>
            {PRAYER_CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                onClick={() => setCategory(cat)}
                variant={category === cat ? 'filled' : 'outlined'}
                size="small"
                sx={{
                  fontFamily: 'Lato, sans-serif',
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  ...(category === cat
                    ? { backgroundColor: colors.gold, color: '#1C1208', borderColor: colors.gold }
                    : { borderColor: 'rgba(201,168,76,0.3)', color: colors.textSecondary }),
                }}
              />
            ))}
          </Stack>
        </Container>
      </Box>

      {/* Prayers Grid */}
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
        <Grid container spacing={2.5}>
          {filteredPrayers.map((prayer) => (
            <Grid xs={12} sm={6} md={4} key={prayer._id}>
              <Paper
                elevation={1}
                sx={{
                  p: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid rgba(201,168,76,0.12)',
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 32px rgba(28,18,8,0.1)' },
                }}
              >
                <FormatQuoteIcon sx={{ color: 'rgba(201,168,76,0.2)', fontSize: '2rem', mb: 1 }} />
                <Typography
                  sx={{
                    fontFamily: 'Playfair Display, serif',
                    fontStyle: 'italic',
                    color: colors.textSecondary,
                    fontSize: '0.88rem',
                    lineHeight: 1.8,
                    flexGrow: 1,
                    mb: 2,
                  }}
                >
                  "{prayer.prayer}"
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    {prayer.category && (
                      <Chip
                        label={prayer.category}
                        size="small"
                        sx={{
                          mb: 0.75,
                          fontSize: '0.62rem',
                          fontFamily: 'Lato, sans-serif',
                          fontWeight: 700,
                          backgroundColor: `${categoryColorMap[prayer.category] || '#9B7B6A'}18`,
                          color: categoryColorMap[prayer.category] || colors.textMuted,
                          border: `1px solid ${categoryColorMap[prayer.category] || colors.textMuted}30`,
                        }}
                      />
                    )}
                    <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.82rem', color: colors.textPrimary }}>
                      {prayer.name}
                      {prayer.country && (
                        <span style={{ color: colors.textMuted, fontFamily: 'Lato, sans-serif', fontWeight: 400, fontSize: '0.72rem', marginLeft: 6 }}>
                          · {prayer.country}
                        </span>
                      )}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: '0.78rem', color: colors.textMuted }}>{prayer.likes || 0}</Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleLike(prayer._id)}
                      sx={{
                        color: likedPrayers.has(prayer._id) ? colors.crimson : colors.textMuted,
                        '&:hover': { color: colors.crimson, backgroundColor: 'rgba(139,26,26,0.08)' },
                      }}
                    >
                      {likedPrayers.has(prayer._id) ? <FavoriteIcon sx={{ fontSize: '1rem' }} /> : <FavoriteBorderIcon sx={{ fontSize: '1rem' }} />}
                    </IconButton>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Submit Prayer Dialog */}
      <Dialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, border: '1px solid rgba(201,168,76,0.2)' } }}
      >
        <DialogTitle sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, color: colors.textPrimary, pb: 1 }}>
          Add Your Prayer
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: colors.textMuted, fontSize: '0.82rem', mb: 3, fontStyle: 'italic' }}>
            Your prayer will be shared on the wall and prayed for by our community in Nazareth.
          </Typography>
          <Stack spacing={2.5}>
            <TextField
              label="Your Name (or Anonymous)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Your Country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                label="Category"
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {PRAYER_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Your Prayer"
              multiline
              rows={4}
              value={formData.prayer}
              onChange={(e) => setFormData({ ...formData, prayer: e.target.value })}
              fullWidth
              required
              placeholder="Share your prayer or intention..."
              slotProps={{ htmlInput: { maxLength: 400 } }}
              helperText={`${formData.prayer.length}/400`}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 0 }}>
          <Button
            onClick={() => setSubmitOpen(false)}
            sx={{ color: colors.textMuted, fontFamily: 'Cinzel, serif', fontSize: '0.78rem' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting || !formData.prayer.trim() || !formData.name.trim()}
            startIcon={submitting ? <CircularProgress size={16} /> : null}
            sx={{
              background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
              color: '#1C1208',
              fontFamily: 'Cinzel, serif',
              '&:hover': { background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' },
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Prayer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={successSnack} autoHideDuration={4000} onClose={() => setSuccessSnack(false)}>
        <Alert severity="success">Your prayer has been added to the wall. May God hear it.</Alert>
      </Snackbar>
    </Box>
  );
}
