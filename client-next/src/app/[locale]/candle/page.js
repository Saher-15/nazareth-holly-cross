'use client';
import React, { useState } from 'react';
import {
  Box, Container, Grid, Typography, Button, TextField, MenuItem,
  Select, FormControl, InputLabel, Step, Stepper, StepLabel,
  Card, CardContent, Stack, Divider, Paper, Snackbar, Alert,
  FormHelperText,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChurchIcon from '@mui/icons-material/AccountBalance';
import { colors } from '@/lib/theme';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

const CHURCHES = [
  { id: 'basilica', name: 'Basilica of the Annunciation', description: 'The largest church in the Middle East, built over the site where the Angel Gabriel appeared to Mary.' },
  { id: 'greek', name: 'Greek Orthodox Church of the Annunciation', description: "Built over Mary's Well where the tradition says the annunciation first occurred." },
  { id: 'joseph', name: "St. Joseph's Church", description: "Built over the site of Joseph's workshop, where Jesus grew up." },
  { id: 'synagogue', name: 'Synagogue Church', description: "Built on the site of the synagogue where Jesus read from the scroll of Isaiah." },
];

const CANDLE_PRICE = 7;

const steps = ['Choose Church', 'Your Details', 'Payment'];

export default function CandlePage() {
  const [activeStep, setActiveStep] = useState(0);
  const [church, setChurch] = useState('');
  const [formData, setFormData] = useState({
    name: '', email: '', emailConfirm: '', prayer: '', phone: '',
  });
  const [errors, setErrors] = useState({});
  const [orderComplete, setOrderComplete] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const total = CANDLE_PRICE * quantity;

  const validateStep1 = () => {
    if (!church) {
      setErrors({ church: 'Please select a church' });
      return false;
    }
    setErrors({});
    return true;
  };

  const validateStep2 = () => {
    const e = {};
    if (!formData.name.trim()) e.name = 'Name is required';
    if (!formData.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = 'Invalid email format';
    if (formData.email !== formData.emailConfirm) e.emailConfirm = 'Emails do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (activeStep === 0 && !validateStep1()) return;
    if (activeStep === 1 && !validateStep2()) return;
    setActiveStep((s) => s + 1);
  };

  const handleBack = () => setActiveStep((s) => s - 1);

  const selectedChurch = CHURCHES.find((c) => c.id === church);

  if (orderComplete) {
    return (
      <Box sx={{ backgroundColor: colors.background, minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center', py: 8 }}>
          <CheckCircleIcon sx={{ fontSize: '5rem', color: '#2E7D32', mb: 2 }} />
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.8rem', color: colors.textPrimary, mb: 2 }}>
            Your Candle is Lit!
          </Typography>
          <Typography sx={{ color: colors.textSecondary, lineHeight: 1.8, mb: 4, fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: '1.05rem' }}>
            Your prayer has been received. We will go to {selectedChurch?.name} and light a candle in your name. A video will be sent to {formData.email}.
          </Typography>
          <Typography sx={{ fontSize: '2.5rem', mb: 3 }}>🕯</Typography>
          <Button
            href="/"
            variant="contained"
            sx={{ background: 'linear-gradient(135deg, #C9A84C, #8A6107)', color: '#1C1208', fontFamily: 'Cinzel, serif' }}
          >
            Return Home
          </Button>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Hero */}
      <Box
        sx={{
          py: { xs: 8, md: 14 },
          background: 'linear-gradient(160deg, #1C0E06 0%, #2C1810 100%)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <Container maxWidth="md" sx={{ position: 'relative' }}>
          <Typography
            sx={{
              fontSize: { xs: '3.5rem', md: '5rem' },
              mb: 2,
              animation: 'flicker 3s ease infinite',
              '@keyframes flicker': {
                '0%, 100%': { opacity: 1, transform: 'scaleY(1)' },
                '50%': { opacity: 0.85, transform: 'scaleY(0.95)' },
              },
            }}
          >
            🕯
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily: 'Cinzel, serif',
              fontWeight: 700,
              fontSize: { xs: '1.8rem', md: '2.8rem' },
              color: '#F7F2E8',
              mb: 2,
            }}
          >
            Light a Prayer Candle
          </Typography>
          <Typography
            sx={{
              fontFamily: 'Playfair Display, serif',
              fontStyle: 'italic',
              color: 'rgba(247,242,232,0.75)',
              fontSize: { xs: '1rem', md: '1.15rem' },
              maxWidth: 540,
              mx: 'auto',
              mb: 4,
              lineHeight: 1.75,
            }}
          >
            Send your prayers to the holy churches of Nazareth. We light the candle for you and send a personal video.
          </Typography>
          <Stack direction="row" spacing={4} justifyContent="center">
            {[
              { label: 'Per Candle', value: '$7' },
              { label: 'Response Time', value: '24–48h' },
              { label: 'Video Proof', value: 'Included' },
            ].map(({ label, value }) => (
              <Box key={label} sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.4rem', color: '#C9A84C' }}>
                  {value}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(247,242,232,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* How it works */}
      <Box sx={{ py: { xs: 6, md: 8 }, backgroundColor: colors.surface }}>
        <Container maxWidth="md">
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.4rem', textAlign: 'center', color: colors.textPrimary, mb: 4 }}>
            How It Works
          </Typography>
          <Grid container spacing={3}>
            {[
              { step: '01', title: 'Choose a Church', desc: 'Select from our list of sacred churches in Nazareth.' },
              { step: '02', title: 'Share Your Prayer', desc: 'Tell us your name and the prayer or intention for the candle.' },
              { step: '03', title: 'Complete Payment', desc: 'Pay securely via PayPal. Only $7 per candle.' },
              { step: '04', title: 'Receive Your Video', desc: 'We light the candle and send you a personal video to your email.' },
            ].map(({ step, title, desc }) => (
              <Grid xs={12} sm={6} key={step}>
                <Box sx={{ display: 'flex', gap: 2, p: 2.5, borderRadius: 2, backgroundColor: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)' }}>
                  <Typography
                    sx={{
                      fontFamily: 'Cinzel, serif',
                      fontWeight: 900,
                      fontSize: '1.5rem',
                      color: 'rgba(201,168,76,0.25)',
                      lineHeight: 1,
                      flexShrink: 0,
                      width: 40,
                    }}
                  >
                    {step}
                  </Typography>
                  <Box>
                    <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.9rem', color: colors.textPrimary, mb: 0.5 }}>
                      {title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', color: colors.textSecondary, lineHeight: 1.6 }}>
                      {desc}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Form */}
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 8 } }}>
        <Paper elevation={2} sx={{ p: { xs: 3, md: 5 }, borderRadius: 2, border: '1px solid rgba(201,168,76,0.15)' }}>
          {/* Stepper */}
          <Stepper activeStep={activeStep} sx={{ mb: 5 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel
                  sx={{
                    '& .MuiStepLabel-label': { fontFamily: 'Cinzel, serif', fontSize: '0.78rem', letterSpacing: '0.05em' },
                    '& .MuiStepIcon-root.Mui-active': { color: colors.gold },
                    '& .MuiStepIcon-root.Mui-completed': { color: colors.gold },
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Step 1: Choose Church */}
          {activeStep === 0 && (
            <Box>
              <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.1rem', color: colors.textPrimary, mb: 3 }}>
                Select a Church
              </Typography>
              <Grid container spacing={2}>
                {CHURCHES.map((c) => (
                  <Grid xs={12} sm={6} key={c.id}>
                    <Card
                      onClick={() => { setChurch(c.id); setErrors({}); }}
                      sx={{
                        cursor: 'pointer',
                        border: church === c.id ? `2px solid ${colors.gold}` : '1px solid rgba(201,168,76,0.15)',
                        backgroundColor: church === c.id ? 'rgba(201,168,76,0.05)' : '#FFFFFF',
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: colors.gold, transform: 'translateY(-2px)' },
                      }}
                    >
                      <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <ChurchIcon sx={{ color: church === c.id ? colors.gold : colors.textMuted, fontSize: '1.1rem' }} />
                          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.85rem', color: colors.textPrimary }}>
                            {c.name}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: '0.78rem', color: colors.textSecondary, lineHeight: 1.6 }}>
                          {c.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              {errors.church && (
                <Typography sx={{ color: 'error.main', fontSize: '0.75rem', mt: 1.5 }}>{errors.church}</Typography>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 3 }}>
                <Typography sx={{ fontSize: '0.85rem', color: colors.textSecondary }}>Quantity:</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {[1, 2, 3, 5].map((q) => (
                    <Button
                      key={q}
                      size="small"
                      variant={quantity === q ? 'contained' : 'outlined'}
                      onClick={() => setQuantity(q)}
                      sx={{
                        minWidth: 36,
                        ...(quantity === q
                          ? { background: 'linear-gradient(135deg, #C9A84C, #8A6107)', color: '#1C1208' }
                          : { borderColor: colors.gold, color: colors.goldDark }),
                      }}
                    >
                      {q}
                    </Button>
                  ))}
                </Box>
              </Box>
            </Box>
          )}

          {/* Step 2: Details */}
          {activeStep === 1 && (
            <Box>
              <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.1rem', color: colors.textPrimary, mb: 3 }}>
                Your Details
              </Typography>
              <Grid container spacing={2.5}>
                <Grid xs={12}>
                  <TextField
                    fullWidth
                    label="Your Full Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    error={!!errors.name}
                    helperText={errors.name}
                    required
                  />
                </Grid>
                <Grid xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    error={!!errors.email}
                    helperText={errors.email}
                    required
                  />
                </Grid>
                <Grid xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Confirm Email"
                    type="email"
                    value={formData.emailConfirm}
                    onChange={(e) => setFormData({ ...formData, emailConfirm: e.target.value })}
                    error={!!errors.emailConfirm}
                    helperText={errors.emailConfirm}
                    required
                  />
                </Grid>
                <Grid xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Your Prayer or Intention"
                    placeholder="Write your prayer, the name of whom you are praying for, or your personal intention..."
                    value={formData.prayer}
                    onChange={(e) => setFormData({ ...formData, prayer: e.target.value })}
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                    helperText={`${formData.prayer.length}/500 characters`}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Step 3: Payment */}
          {activeStep === 2 && (
            <Box>
              <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.1rem', color: colors.textPrimary, mb: 3 }}>
                Order Summary & Payment
              </Typography>
              <Box sx={{ p: 3, borderRadius: 2, backgroundColor: colors.surface, border: '1px solid rgba(201,168,76,0.2)', mb: 3 }}>
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ color: colors.textSecondary, fontSize: '0.88rem' }}>Church:</Typography>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', color: colors.textPrimary }}>{selectedChurch?.name}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ color: colors.textSecondary, fontSize: '0.88rem' }}>Name:</Typography>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{formData.name}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ color: colors.textSecondary, fontSize: '0.88rem' }}>Video sent to:</Typography>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{formData.email}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ color: colors.textSecondary, fontSize: '0.88rem' }}>Candles:</Typography>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{quantity} × $7</Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700 }}>Total:</Typography>
                    <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.2rem', color: colors.goldDark }}>
                      ${total}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <PayPalScriptProvider
                options={{
                  'client-id': process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'test',
                  currency: 'USD',
                }}
              >
                <PayPalButtons
                  style={{ layout: 'vertical', color: 'gold', shape: 'rect', height: 48 }}
                  createOrder={(data, actions) =>
                    actions.order.create({
                      purchase_units: [
                        {
                          amount: { value: total.toString() },
                          description: `Candle prayer at ${selectedChurch?.name} for ${formData.name}`,
                        },
                      ],
                    })
                  }
                  onApprove={async (data, actions) => {
                    await actions.order.capture();
                    setOrderComplete(true);
                  }}
                />
              </PayPalScriptProvider>
            </Box>
          )}

          {/* Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 3, borderTop: '1px solid rgba(201,168,76,0.15)' }}>
            <Button
              onClick={handleBack}
              disabled={activeStep === 0}
              sx={{ color: colors.textSecondary, fontFamily: 'Cinzel, serif', fontSize: '0.78rem' }}
            >
              Back
            </Button>
            {activeStep < 2 && (
              <Button
                onClick={handleNext}
                variant="contained"
                endIcon={<LocalFireDepartmentIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
                  color: '#1C1208',
                  fontFamily: 'Cinzel, serif',
                  letterSpacing: '0.08em',
                  px: 4,
                  '&:hover': { background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' },
                }}
              >
                {activeStep === 1 ? 'Review Order' : 'Continue'}
              </Button>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
