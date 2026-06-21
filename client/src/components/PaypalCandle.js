import { API_URL } from '../config.js';
import React, { useState } from 'react';
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useTranslation } from 'react-i18next';
import ConfirmationCandle from '../components/ConfirmationCandle';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { gold, goldLight, goldDark, crimson, goldGradientText } from '../theme';

const initialOptions = {
  clientId: "AfhOc9ToAj72gf5KEowYfhpWShGRSpzSL-Ps2HYX4ky95KmVX8vNRb0o5FZ3AGw3muq8DIvDP0Ua2_ad"
};

const PayPalCandle = ({ form }) => {
  const { t } = useTranslation();
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const intent = 'capture';

  const onCancel = () => {
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 2500);
  };

  const createOrder = async () => {
    try {
      const response = await fetch(`${API_URL}/order/create_order`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ intent, amount: "3" })
      });
      if (!response.ok) throw new Error('Failed to create order');
      const order = await response.json();
      return order.id;
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const onApprove = async (data) => {
    await fetch(`${API_URL}/order/complete_order`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ intent, order_id: data.orderID })
    }).then(() => setShowConfirmation(true)).catch(console.error);
  };

  return (
    <Box sx={{ minHeight: '80vh', py: { xs: 6, md: 10 }, px: { xs: 2, sm: 3 } }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <LocalFireDepartmentIcon sx={{ fontSize: '2rem', color: alpha(crimson, 0.8), mb: 1 }} />
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.6rem', md: '2rem' }, ...goldGradientText }}>
            {t('orderSummary')}
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
            { label: t('firstName'), value: form.firstname },
            { label: t('lastName'), value: form.lastname },
            { label: t('email'), value: form.email },
            { label: t('prayerAt'), value: form.pray },
          ].map(({ label, value }, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 1.5, borderBottom: i < 3 ? `1px solid ${alpha(gold, 0.08)}` : 'none' }}>
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.12em', color: alpha(gold, 0.65), textTransform: 'uppercase' }}>
                {label}
              </Typography>
              <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 400, fontSize: '0.88rem', color: alpha(goldLight, 0.8), maxWidth: '60%', textAlign: 'right' }}>
                {value}
              </Typography>
            </Box>
          ))}

          <Divider sx={{ my: 2, borderColor: alpha(gold, 0.15) }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.75rem', letterSpacing: '0.15em', color: alpha(gold, 0.7), textTransform: 'uppercase' }}>
              {t('cost')}
            </Typography>
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1.4rem', ...goldGradientText }}>
              $3.00
            </Typography>
          </Box>

          <Button
            fullWidth
            variant="contained"
            startIcon={paymentConfirmed ? <CheckCircleOutlineIcon /> : undefined}
            onClick={() => setPaymentConfirmed(true)}
            disabled={paymentConfirmed}
            sx={{
              mt: 3,
              background: paymentConfirmed
                ? `linear-gradient(135deg, #2E7D32, #388E3C)`
                : `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
              color: '#0a0608',
              py: 1.5,
              fontFamily: '"Cinzel", serif',
              fontSize: '0.78rem',
              letterSpacing: '0.15em',
              boxShadow: `0 4px 20px ${alpha(gold, 0.3)}`,
              '&:hover:not(:disabled)': {
                background: `linear-gradient(135deg, ${goldLight} 0%, ${gold} 100%)`,
                boxShadow: `0 8px 28px ${alpha(gold, 0.5)}`,
                transform: 'translateY(-2px)',
              },
              '&.Mui-disabled': { opacity: 0.85, color: '#0a0608' },
            }}
          >
            {paymentConfirmed ? t('confirmed') : t('confirmDetails')}
          </Button>
        </Paper>

        {showAlert && (
          <Alert severity="info" sx={{ mb: 3, backgroundColor: alpha('#1565C0', 0.12), border: `1px solid ${alpha('#1565C0', 0.3)}` }}>
            {t('orderCancelled')}
          </Alert>
        )}

        {paymentConfirmed && !showConfirmation && (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              background: `linear-gradient(145deg, ${alpha('#1A1215', 0.9)} 0%, ${alpha('#0D0810', 0.95)} 100%)`,
              border: `1px solid ${alpha(gold, 0.15)}`,
              borderRadius: '12px',
            }}
          >
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.2em', color: alpha(gold, 0.65), textTransform: 'uppercase', mb: 2, textAlign: 'center' }}>
              Payment Method
            </Typography>
            <PayPalScriptProvider options={initialOptions}>
              <PayPalButtons
                createOrder={createOrder}
                onApprove={onApprove}
                onCancel={onCancel}
                onError={() => {}}
              />
            </PayPalScriptProvider>
          </Paper>
        )}

        {showConfirmation && (
          <ConfirmationCandle
            firstName={form.firstname}
            lastName={form.lastname}
            email={form.email}
            prayer={form.pray}
          />
        )}
      </Container>
    </Box>
  );
};

export default PayPalCandle;
