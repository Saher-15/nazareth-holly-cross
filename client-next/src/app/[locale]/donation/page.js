'use client';
import React, { useState } from 'react';
import {
  Box, Container, Grid, Typography, Button, TextField, Stack,
  Paper, Chip, Divider,
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { colors } from '@/lib/theme';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const SUGGESTED_AMOUNTS = [10, 25, 50, 100];

export default function DonationPage() {
  const [amount, setAmount] = useState(25);
  const [customAmount, setCustomAmount] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [donated, setDonated] = useState(false);

  const finalAmount = customAmount ? parseFloat(customAmount) : amount;

  if (donated) {
    return (
      <Box sx={{ backgroundColor: colors.background, minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center', py: 8 }}>
          <CheckCircleIcon sx={{ fontSize: '5rem', color: '#2E7D32', mb: 2 }} />
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.8rem', color: colors.textPrimary, mb: 2 }}>
            Thank You for Your Generosity
          </Typography>
          <Typography sx={{ color: colors.textSecondary, lineHeight: 1.8, mb: 2, fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: '1.05rem' }}>
            Your donation of ${finalAmount} has been received. May God bless you abundantly for your generous heart.
          </Typography>
          <Typography sx={{ fontSize: '3rem', mb: 3 }}>🙏</Typography>
          <Button href="/" variant="contained" sx={{ background: 'linear-gradient(135deg, #C9A84C, #8A6107)', color: '#1C1208', fontFamily: 'Cinzel, serif' }}>
            Return Home
          </Button>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ py: { xs: 8, md: 12 }, background: 'linear-gradient(160deg, #1C0E06, #2C1810)', textAlign: 'center' }}>
        <Container maxWidth="md">
          <FavoriteIcon sx={{ fontSize: '3rem', color: '#C9A84C', mb: 2 }} />
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.5rem' }, color: '#F7F2E8', mb: 1.5 }}>
            Support Our Ministry
          </Typography>
          <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: 'rgba(247,242,232,0.7)', fontSize: '1.05rem', maxWidth: 500, mx: 'auto', lineHeight: 1.75 }}>
            Your generosity helps us maintain the holy sites of Nazareth and serve the faithful around the world.
          </Typography>
        </Container>
      </Box>

      {/* Impact Section */}
      <Box sx={{ py: { xs: 4, md: 6 }, backgroundColor: colors.surface }}>
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            {[
              { amount: '$10', impact: 'Lights 1 candle prayer in our churches' },
              { amount: '$25', impact: 'Supports one day of church maintenance' },
              { amount: '$50', impact: 'Helps preserve holy site artifacts' },
              { amount: '$100', impact: 'Sponsors a community outreach event' },
            ].map(({ amount: a, impact }) => (
              <Grid xs={12} sm={6} md={3} key={a}>
                <Box sx={{ textAlign: 'center', p: 2.5, borderRadius: 2, backgroundColor: '#FFFFFF', border: '1px solid rgba(201,168,76,0.12)' }}>
                  <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.5rem', color: colors.goldDark, mb: 1 }}>
                    {a}
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: colors.textSecondary, lineHeight: 1.6 }}>{impact}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Donation Form */}
      <Container maxWidth="sm" sx={{ py: { xs: 6, md: 8 } }}>
        <Paper elevation={2} sx={{ p: { xs: 3, md: 5 }, borderRadius: 2, border: '1px solid rgba(201,168,76,0.15)' }}>
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.1rem', color: colors.textPrimary, mb: 3 }}>
            Make a Donation
          </Typography>

          {/* Amount Selector */}
          <Typography sx={{ fontFamily: 'Lato, sans-serif', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textSecondary, mb: 1.5 }}>
            Select Amount
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }} sx={{ mb: 2, gap: 1.5 }}>
            {SUGGESTED_AMOUNTS.map((a) => (
              <Button
                key={a}
                onClick={() => { setAmount(a); setCustomAmount(''); }}
                variant={amount === a && !customAmount ? 'contained' : 'outlined'}
                sx={{
                  fontFamily: 'Cinzel, serif',
                  fontWeight: 700,
                  ...(amount === a && !customAmount
                    ? { background: 'linear-gradient(135deg, #C9A84C, #8A6107)', color: '#1C1208' }
                    : { borderColor: colors.gold, color: colors.goldDark }),
                }}
              >
                ${a}
              </Button>
            ))}
          </Stack>
          <TextField
            fullWidth
            label="Custom Amount ($)"
            type="number"
            value={customAmount}
            onChange={(e) => { setCustomAmount(e.target.value); setAmount(0); }}
            placeholder="Enter amount"
            slotProps={{ htmlInput: { min: 1 } }}
            sx={{ mb: 3 }}
          />

          <Divider sx={{ mb: 3 }} />

          <TextField
            fullWidth
            label="Your Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Dedication or Message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="In memory of... / In honor of..."
            sx={{ mb: 3 }}
          />

          {/* Total */}
          <Box sx={{ p: 2, borderRadius: 1, backgroundColor: colors.surface, border: '1px solid rgba(201,168,76,0.2)', mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, color: colors.textPrimary }}>Donation Total</Typography>
            <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.3rem', color: colors.goldDark }}>
              ${finalAmount || 0}
            </Typography>
          </Box>

          {finalAmount > 0 && (
            <PayPalScriptProvider options={{ 'client-id': process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'test', currency: 'USD' }}>
              <PayPalButtons
                style={{ layout: 'vertical', color: 'gold', shape: 'rect', height: 48 }}
                createOrder={(data, actions) =>
                  actions.order.create({
                    purchase_units: [{
                      amount: { value: finalAmount.toString() },
                      description: `Donation to Nazareth Holy Cross Ministry${name ? ` from ${name}` : ''}`,
                    }],
                  })
                }
                onApprove={async (data, actions) => {
                  await actions.order.capture();
                  setDonated(true);
                }}
              />
            </PayPalScriptProvider>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
