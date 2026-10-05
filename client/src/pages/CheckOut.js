import React from 'react';
import '../App.css';
import Paypal from '../components/Paypal';
import { useLocation } from 'react-router-dom';



function CheckOut() {

  const location = useLocation();
  const { discountAmount } = location.state;
  const { cartItems } = location.state;

  return (
    <>
      <Paypal discountAmount = {discountAmount} cartItems={cartItems} />
    </>
  );
}

export default CheckOut;