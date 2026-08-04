import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import axios from 'axios';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/admin/login', form);
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('adminUsername', data.username);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #2A1005 0%, #8B4513 100%)',
      }}
    >
      <Card sx={{ width: 380, borderRadius: 3, boxShadow: 10 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <Box
              sx={{
                bgcolor: 'primary.main',
                borderRadius: '50%',
                p: 1.5,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LockOutlinedIcon sx={{ color: '#fff', fontSize: 28 }} />
            </Box>
            <Typography variant="h5" fontWeight={700} color="primary.dark">
              Admin Panel
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Nazareth Holy Cross
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Username"
              fullWidth
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{ py: 1.5, fontWeight: 700 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
