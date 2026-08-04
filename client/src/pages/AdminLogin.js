import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import api from '../api';
import { gold, goldDark, crimson, goldGradientText } from '../theme';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [form,    setForm]    = useState({ username: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/admin/login', form);
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('adminUsername', data.username || data.user);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #0D0600 0%, #1C0E06 50%, #2C1810 100%)',
        p: 3,
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: '100%', maxWidth: 420,
          backgroundColor: alpha('#FFFFFF', 0.04),
          border: `1px solid ${alpha(gold, 0.2)}`,
          borderRadius: '16px',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          overflow: 'visible',
          '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, borderRadius: '16px 16px 0 0' },
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 64, height: 64, borderRadius: '50%', mx: 'auto', mb: 2,
                background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 32px ${alpha(gold, 0.35)}`,
              }}
            >
              <LockOutlinedIcon sx={{ color: '#1C1208', fontSize: '1.6rem' }} />
            </Box>
            <Box sx={{ fontSize: '1.5rem', mb: 1 }}>✝</Box>
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1rem', ...goldGradientText, letterSpacing: '0.1em' }}>
              ADMIN ACCESS
            </Typography>
            <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.78rem', color: alpha('#F7F2E8', 0.5), mt: 0.5 }}>
              Nazareth Holy Cross Management
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Username"
              value={form.username}
              onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))}
              required
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#F7F2E8', backgroundColor: alpha('#FFFFFF', 0.05),
                  '& fieldset': { borderColor: alpha(gold, 0.25) },
                  '&:hover fieldset': { borderColor: alpha(gold, 0.5) },
                  '&.Mui-focused fieldset': { borderColor: gold },
                },
                '& .MuiInputLabel-root': { color: alpha('#F7F2E8', 0.5), '&.Mui-focused': { color: gold } },
              }}
            />
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
              required
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#F7F2E8', backgroundColor: alpha('#FFFFFF', 0.05),
                  '& fieldset': { borderColor: alpha(gold, 0.25) },
                  '&:hover fieldset': { borderColor: alpha(gold, 0.5) },
                  '&.Mui-focused fieldset': { borderColor: gold },
                },
                '& .MuiInputLabel-root': { color: alpha('#F7F2E8', 0.5), '&.Mui-focused': { color: gold } },
              }}
            />
            {error && <Alert severity="error" sx={{ backgroundColor: alpha('#c62828', 0.12), border: `1px solid ${alpha('#EF5350', 0.3)}` }}>{error}</Alert>}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} sx={{ color: '#1C1208' }} /> : <LockOutlinedIcon />}
              sx={{
                mt: 1, background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                color: '#1C1208', py: 1.4,
                '&:hover': { boxShadow: `0 8px 24px ${alpha(gold, 0.45)}` },
                '&.Mui-disabled': { background: alpha(gold, 0.25) },
              }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
