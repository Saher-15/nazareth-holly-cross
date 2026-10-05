import React, { useState, useCallback } from 'react';
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation
import "../styles/PaypalCandle.css";
import { PAYPAL_CLIENT_ID } from '../config/env';
import usePayPalOrder from '../payments/usePayPalOrder';

const PayPalComponent = ({ name, amount }) => {
    const [paymentConfirmed, setPaymentConfirmed] = useState(false); // State to control payment initiation
    const [showAlert, setShowAlert] = useState(false); // State to control visibility of alert
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [thankYouMessage, setThankYouMessage] = useState(false); // State for thank you message
    const navigate = useNavigate(); // Initialize useNavigate

    const initialOptions = {
        clientId: PAYPAL_CLIENT_ID
    };


    const onCancel = (data) => {
        setShowAlert(true);
        // Set a timer to hide the alert after 2 seconds
        setTimeout(() => {
            setShowAlert(false);
        }, 2000);
    };


    const getPayload = useCallback(() => ({ type: 'donation', amount }), [amount]);
    const onPaid = useCallback(() => {
        setPaymentConfirmed(true);
        setShowConfirmation(true);
        setThankYouMessage(true); // Show thank you message
        setTimeout(() => {
            navigate('/'); // Navigate to the homepage after 5 seconds
        }, 5000);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const { createOrder, onApprove, onError, error: payError } = usePayPalOrder({ getPayload, onPaid });

    const handleConfirmPayment = () => {
        setPaymentConfirmed(true);
    };

    return (
        <div className="App-paypal-candle">
            {/* Display form summary */}
            <div className="form-summary">
                <h2>Donation Summary</h2>
                <p><strong>Name:</strong> {name}</p>
                <p><strong>Donation:</strong> {amount}$</p>
                <button onClick={handleConfirmPayment}>
                    {paymentConfirmed ? "Confirmed" : "Confirm Details & Pay"}
                </button>
            </div>

            {/* Render PayPalButtons right below the form */}
            <div className="paypal-card1">
                <PayPalScriptProvider options={initialOptions}>
                    {!showConfirmation && paymentConfirmed && (
                        <div className="paypal-buttons-container">
                            <PayPalButtons
                                createOrder={createOrder}
                                onApprove={onApprove}
                                onCancel={onCancel}
                                onError={onError}
                            />
                            {payError && <p className="payment-error" role="alert">{payError}</p>}
                        </div>
                    )}
                </PayPalScriptProvider>
            </div>

            {showAlert && (
                <div className="ms-alert ms-action2 ms-small">
                    <span className="ms-close"></span>
                    <p>Cancelled!</p>
                </div>
            )}

            {thankYouMessage && (
                <div style={styles.container}>
                    <p>Thank you for your donation!</p>
                </div>
            )}
        </div>
    );
};
const styles = {
    container: {
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        padding: '20px',
        backgroundColor: '#f4f4f4',
        margin: 0,
    },
};
export default PayPalComponent;
