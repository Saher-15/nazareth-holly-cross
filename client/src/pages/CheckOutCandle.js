import React from 'react';
import PaypalCandle from '../components/PaypalCandle';
import { useLocation } from 'react-router-dom';

function CheckOutCandle() {
  const location = useLocation();
  const { form } = location.state;

  return <PaypalCandle form={form} />;
}

export default CheckOutCandle;
