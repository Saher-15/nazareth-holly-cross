'use client';
import React from 'react';
import {
  Box, Container, Grid, Typography, Button, IconButton, Stack,
  Divider, Paper, TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { colors } from '@/lib/theme';
import { useShop } from '@/context/ShopContext';

export default function CartPage() {
  const locale = useLocale();
  const { cart, cartTotal, removeFromCart, updateQuantity, clearCart } = useShop();

  if (cart.length === 0) {
    return (
      <Box sx={{ backgroundColor: colors.background, minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center', py: 8 }}>
          <Typography sx={{ fontSize: '5rem', mb: 2 }}>🛒</Typography>
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.5rem', color: colors.textPrimary, mb: 2 }}>
            Your Cart is Empty
          </Typography>
          <Typography sx={{ color: colors.textMuted, mb: 4 }}>
            Explore our sacred goods from Nazareth
          </Typography>
          <Button
            component={Link}
            href={`/${locale}/shop`}
            variant="contained"
            startIcon={<ShoppingBagIcon />}
            sx={{ background: 'linear-gradient(135deg, #C9A84C, #8A6107)', color: '#1C1208', fontFamily: 'Cinzel, serif' }}
          >
            Continue Shopping
          </Button>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh', py: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <Typography
          component="h1"
          sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.5rem', md: '2rem' }, color: colors.textPrimary, mb: 4 }}
        >
          Shopping Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})
        </Typography>

        <Grid container spacing={4}>
          {/* Cart Items */}
          <Grid xs={12} md={8}>
            <Stack spacing={2}>
              {cart.map((item) => (
                <Paper
                  key={`${item._id}-${item.selectedColor}`}
                  elevation={1}
                  sx={{ p: { xs: 2, md: 3 }, display: 'flex', gap: 2.5, border: '1px solid rgba(201,168,76,0.12)' }}
                >
                  {/* Image */}
                  <Box
                    sx={{
                      width: { xs: 80, md: 100 },
                      height: { xs: 80, md: 100 },
                      borderRadius: 1,
                      overflow: 'hidden',
                      flexShrink: 0,
                      backgroundColor: colors.surface,
                    }}
                  >
                    {item.imageUrl || item.image ? (
                      <img
                        src={item.imageUrl || item.image}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>✝</Box>
                    )}
                  </Box>

                  {/* Details */}
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 600, fontSize: '0.95rem', color: colors.textPrimary, mb: 0.5 }}>
                      {item.name}
                    </Typography>
                    {item.selectedColor && (
                      <Typography sx={{ fontSize: '0.78rem', color: colors.textMuted, mb: 1 }}>
                        Color: {item.selectedColor}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                      {/* Qty stepper */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => updateQuantity(item._id, item.selectedColor, item.quantity - 1)}
                          sx={{ border: '1px solid rgba(201,168,76,0.3)', width: 28, height: 28 }}
                        >
                          <RemoveIcon sx={{ fontSize: '0.75rem' }} />
                        </IconButton>
                        <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 600, minWidth: 24, textAlign: 'center' }}>
                          {item.quantity}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => updateQuantity(item._id, item.selectedColor, item.quantity + 1)}
                          sx={{ border: '1px solid rgba(201,168,76,0.3)', width: 28, height: 28 }}
                        >
                          <AddIcon sx={{ fontSize: '0.75rem' }} />
                        </IconButton>
                      </Box>
                      <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1rem', color: colors.goldDark }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Remove */}
                  <IconButton
                    onClick={() => removeFromCart(item._id, item.selectedColor)}
                    size="small"
                    sx={{ color: colors.textMuted, alignSelf: 'flex-start', '&:hover': { color: colors.crimson } }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Paper>
              ))}
            </Stack>

            <Button
              onClick={clearCart}
              sx={{ color: colors.textMuted, fontFamily: 'Lato, sans-serif', fontSize: '0.78rem', mt: 2 }}
            >
              Clear cart
            </Button>
          </Grid>

          {/* Order Summary */}
          <Grid xs={12} md={4}>
            <Paper
              elevation={2}
              sx={{
                p: 3,
                border: '1px solid rgba(201,168,76,0.2)',
                position: { md: 'sticky' },
                top: { md: 90 },
              }}
            >
              <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1rem', color: colors.textPrimary, mb: 3 }}>
                Order Summary
              </Typography>

              <Stack spacing={1.5} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: colors.textSecondary, fontSize: '0.88rem' }}>Subtotal</Typography>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>${cartTotal.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: colors.textSecondary, fontSize: '0.88rem' }}>Shipping</Typography>
                  <Typography sx={{ fontSize: '0.88rem', color: colors.textMuted }}>Calculated at checkout</Typography>
                </Box>
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700 }}>Total</Typography>
                <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.2rem', color: colors.goldDark }}>
                  ${cartTotal.toFixed(2)}
                </Typography>
              </Box>

              <Button
                component={Link}
                href={`/${locale}/checkout`}
                variant="contained"
                fullWidth
                size="large"
                sx={{
                  background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
                  color: '#1C1208',
                  fontFamily: 'Cinzel, serif',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  py: 1.75,
                  mb: 1.5,
                  '&:hover': { background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' },
                }}
              >
                Proceed to Checkout
              </Button>
              <Button
                component={Link}
                href={`/${locale}/shop`}
                variant="outlined"
                fullWidth
                sx={{ borderColor: colors.gold, color: colors.goldDark, fontFamily: 'Cinzel, serif', fontSize: '0.78rem' }}
              >
                Continue Shopping
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
