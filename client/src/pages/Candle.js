import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import FormLabel from '@mui/material/FormLabel';
import { alpha } from '@mui/material/styles';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { gold, goldLight, goldDark, crimson, goldGradientText } from '../theme';

const candleVideos = [
  'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fcandle_pray%2FWhatsApp%20Video%202024-11-05%20at%2002.34.14_fc5f95e7.mp4?alt=media&token=cab3d08c-237e-40b6-a64d-957d19d71731',
  'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fcandle_pray%2FWhatsApp%20Video%202024-11-05%20at%2002.34.15_c6586f18.mp4?alt=media&token=abc653e4-85ff-425d-b8b5-fa9d903a3d49',
  'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fcandle_pray%2FWhatsApp%20Video%202024-11-05%20at%2002.34.37_c546bb3f.mp4?alt=media&token=8d03dac8-640b-466c-81f0-bc35ce0a7230',
  'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fcandle_pray%2FWhatsApp%20Video%202024-11-05%20at%2002.34.39_83f23b38.mp4?alt=media&token=cd8ea957-6c00-499e-9374-cdd99d2cbec1',
  'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fcandle_pray%2FWhatsApp%20Video%202024-11-05%20at%2002.34.44_4caad8a0.mp4?alt=media&token=4052f0b5-aac5-42a2-9a43-b7e70bae5fc3',
  'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fcandle_pray%2FWhatsApp%20Video%202024-11-05%20at%2002.34.58_71978b55.mp4?alt=media&token=006a14aa-9398-49f4-bbf5-464c144f14f0',
];

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: '#1C1208',
    fontSize: '0.9rem',
    backgroundColor: '#FFFFFF',
    '& fieldset': { borderColor: alpha(gold, 0.25) },
    '&:hover fieldset': { borderColor: alpha(gold, 0.5) },
    '&.Mui-focused fieldset': { borderColor: gold },
  },
  '& .MuiInputLabel-root': { color: '#9B7B6A', '&.Mui-focused': { color: goldDark } },
  '& .MuiInputBase-input': { caretColor: gold },
};

