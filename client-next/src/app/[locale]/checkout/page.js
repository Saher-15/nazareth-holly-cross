'use client';
import React, { useState } from 'react';
import {
  Box, Container, Grid, Typography, TextField, Button, Paper,
  Divider, Stack, Stepper, Step, StepLabel, CircularProgress,
  Snackbar, Alert,
} from '@mui/material';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { colors } from '@/lib/theme';
import { useShop } from '@/context/ShopContext';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const steps = ['Shipping Info', 'Review Order', 'Payment'];

export default function CheckoutPage() {
  const locale = useLocale();
  const { cart, cartTotal, clearCart } = useShop();
  const [activeStep, setActiveStep] = useState(0);
  const [orderComplete, setOrderComplete] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '', country: '',
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const validate = () => {
    const e = {};
    if (!formData.firstName.trim()) e.firstName = 'Required';
    if (!formData.lastName.trim()) e.lastName = 'Required';
    if (!formData.email.trim()) e.email = 'Required';
    if (!formData.address.trim()) e.address = 'Required';
    if (!formData.city.trim()) e.city = 'Required';
    if (!formData.country.trim()) e.country = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  if (cart.length === 0 && !orderComplete) {
    return (
      <Container maxWidth="sm" sx={{ py: 12, textAlign: 'center' }}>
        <Typography sx={{ fontFamily: 'Cinzel, serif', fontSize: '1.3rem', color: colors.textPrimary, mb: 2 }}>
          Your cart is empty
        </Typography>
        <Button component={Link} href={`/${locale}/shop`} variant="contained" sx={{ background: 'linear-gradient(135deg, #C9A84C, #8A6107)', color: '#1C1208', fontFamily: 'Cinzel, serif' }}>
          Go to Shop
        </Button>
      </Container>
    );
  }

  if (orderComplete) {
    return (
      <Box sx={{ backgroundColor: colors.background, minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center', py: 8 }}>
          <CheckCircleIcon sx={{ fontSize: '5rem', color: '#2E7D32', mb: 2 }} />
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.8rem', color: colors.textPrimary, mb: 2 }}>
            Order Placed Successfully!
          </Typography>
          <Typography sx={{ color: colors.textSecondary, lineHeight: 1.8, mb: 4, fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
            Thank you for your order. A confirmation has been sent to {formData.email}. Your sacred goods will be shipped from Nazareth within 2-3 business days.
          </Typography>
          <Button href={`/${locale}`} variant="contained" sx={{ background: 'linear-gradient(135deg, #C9A84C, #8A6107)', color: '#1C1208', fontFamily: 'Cinzel, serif' }}>
            Return Home
          </Button>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh', py: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.5rem', md: '2rem' }, color: colors.textPrimary, mb: 4 }}>
          Checkout
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 5 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel sx={{
                '& .MuiStepLabel-label': { fontFamily: 'Cinzel, serif', fontSize: '0.78rem' },
                '& .MuiStepIcon-root.Mui-active': { color: colors.gold },
                '& .MuiStepIcon-root.Mui-completed': { color: colors.gold },
              }}>
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        <Grid container spacing={4}>
          <Grid xs={12} md={7}>
            <Paper elevation={1} sx={{ p: { xs: 2.5, md: 4 }, border: '1px solid rgba(201,168,76,0.12)', borderRadius: 2 }}>
              {activeStep === 0 && (
                <Box>
                  <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1rem', color: colors.textPrimary, mb: 3 }}>
                    Shipping Information
                  </Typography>
                  <Grid container spacing={2}>
                    {[
                      { name: 'firstName', label: 'First Name', xs: 6 },
                      { name: 'lastName', label: 'Last Name', xs: 6 },
                      { name: 'email', label: 'Email', xs: 12, type: 'email' },
                      { name: 'phone', label: 'Phone (optional)', xs: 12 },
                      { name: 'address', label: 'Address', xs: 12 },
                      { name: 'city', label: 'City', xs: 6 },
                      { name: 'state', label: 'State / Province', xs: 6 },
                      { name: 'zip', label: 'ZIP / Postal Code', xs: 6 },
                      { name: 'country', label: 'Country', xs: 6 },
                    ].map(({ name, label, xs, type }) => (
                      <Grid xs={xs} key={name}>
                        <TextField
                          fullWidth
                          label={label}
                          name={name}
                          type={type || 'text'}
                          value={formData[name]}
                          onChange={handleChange}
                          error={!!errors[name]}
                          helperText={errors[name]}
                          required={name !== 'phone' && name !== 'state' && name !== 'zip'}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {activeStep === 1 && (
                <Box>
                  <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1rem', color: colors.textPrimary, mb: 3 }}>
                    Review Your Order
                  </Typography>
                  <Stack spacing={2}>
                    {cart.map((item) => (
                      <Box key={`${item._id}-${item.selectedColor}`} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Box sx={{ width: 60, height: 60, borderRadius: 1, backgroundColor: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} /> : '✝'}
                        </Box>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 600, fontSize: '0.9rem', color: colors.textPrimary }}>
                            {item.name}
                          </Typography>
                          {item.selectedColor && <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>Color: {item.selectedColor}</Typography>}
                          <Typography sx={{ fontSize: '0.78rem', color: colors.textMuted }}>Qty: {item.quantity}</Typography>
                        </Box>
                        <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, color: colors.goldDark }}>
                          ${(item.price * item.quantity).toFixed(2)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                  <Divider sx={{ my: 3 }} />
                  <Box>
                    <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.85rem', color: colors.textPrimary, mb: 1.5 }}>
                      Shipping to:
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: colors.textSecondary }}>
                      {formData.firstName} {formData.lastName}<br />
                      {formData.address}, {formData.city} {formData.zip}<br />
                      {formData.country}
                    </Typography>
                  </Box>
                </Box>
              )}

              {activeStep === 2 && (
                <Box>
                  <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1rem', color: colors.textPrimary, mb: 3 }}>
                    Payment
                  </Typography>
                  <PayPalScriptProvider options={{ 'client-id': process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'test', currency: 'USD' }}>
                    <PayPalButtons
                      style={{ layout: 'vertical', color: 'gold', shape: 'rect', height: 48 }}
                      createOrder={(data, actions) =>
                        actions.order.create({
                          purchase_units: [{
                            amount: { value: cartTotal.toFixed(2) },
                            description: `Nazareth Holy Cross order for ${formData.firstName} ${formData.lastName}`,
                          }],
                        })
                      }
                      onApprove={async (data, actions) => {
                        await actions.order.capture();
                        clearCart();
                        setOrderComplete(true);
                      }}
                    />
                  </PayPalScriptProvider>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 3, borderTop: '1px solid rgba(201,168,76,0.15)' }}>
                <Button
                  onClick={() => setActiveStep((s) => s - 1)}
                  disabled={activeStep === 0}
                  sx={{ color: colors.textMuted, fontFamily: 'Cinzel, serif' }}
                >
                  Back
                </Button>
                {activeStep < 2 && (
                  <Button
                    onClick={() => {
                      if (activeStep === 0 && !validate()) return;
                      setActiveStep((s) => s + 1);
                    }}
                    variant="contained"
                    sx={{ background: 'linear-gradient(135deg, #C9A84C, #8A6107)', color: '#1C1208', fontFamily: 'Cinzel, serif', px: 4 }}
                  >
                    Continue
                  </Button>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Summary */}
          <Grid xs={12} md={5}>
            <Paper elevation={1} sx={{ p: 3, border: '1px solid rgba(201,168,76,0.15)', borderRadius: 2, position: { md: 'sticky' }, top: { md: 90 } }}>
              <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.9rem', color: colors.textPrimary, mb: 2 }}>
                Order Summary
              </Typography>
              <Stack spacing={1} sx={{ mb: 2 }}>
                {cart.map((item) => (
                  <Box key={`${item._id}-${item.selectedColor}`} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '0.82rem', color: colors.textSecondary }}>
                      {item.name} × {item.quantity}
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700 }}>Total</Typography>
                <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.1rem', color: colors.goldDark }}>
                  ${cartTotal.toFixed(2)}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
