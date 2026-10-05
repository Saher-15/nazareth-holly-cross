import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import '../App.css';
import Paypal from '../components/Paypal';
import PaypalCandle from '../components/PaypalCandle';
import PaypalDonation from '../components/PaypalDonation';

// One checkout page for the three payment flows. Each flow receives its data through
// router state; opening a checkout URL directly (no state) sends the visitor back.
const FLOWS = {
  order: {
    back: '/cart',
    ready: (s) => s.cartItems && s.discountAmount !== undefined,
    render: (s) => <Paypal discountAmount={s.discountAmount} cartItems={s.cartItems} />,
  },
  candle: {
    back: '/candle',
    ready: (s) => s.form,
    render: (s) => <PaypalCandle form={s.form} />,
  },
  donation: {
    back: '/',
    ready: (s) => s.name !== undefined && s.amount !== undefined,
    render: (s) => <PaypalDonation name={s.name} amount={s.amount} />,
  },
};

export default function Checkout({ flow }) {
  const { state } = useLocation();
  const { back, ready, render } = FLOWS[flow];

  if (!state || !ready(state)) return <Navigate to={back} replace />;
  return render(state);
}
