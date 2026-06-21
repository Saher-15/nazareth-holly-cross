import React, { useEffect } from 'react';
import { API_URL } from '../config.js';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useShopContext } from '../context/shop-context';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { gold, goldLight, crimson, goldGradientText } from '../theme';

function ConfirmationOrder({ cartItems, firstName, lastName, phone, email, street, city, state, postal, country, totalPrice }) {
  const { clearCart } = useShopContext();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const send = async () => {
      try {
        await axios.post(`${API_URL}/order/newOrder`, {
          firstName, lastName, phone, email, street, city, state, postal, country, totalPrice,
          products: cartItems.map(item => ({
            productID: item._id,
            productName: item.name,
            quantity: item.quantity,
            color: item.color,
          })),
        });
        clearCart();
        setTimeout(() => navigate('/'), 5000);
      } catch (err) {
        console.error('Error sending order:', err);
      }
    };
    send();
  }, [cartItems, firstName, lastName, phone, email, street, city, state, postal, country, totalPrice, navigate, clearCart]);

  const summaryRows = [
    { label: 'Name', value: `${firstName} ${lastName}` },
    { label: 'Email', value: email },
    { label: 'Ship to', value: `${street}, ${city}, ${state} ${postal}, ${country}` },
    { label: 'Total Paid', value: `$${totalPrice}`, highlight: true },
  ];

  return (
    <Box
      sx={{
        mt: 3,
        p: { xs: 3, md: 4 },
        background: `linear-gradient(145deg, ${alpha('#0A1A0D', 0.95)} 0%, ${alpha('#0D0810', 0.98)} 100%)`,
        border: `1px solid ${alpha('#4CAF50', 0.3)}`,
        borderRadius: '16px',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent, #4CAF50, ${gold}, #4CAF50, transparent)`,
        },
      }}
    >
      {/* Success icon */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Box sx={{ position: 'relative', display: 'inline-block' }}>
          <CheckCircleOutlineIcon
            sx={{
              fontSize: '3.5rem',
              color: '#66BB6A',
              filter: `drop-shadow(0 0 16px ${alpha('#4CAF50', 0.7)})`,
              animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              '@keyframes popIn': {
                '0%': { transform: 'scale(0)', opacity: 0 },
                '100%': { transform: 'scale(1)', opacity: 1 },
              },
            }}
          />
        </Box>

        <Typography
          sx={{
            fontFamily: '"Cinzel", serif',
            fontWeight: 700,
            fontSize: { xs: '1.3rem', md: '1.6rem' },
            ...goldGradientText,
            mt: 1.5, mb: 0.5,
          }}
        >
          {t('thankYou.thankYou')}
        </Typography>

        <Box sx={{ width: 50, height: 1, mx: 'auto', background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
      </Box>

      {/* Messages */}
      {[t('thankYou.paymentSuccess'), t('thankYou.receipt')].map((text, i) => (
        <Typography
          key={i}
          sx={{
            fontFamily: '"Lato", sans-serif',
            fontWeight: 300,
            fontSize: '0.88rem',
            color: alpha(goldLight, 0.65),
            textAlign: 'center',
            lineHeight: 1.8,
            mb: 1,
          }}
        >
          {text}
        </Typography>
      ))}

      <Divider sx={{ my: 2.5, borderColor: alpha(gold, 0.1) }} />

      {/* Order summary */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <LocalShippingOutlinedIcon sx={{ fontSize: '0.9rem', color: alpha(gold, 0.6) }} />
        <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.2em', color: alpha(gold, 0.6), textTransform: 'uppercase' }}>
          Order Details
        </Typography>
      </Box>

      {summaryRows.map(({ label, value, highlight }, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: 1.2,
            borderBottom: i < summaryRows.length - 1 ? `1px solid ${alpha(gold, 0.06)}` : 'none',
          }}
        >
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.1em', color: alpha(gold, 0.5), textTransform: 'uppercase' }}>
            {label}
          </Typography>
          <Typography
            sx={{
              fontFamily: highlight ? '"Cinzel", serif' : '"Lato", sans-serif',
              fontWeight: highlight ? 700 : 400,
              fontSize: highlight ? '1.2rem' : '0.85rem',
              color: highlight ? gold : alpha(goldLight, 0.75),
              maxWidth: '60%',
              textAlign: 'right',
            }}
          >
            {value}
          </Typography>
        </Box>
      ))}

      <Box sx={{ mt: 3 }}>
        <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.78rem', color: alpha(goldLight, 0.35), textAlign: 'center', fontStyle: 'italic', mb: 1 }}>
          {t('thankYou.gratitude')}
        </Typography>
        <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.6rem', letterSpacing: '0.2em', color: alpha(gold, 0.4), textTransform: 'uppercase', textAlign: 'center', mb: 1 }}>
          Redirecting to home
        </Typography>
        <LinearProgress
          sx={{
            height: 2,
            borderRadius: 1,
            backgroundColor: alpha('#4CAF50', 0.12),
            '& .MuiLinearProgress-bar': {
              background: `linear-gradient(90deg, #4CAF50, ${gold})`,
            },
          }}
        />
      </Box>
    </Box>
  );
}

export default ConfirmationOrder;