function Candle() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ firstname: '', lastname: '', email: '', confirmEmail: '', pray: '' });
  const [selectedChurch, setSelectedChurch] = useState('');
  const navigate = useNavigate();
  const [emailMatchError, setEmailMatchError] = useState('');
  const [inputWarning, setInputWarning] = useState('');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const handleChangeForm = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLightButton = async () => {
    if (!form.firstname || !form.lastname || !form.email || !form.confirmEmail || !form.pray || !selectedChurch) {
      setInputWarning(t('candle.inputWarning'));
      setTimeout(() => setInputWarning(''), 2500);
      return;
    }
    if (form.email !== form.confirmEmail) {
      setEmailMatchError(t('candle.emailsDontMatch'));
      setTimeout(() => setEmailMatchError(''), 2500);
      return;
    }
    const updatedPray = `${selectedChurch}, ${form.pray}`;
    navigate('/checkoutcandle', { state: { form: { ...form, pray: updatedPray } } });
  };

  return (
    <Box sx={{ minHeight: '80vh', backgroundColor: '#F7F2E8' }}>
      {/* ── Hero banner ── */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: 240, md: 320 },
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', mb: { xs: 5, md: 7 },
          '&::before': {
            content: '""', position: 'absolute', inset: 0,
            backgroundImage: 'url(/images/lightACandle.jpg)',
            backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'brightness(0.25) saturate(0.5)',
          },
          '&::after': {
            content: '""', position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, ${alpha('#000', 0.2)} 0%, transparent 40%, #F7F2E8 100%)`,
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center', px: 3 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ width: 40, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.6)})` }} />
            <LocalFireDepartmentIcon sx={{ color: crimson, fontSize: '1.4rem', filter: `drop-shadow(0 0 12px ${alpha(crimson, 0.9)})` }} />
            <Box sx={{ width: 40, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.6)}, transparent)` }} />
          </Box>
          <Typography variant="h2" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.6rem' }, ...goldGradientText, mb: 1 }}>
            {t('candle.lightAPrayCandle')}
          </Typography>
          <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', color: '#9B7B6A', fontSize: { xs: '0.86rem', md: '0.95rem' }, maxWidth: 400, mx: 'auto' }}>
            Light a candle in the Holy Land — a sacred prayer delivered in your name
          </Typography>
        </Box>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 8, md: 10 } }}>
      <Container maxWidth="xl">
        <Grid container spacing={5} alignItems="flex-start">
          {/* Form */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper
              elevation={0}
              component="form"
              onSubmit={(e) => e.preventDefault()}
              sx={{
                p: { xs: 3, md: 4 },
                backgroundColor: '#FFFFFF',
                border: `1px solid ${alpha(gold, 0.2)}`,
                borderRadius: '12px',
                position: 'relative',
                top: 0,
                boxShadow: `0 8px 32px ${alpha('#8A6107', 0.1)}`,
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
              {/* Church selection */}
              <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
                <FormLabel
                  sx={{
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.7rem',
                    letterSpacing: '0.2em',
                    color: `${goldDark} !important`,
                    textTransform: 'uppercase',
                    mb: 1.5,
                  }}
                >
                  {t('candle.selectChurch')}
                </FormLabel>
                <RadioGroup value={selectedChurch} onChange={(e) => setSelectedChurch(e.target.value)}>
                  {['Annunciation church', 'Greek orthodox church'].map((church) => (
                    <FormControlLabel
                      key={church}
                      value={church}
                      control={
                        <Radio
                          sx={{
                            color: alpha(gold, 0.35),
                            '&.Mui-checked': { color: gold },
                            '& .MuiSvgIcon-root': { fontSize: '1rem' },
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 400, fontSize: '0.9rem', color: '#5D3E2C' }}>
                          {church}
                        </Typography>
                      }
                    />
                  ))}
                </RadioGroup>
              </FormControl>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <TextField fullWidth label={t('candle.firstName')} name="firstname" value={form.firstname} onChange={handleChangeForm} required size="small" sx={inputSx} />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField fullWidth label={t('candle.lastName')} name="lastname" value={form.lastname} onChange={handleChangeForm} required size="small" sx={inputSx} />
                  </Grid>
                </Grid>

                <TextField fullWidth label={t('candle.yourEmail')} type="email" name="email" value={form.email} onChange={handleChangeForm} required size="small" sx={inputSx} />
                <TextField fullWidth label={t('candle.confirmEmail')} type="email" name="confirmEmail" value={form.confirmEmail} onChange={handleChangeForm} required size="small" sx={inputSx} />

                <TextField
                  fullWidth
                  label={t('candle.yourPrayer')}
                  name="pray"
                  value={form.pray}
                  onChange={handleChangeForm}
                  required
                  multiline
                  rows={4}
                  sx={inputSx}
                />
              </Box>

              <Collapse in={!!emailMatchError}><Alert severity="error" sx={{ mt: 2, backgroundColor: alpha('#c62828', 0.08), border: `1px solid ${alpha('#c62828', 0.25)}` }}>{emailMatchError}</Alert></Collapse>
              <Collapse in={!!inputWarning}><Alert severity="warning" sx={{ mt: 2, backgroundColor: alpha('#B8860B', 0.08), border: `1px solid ${alpha(gold, 0.3)}`, '& .MuiAlert-icon': { color: goldDark } }}>{inputWarning}</Alert></Collapse>

              <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.75rem', letterSpacing: '0.1em', color: goldDark, textAlign: 'center', mt: 2.5, mb: 2 }}>
                {t('candle.toLightACandlePay')}
              </Typography>

              <Button
                fullWidth
                variant="contained"
                startIcon={<LocalFireDepartmentIcon />}
                onClick={handleLightButton}
                sx={{
                  background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                  color: '#FFFFFF',
                  py: 1.5,
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.78rem',
                  letterSpacing: '0.15em',
                  boxShadow: `0 4px 20px ${alpha(gold, 0.35)}`,
                  '&:hover': { background: `linear-gradient(135deg, #D4B060 0%, ${gold} 100%)`, boxShadow: `0 8px 30px ${alpha(gold, 0.5)}`, transform: 'translateY(-2px)' },
                }}
              >
                {t('candle.light')}
              </Button>
            </Paper>
          </Grid>

          {/* How-to + Videos */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Box
              sx={{
                p: { xs: 3, md: 4 },
                backgroundColor: '#FFFFFF',
                border: `1px solid ${alpha(gold, 0.18)}`,
                borderRadius: '12px',
                mb: 4,
                position: 'relative',
                boxShadow: `0 4px 20px ${alpha('#8A6107', 0.08)}`,
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
              <Typography variant="h4" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 600, fontSize: { xs: '1.3rem', md: '1.6rem' }, color: '#1C1208', textAlign: 'center', mb: 2 }}>
                {t('candle.howToLightACandle')}
              </Typography>
              <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', color: '#5D3E2C', textAlign: 'center', mb: 3, fontSize: '1rem' }}>
                {t('candle.itsSimple')}
              </Typography>
              <Box component="ol" sx={{ pl: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {['candle.step1', 'candle.step2', 'candle.step3'].map((step, i) => (
                  <Box component="li" key={i} sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 400, fontSize: '0.9rem', color: '#5D3E2C', lineHeight: 1.7 }}>
                    {t(step)}
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Video Gallery */}
            <Grid container spacing={2}>
              {candleVideos.map((url, index) => (
                <Grid size={{ xs: 12, sm: 6 }} key={index}>
                  <Box
                    component="video"
                    src={url}
                    controls
                    poster="images/lightACandle.jpg"
                    sx={{
                      width: '100%',
                      borderRadius: '8px',
                      border: `1px solid ${alpha(gold, 0.2)}`,
                      backgroundColor: '#FFFFFF',
                      display: 'block',
                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                      '&:hover': { borderColor: alpha(gold, 0.5), boxShadow: `0 4px 16px ${alpha('#8A6107', 0.15)}` },
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Container>
      </Box>
    </Box>
  );
}

export default Candle;
