import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useShopContext } from '../../context/shop-context';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import { alpha } from '@mui/material/styles';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { gold, goldDark, crimson, textSecondary, goldGradientText } from '../../theme';

export default function Cart() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cartItems, addToCart, decreaseFromCart, removeFromCart } = useShopContext();
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal > 100 ? 0 : 12.99;
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount + (discount > 0 ? 0 : shipping);

  const applyCoupon = () => {
    if (coupon.toUpperCase() === 'HOLY10') setDiscount(10);
    else if (coupon.toUpperCase() === 'NAZARETH15') setDiscount(15);
    else setDiscount(0);
  };

  const handleCheckout = () => {
    navigate('/checkout', { state: { cartItems, discountAmount } });
  };

  if (cartItems.length === 0) {
    return (
      <Box sx={{ backgroundColor: '#F7F2E8', minHeight: '80vh' }}>
        {/* Header */}
        <Box sx={{
          position: 'relative', py: { xs: 8, md: 12 },
          background: 'linear-gradient(160deg, #1C0E06 0%, #2C1810 50%, #1C0E06 100%)',
          textAlign: 'center', overflow: 'hidden',
          '&::after': { content: '""', position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', background: 'linear-gradient(to bottom, transparent, #F7F2E8)' },
        }}>
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <ShoppingCartIcon sx={{ color: gold, fontSize: '2.5rem', mb: 1, display: 'block', mx: 'auto' }} />
            <Typography variant="h1" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.6rem' }, ...goldGradientText }}>
              Your Cart
            </Typography>
          </Box>
        </Box>
        <Container maxWidth="sm" sx={{ py: { xs: 8, md: 12 }, textAlign: 'center' }}>
          <Box sx={{ fontSize: '4rem', mb: 3 }}>🛒</Box>
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1.2rem', color: '#1C1208', mb: 2 }}>
            Your cart is empty
          </Typography>
          <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.9rem', color: textSecondary, mb: 4 }}>
            Discover sacred items from the Holy Land of Nazareth.
          </Typography>
          <Button
            component={Link} to="/shop" variant="contained"
            sx={{ background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`, color: '#1C1208', px: 5 }}
          >
            Browse Shop
          </Button>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: '#F7F2E8', minHeight: '80vh' }}>
      {/* Header */}
      <Box sx={{
        position: 'relative', py: { xs: 8, md: 12 },
        background: 'linear-gradient(160deg, #1C0E06 0%, #2C1810 50%, #1C0E06 100%)',
        textAlign: 'center', overflow: 'hidden',
        '&::after': { content: '""', position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', background: 'linear-gradient(to bottom, transparent, #F7F2E8)' },
      }}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h1" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.6rem' }, ...goldGradientText }}>
            Your Cart ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        <Grid container spacing={{ xs: 3, md: 5 }}>
          {/* Cart Items */}
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {cartItems.map((item) => (
                <Paper
                  key={`${item._id}-${item.color}`}
                  elevation={0}
                  sx={{
                    p: { xs: 2, md: 3 }, borderRadius: '12px',
                    border: `1px solid ${alpha(gold, 0.18)}`,
                    boxShadow: `0 2px 12px ${alpha('#8A6107', 0.06)}`,
                  }}
                >
                  <Box sx={{ display: 'flex', gap: { xs: 2, md: 3 }, alignItems: 'center' }}>
                    {/* Image */}
                    <Box
                      component={Link}
                      to={`/shop/${item._id}`}
                      sx={{
                        width: { xs: 80, md: 100 }, height: { xs: 80, md: 100 },
                        borderRadius: '8px', overflow: 'hidden', flexShrink: 0,
                        border: `1px solid ${alpha(gold, 0.18)}`,
                      }}
                    >
                      <Box component="img" src={item.images?.[0] || '/images/placeholder.jpg'} alt={item.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>

                    {/* Info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        component={Link} to={`/shop/${item._id}`}
                        sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.85rem', fontWeight: 600, color: '#1C1208', textDecoration: 'none', display: 'block', mb: 0.5, '&:hover': { color: goldDark } }}
                      >
                        {item.name}
                      </Typography>
                      {item.color && (
                        <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.75rem', color: textSecondary, mb: 1 }}>
                          Color: {item.color}
                        </Typography>
                      )}
                      <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.95rem', fontWeight: 700, color: goldDark }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </Typography>
                    </Box>

                    {/* Quantity controls */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => decreaseFromCart(item._id, item.color)}
                        sx={{ border: `1px solid ${alpha(gold, 0.3)}`, width: 28, height: 28, '&:hover': { backgroundColor: alpha(gold, 0.1) } }}
                      >
                        <RemoveIcon sx={{ fontSize: '0.85rem' }} />
                      </IconButton>
                      <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.9rem', color: '#1C1208', minWidth: 28, textAlign: 'center' }}>
                        {item.quantity}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => addToCart(item)}
                        sx={{ border: `1px solid ${alpha(gold, 0.3)}`, width: 28, height: 28, '&:hover': { backgroundColor: alpha(gold, 0.1) } }}
                      >
                        <AddIcon sx={{ fontSize: '0.85rem' }} />
                      </IconButton>
                    </Box>

                    {/* Remove */}
                    <IconButton
                      onClick={() => removeFromCart(item._id, item.color)}
                      sx={{ color: alpha(crimson, 0.6), '&:hover': { color: crimson, background: alpha(crimson, 0.06) } }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Box>
                </Paper>
              ))}
            </Box>

            {/* Back to shop */}
            <Box sx={{ mt: 3 }}>
              <Button
                component={Link} to="/shop"
                variant="outlined"
                size="small"
                sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.12em', borderColor: alpha(gold, 0.4), color: goldDark }}
              >
                ← Continue Shopping
              </Button>
            </Box>
          </Grid>

          {/* Order Summary */}
          <Grid item xs={12} md={4}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 4 }, borderRadius: '12px',
                border: `1px solid ${alpha(gold, 0.2)}`,
                boxShadow: `0 4px 24px ${alpha('#8A6107', 0.1)}`,
                position: { md: 'sticky' }, top: { md: 90 },
                '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, borderRadius: '12px 12px 0 0' },
              }}
            >
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '0.95rem', color: '#1C1208', mb: 3, letterSpacing: '0.06em' }}>
                Order Summary
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.85rem', color: textSecondary }}>Subtotal</Typography>
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.85rem', color: '#1C1208' }}>${subtotal.toFixed(2)}</Typography>
                </Box>
                {discount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.85rem', color: '#4CAF50' }}>Coupon (-{discount}%)</Typography>
                    <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.85rem', color: '#4CAF50' }}>-${discountAmount.toFixed(2)}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.85rem', color: textSecondary, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LocalShippingIcon sx={{ fontSize: '0.9rem' }} /> Shipping
                  </Typography>
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.85rem', color: shipping === 0 ? '#4CAF50' : '#1C1208' }}>
                    {shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}
                  </Typography>
                </Box>
              </Box>

              {/* Coupon */}
              <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                <TextField
                  size="small" label="Coupon code" value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Button onClick={applyCoupon} variant="outlined" size="small" sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.62rem', letterSpacing: '0.08em', borderColor: alpha(gold, 0.4), color: goldDark, whiteSpace: 'nowrap' }}>
                  Apply
                </Button>
              </Box>

              <Divider sx={{ mb: 2, borderColor: alpha(gold, 0.2) }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1rem', color: '#1C1208' }}>Total</Typography>
                <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1.1rem', color: goldDark }}>${total.toFixed(2)}</Typography>
              </Box>

              <Button
                fullWidth variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={handleCheckout}
                sx={{
                  background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                  color: '#1C1208', py: 1.5,
                  boxShadow: `0 4px 20px ${alpha(gold, 0.35)}`,
                  '&:hover': { boxShadow: `0 8px 32px ${alpha(gold, 0.5)}`, transform: 'translateY(-2px)' },
                }}
              >
                Proceed to Checkout
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
