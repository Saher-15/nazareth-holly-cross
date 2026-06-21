import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShopContext } from '../../context/shop-context';
import CartItem from './cartItem';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DiscountIcon from '@mui/icons-material/Discount';
import { gold, goldLight, goldDark, crimson, goldGradientText } from '../../theme';

const Cart = () => {
  const { t } = useTranslation();
  const { cartItems } = useShopContext();
  const navigate = useNavigate();
  const [totalAmount, setTotalAmount] = useState(0);
  const [discountAmount, setdiscountAmount] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let total = 0;
    cartItems.forEach((item) => {
      total += item.price * item.quantity;
    });
    setTotalAmount(total + 5);
    setdiscountAmount(total * 0.9 + 5);
  }, [cartItems]);

  const hasItems = totalAmount > 5;

  return (
    <Box sx={{ minHeight: '80vh', py: { xs: 6, md: 10 }, px: { xs: 2, sm: 3 } }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography
            variant="h3"
            sx={{
              fontFamily: '"Cinzel", serif',
              fontWeight: 700,
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              ...goldGradientText,
              mb: 1,
            }}
          >
            {t('cart.emptyCart') && hasItems ? 'Your Cart' : 'Shopping Cart'}
          </Typography>
          <Box sx={{ width: 60, height: 2, mx: 'auto', background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
        </Box>

        {hasItems ? (
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 4, alignItems: 'flex-start' }}>
            {/* Cart Items */}
            <Box sx={{ flex: 1 }}>
              {cartItems.map((product) => (
                <CartItem key={`${product._id}-${product.color}`} data={product} />
              ))}
            </Box>

            {/* Order Summary */}
            <Paper
              elevation={0}
              sx={{
                width: { xs: '100%', lg: 340 },
                p: 4,
                background: `linear-gradient(145deg, ${alpha('#1A1215', 0.9)} 0%, ${alpha('#0D0810', 0.95)} 100%)`,
                border: `1px solid ${alpha(gold, 0.2)}`,
                borderRadius: '12px',
                position: 'sticky',
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
              <Typography
                sx={{
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.75rem',
                  letterSpacing: '0.25em',
                  color: gold,
                  textTransform: 'uppercase',
                  mb: 3,
                }}
              >
                Order Summary
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: alpha(goldLight, 0.65), fontSize: '0.85rem' }}>
                  <LocalShippingIcon sx={{ fontSize: '1rem', color: alpha(gold, 0.6) }} />
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.85rem', color: alpha(goldLight, 0.65) }}>
                    {t('cart.shipping')}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ borderColor: alpha(gold, 0.12), mb: 2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.85rem', color: alpha(goldLight, 0.5), textDecoration: 'line-through' }}>
                  ${totalAmount.toFixed(2)}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DiscountIcon sx={{ fontSize: '1rem', color: alpha(gold, 0.7) }} />
                  <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.75rem', letterSpacing: '0.1em', color: gold }}>
                    10% OFF
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1.3rem', ...goldGradientText }}>
                  ${discountAmount.toFixed(2)}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => navigate('/checkout', { state: { discountAmount, cartItems } })}
                  sx={{
                    background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                    color: '#0a0608',
                    py: 1.5,
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.75rem',
                    letterSpacing: '0.15em',
                    boxShadow: `0 4px 20px ${alpha(gold, 0.35)}`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${goldLight} 0%, ${gold} 100%)`,
                      boxShadow: `0 8px 30px ${alpha(gold, 0.55)}`,
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  {t('cart.checkout')}
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/shop')}
                  sx={{
                    borderColor: alpha(gold, 0.3),
                    color: alpha(goldLight, 0.7),
                    py: 1.5,
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.7rem',
                    letterSpacing: '0.12em',
                    '&:hover': {
                      borderColor: alpha(gold, 0.6),
                      backgroundColor: alpha(gold, 0.06),
                    },
                  }}
                >
                  {t('cart.continueShopping')}
                </Button>
              </Box>
            </Paper>
          </Box>
        ) : (
          <Box
            sx={{
              textAlign: 'center',
              py: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <ShoppingCartIcon sx={{ fontSize: '4rem', color: alpha(gold, 0.25) }} />
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontStyle: 'italic',
                fontSize: '1.3rem',
                color: alpha(goldLight, 0.45),
              }}
            >
              {t('cart.emptyCart')}
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/shop')}
              sx={{
                background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                color: '#0a0608',
                px: 4,
                py: 1.5,
                fontFamily: '"Cinzel", serif',
                fontSize: '0.75rem',
                letterSpacing: '0.15em',
                boxShadow: `0 4px 20px ${alpha(gold, 0.3)}`,
                '&:hover': {
                  background: `linear-gradient(135deg, ${goldLight} 0%, ${gold} 100%)`,
                  boxShadow: `0 8px 28px ${alpha(gold, 0.5)}`,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              {t('cart.backToShopping')}
            </Button>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default Cart;
