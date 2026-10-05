import React from 'react';
import '../App.css';
import PaypalDonation from '../components/PaypalDonation'
import { useLocation } from 'react-router-dom';



function CheckOut() {

    const location = useLocation();

    const {name}=location.state;
    const {amount}=location.state;

    return (
        <>
            <PaypalDonation  name={name} amount={amount} />
        </>
    );
}

export default CheckOut;