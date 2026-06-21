import React from 'react';
import PaypalDonation from '../components/PaypalDonation';
import { useLocation } from 'react-router-dom';

function CheckOutDonation() {
  const location = useLocation();
  const { name } = location.state;
  const { amount } = location.state;

  return <PaypalDonation name={name} amount={amount} />;
}

export default CheckOutDonation;
