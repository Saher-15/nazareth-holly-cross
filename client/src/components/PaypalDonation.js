import React, { useState } from 'react';
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import { alpha } from '@mui/material/styles';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { gold, goldLight, goldDark, crimson, goldGradientText } from '../theme';

const initialOptions = {
  clientId: "AfhOc9ToAj72gf5KEowYfhpWShGRSpzSL-Ps2HYX4ky95KmVX8vNRb0o5FZ3AGw3muq8DIvDP0Ua2_ad"
};

const PayPalDonation = ({ name, amount }) => {
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [thankYouMessage, setThankYouMessage] = useState(false);
  const [showPaypal, setShowPaypal] = useState(false);
  const navigate = useNavigate();
  const intent = 'capture';

  const onCancel = () => {
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 2500);
  };

  const createOrder = async () => {
    try {
      const response = await fetch("https://nazareth-holy-cross-c5896e0462c5.herokuapp.com/order/create_order", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ intent, amount })
      });
      if (!response.ok) throw new Error('Failed to create order');
      const order = await response.json();
      return order.id;
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const onApprove = async (data) => {
    await fetch("https://nazareth-holy-cross-c5896e0462c5.herokuapp.com/order/complete_order", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ intent, order_id: data.orderID })
    }).then(() => {
      setPaymentConfirmed(true);
      setThankYouMessage(true);
      setShowPaypal(false);
      setTimeout(() => navigate('/'), 5000);
    }).catch(console.error);
  };

  return (
    <Box sx={{ minHeight: '80vh', py: { xs: 6, md: 10 }, px: { xs: 2, sm: 3 } }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <FavoriteIcon sx={{ fontSize: '2rem', color: alpha(crimson, 0.8), mb: 1 }} />
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.6rem', md: '2rem' }, ...goldGradientText }}>
            Donation Summary
          </Typography>
          <Box sx={{ width: 50, height: 2, mx: 'auto', mt: 1, background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            background: `linear-gradient(145deg, ${alpha('#1A1215', 0.9)} 0%, ${alpha('#0D0810', 0.95)} 100%)`,
            border: `1px solid ${alpha(gold, 0.15)}`,
            borderRadius: '12px',
            position: 'relative',
            mb: 3,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: '2px',
              borderRadius: '12px 12px 0 0',
              background: `linear-gradient(90deg, transparent, ${gold}, transparent)`,
            },
          }}
        >
          {[
            { label: 'Name', value: name },
            { label: 'Donation Amount', value: `$${amount}` },
          ].map(({ label, value }, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 1.5, borderBottom: i === 0 ? `1px solid ${alpha(gold, 0.08)}` : 'none' }}>
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.12em', color: alpha(gold, 0.65), textTransform: 'uppercase' }}>
                {label}
              </Typography>
              <Typography sx={{ fontFamily: i === 1 ? '"Cinzel", serif' : '"Lato", sans-serif', fontWeight: i === 1 ? 700 : 400, fontSize: i === 1 ? '1.3rem' : '0.88rem', color: i === 1 ? gold : alpha(goldLight, 0.8) }}>
                {value}
              </Typography>
            </Box>
          ))}

          <Divider sx={{ my: 2, borderColor: alpha(gold, 0.12) }} />

          <Button
            fullWidth
            variant="contained"
            startIcon={paymentConfirmed ? <CheckCircleOutlineIcon /> : undefined}
            onClick={() => { setShowPaypal(true); }}
            disabled={showPaypal || thankYouMessage}
            sx={{
              background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
              color: '#0a0608',
              py: 1.5,
              fontFamily: '"Cinzel", serif',
              fontSize: '0.78rem',
              letterSpacing: '0.15em',
              boxShadow: `0 4px 20px ${alpha(gold, 0.3)}`,
              '&:hover:not(:disabled)': { background: `linear-gradient(135deg, ${goldLight} 0%, ${gold} 100%)`, boxShadow: `0 8px 28px ${alpha(gold, 0.5)}`, transform: 'translateY(-2px)' },
              '&.Mui-disabled': { opacity: 0.85, color: '#0a0608' },
            }}
          >
            Confirm Details & Pay
          </Button>
        </Paper>

        <Collapse in={showAlert}>
          <Alert severity="info" sx={{ mb: 3, backgroundColor: alpha('#1565C0', 0.12), border: `1px solid ${alpha('#1565C0', 0.3)}` }}>
            Payment cancelled.
          </Alert>
        </Collapse>

        <Collapse in={thankYouMessage}>
          <Alert severity="success" icon={<FavoriteIcon />} sx={{ mb: 3, backgroundColor: alpha('#2E7D32', 0.12), border: `1px solid ${alpha('#2E7D32', 0.3)}`, color: goldLight, '& .MuiAlert-icon': { color: '#66BB6A' } }}>
            Thank you for your generous donation! Redirecting you home...
          </Alert>
        </Collapse>

        {showPaypal && !thankYouMessage && (
          <Paper elevation={0} sx={{ p: 3, background: `linear-gradient(145deg, ${alpha('#1A1215', 0.9)} 0%, ${alpha('#0D0810', 0.95)} 100%)`, border: `1px solid ${alpha(gold, 0.15)}`, borderRadius: '12px' }}>
            <PayPalScriptProvider options={initialOptions}>
              <PayPalButtons createOrder={createOrder} onApprove={onApprove} onCancel={onCancel} onError={() => {}} />
            </PayPalScriptProvider>
          </Paper>
        )}
      </Container>
    </Box>
  );
};

export default PayPalDonation;
