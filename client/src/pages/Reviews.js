import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import ForumIcon from '@mui/icons-material/Forum';
import PersonIcon from '@mui/icons-material/Person';
import PublicIcon from '@mui/icons-material/Public';
import { gold, goldLight, goldDark, goldGradientText } from '../theme';

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: goldLight,
    fontSize: '0.9rem',
    '& fieldset': { borderColor: alpha(gold, 0.2) },
    '&:hover fieldset': { borderColor: alpha(gold, 0.4) },
    '&.Mui-focused fieldset': { borderColor: gold },
  },
  '& .MuiInputLabel-root': { color: alpha(goldLight, 0.5), '&.Mui-focused': { color: gold } },
};

function Reviews() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ fullName: '', email: '', phone: '000', msg: '' });
  const [messages, setMessages] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const fetchMessages = async () => {
    try {
      const response = await axios.get('https://nazareth-holy-cross-c5896e0462c5.herokuapp.com/contact/get_all_contact_us');
      const reviewed = response.data.filter((m) => m.done).reverse();
      setMessages(reviewed);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.msg) return;
    try {
      await axios.post('https://nazareth-holy-cross-c5896e0462c5.herokuapp.com/contact/contact_us_request', formData);
      setFormData({ fullName: '', email: '', phone: '000', msg: '' });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3500);
      fetchMessages();
    } catch (error) {
      console.error('Error sending form data:', error);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchMessages();
  }, []);

  return (
    <Box sx={{ minHeight: '80vh', py: { xs: 6, md: 10 }, px: { xs: 2, sm: 3 } }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
          <Typography variant="h2" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.5rem' }, ...goldGradientText, mb: 1 }}>
            {t('pray.formTitle')}
          </Typography>
          <Box sx={{ width: 60, height: 2, mx: 'auto', background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
          <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', color: alpha(goldLight, 0.55), mt: 2, fontSize: '0.95rem', maxWidth: 500, mx: 'auto' }}>
            {t('pray.formDescription')}
          </Typography>
        </Box>

        <Grid container spacing={5} alignItems="flex-start">
          {/* Form */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              elevation={0}
              component="form"
              onSubmit={handleSubmit}
              sx={{
                p: { xs: 3, md: 4 },
                background: `linear-gradient(145deg, ${alpha('#1A1215', 0.9)} 0%, ${alpha('#0D0810', 0.95)} 100%)`,
                border: `1px solid ${alpha(gold, 0.15)}`,
                borderRadius: '12px',
                position: { md: 'sticky' },
                top: '90px',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  borderRadius: '12px 12px 0 0',
                  background: `linear-gradient(90deg, transparent, ${gold}, transparent)`,
                },
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  label={t('pray.placeholderFullName')}
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  size="small"
                  InputProps={{ startAdornment: <PersonIcon sx={{ color: alpha(gold, 0.4), mr: 1, fontSize: '1rem' }} /> }}
                  sx={inputSx}
                />
                <TextField
                  fullWidth
                  label={t('pray.placeholderCountry')}
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  size="small"
                  InputProps={{ startAdornment: <PublicIcon sx={{ color: alpha(gold, 0.4), mr: 1, fontSize: '1rem' }} /> }}
                  sx={inputSx}
                />
                <TextField
                  fullWidth
                  label={t('pray.placeholderMessage')}
                  name="msg"
                  value={formData.msg}
                  onChange={handleChange}
                  required
                  multiline
                  rows={5}
                  sx={inputSx}
                />
              </Box>

              <Collapse in={showSuccess}>
                <Alert severity="success" sx={{ mt: 2, backgroundColor: alpha('#2E7D32', 0.12), border: `1px solid ${alpha('#2E7D32', 0.3)}`, color: goldLight }}>
                  {t('pray.successMessage')}
                </Alert>
              </Collapse>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                startIcon={<SendIcon />}
                sx={{
                  mt: 3,
                  background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                  color: '#0a0608',
                  py: 1.5,
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.78rem',
                  letterSpacing: '0.15em',
                  boxShadow: `0 4px 20px ${alpha(gold, 0.35)}`,
                  '&:hover': { background: `linear-gradient(135deg, ${goldLight} 0%, ${gold} 100%)`, boxShadow: `0 8px 30px ${alpha(gold, 0.55)}`, transform: 'translateY(-2px)' },
                }}
              >
                {t('pray.submitButton')}
              </Button>
            </Paper>
          </Grid>

          {/* Messages */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <ForumIcon sx={{ color: alpha(gold, 0.6), fontSize: '1.2rem' }} />
                <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.1em', color: goldLight }}>
                  {t('pray.messagesTitle')}
                </Typography>
              </Box>
              <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.82rem', color: alpha(goldLight, 0.45) }}>
                {t('pray.messagesDescription')}
              </Typography>
            </Box>

            {messages.length > 0 ? (
              <Grid container spacing={2}>
                {messages.map((message, index) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={index}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 3,
                        background: `linear-gradient(145deg, ${alpha('#1A1215', 0.7)} 0%, ${alpha('#0D0810', 0.8)} 100%)`,
                        border: `1px solid ${alpha(gold, 0.1)}`,
                        borderRadius: '10px',
                        transition: 'all 0.35s ease',
                        position: 'relative',
                        '&:hover': {
                          border: `1px solid ${alpha(gold, 0.28)}`,
                          boxShadow: `0 8px 24px ${alpha('#000', 0.4)}, 0 0 16px ${alpha(gold, 0.06)}`,
                          transform: 'translateY(-3px)',
                        },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '2px',
                          borderRadius: '10px 10px 0 0',
                          background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.4)}, transparent)`,
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 600, fontSize: '0.9rem', color: goldLight }}>
                          {message.fullName}
                        </Typography>
                        <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.75rem', color: alpha(gold, 0.55), display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PublicIcon sx={{ fontSize: '0.8rem' }} />
                          {message.email}
                        </Typography>
                      </Box>
                      <Divider sx={{ borderColor: alpha(gold, 0.1), mb: 1.5 }} />
                      <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.85rem', color: alpha(goldLight, 0.6), lineHeight: 1.7, fontStyle: 'italic' }}>
                        "{message.msg}"
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: '1rem', color: alpha(goldLight, 0.35) }}>
                  {t('pray.noMessages')}
                </Typography>
              </Box>
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default Reviews;
