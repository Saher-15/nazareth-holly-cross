'use client';
import React, { useState } from 'react';
import {
  Box, Container, Paper, Typography, TextField, Button,
  CircularProgress, Alert,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { colors } from '@/lib/theme';
import api from '@/lib/api';

export default function AdminLoginPage() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const locale = useLocale();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/admin/login', formData);
      if (res.data?.token) {
        localStorage.setItem('adminToken', res.data.token);
        router.push(`/${locale}/admin`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#1C0E06',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9A84C' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      }}
    >
      <Container maxWidth="xs">
        <Paper
          elevation={3}
          sx={{
            p: 5,
            borderRadius: 2,
            border: '1px solid rgba(201,168,76,0.3)',
            backgroundColor: colors.background,
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <LockIcon sx={{ color: '#1C1208' }} />
            </Box>
            <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.2rem', color: colors.textPrimary }}>
              Admin Portal
            </Typography>
            <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: colors.textMuted, fontSize: '0.85rem' }}>
              Nazareth Holy Cross
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} /> : null}
              sx={{
                background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
                color: '#1C1208',
                fontFamily: 'Cinzel, serif',
                fontWeight: 700,
                py: 1.5,
                '&:hover': { background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' },
              }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
