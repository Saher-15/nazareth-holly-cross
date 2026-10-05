import React from 'react';
import '../App.css';
import PaypalCandle from '../components/PaypalCandle';
import { useLocation } from 'react-router-dom';



function CheckOut() {

    const location = useLocation();

    const {form}=location.state;

    return (
        <>
            <PaypalCandle  form={form} />
        </>
    );
}

export default CheckOut;