import React, { useState } from 'react';
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation
import "../styles/PaypalCandle.css";
import { API_URL } from '../config';

const PayPalComponent = ({ name, amount }) => {
    const [paymentConfirmed, setPaymentConfirmed] = useState(false); // State to control payment initiation
    const [showAlert, setShowAlert] = useState(false); // State to control visibility of alert
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [thankYouMessage, setThankYouMessage] = useState(false); // State for thank you message
    const navigate = useNavigate(); // Initialize useNavigate

    const initialOptions = {
        clientId: "AfhOc9ToAj72gf5KEowYfhpWShGRSpzSL-Ps2HYX4ky95KmVX8vNRb0o5FZ3AGw3muq8DIvDP0Ua2_ad"
    };

    const intent = 'capture'; // Set your intent variable here

    const onCancel = (data) => {
        setShowAlert(true);
        // Set a timer to hide the alert after 2 seconds
        setTimeout(() => {
            setShowAlert(false);
        }, 2000);
    };

    const onError = (err) => {
        // Handle error
    };

    const createOrder = async () => {
        try {
            const response = await fetch(`${API_URL}/order/create_order`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify({ "intent": intent, "amount": amount })
            });

            if (!response.ok) {
                throw new Error('Failed to create order');
            }

            const order = await response.json();

            return order.id;
        } catch (error) {
            console.error('Error creating order:');
            // Handle error here
        }
    };

    const onApprove = async (data, actions) => {
        const order_id = data.orderID;

        const requestBody = {
            "intent": intent,
            "order_id": order_id
        };

        await fetch(`${API_URL}/order/complete_order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify(requestBody)
        })
            .then((response) => {
                setPaymentConfirmed(true);
                setShowConfirmation(true);
                setThankYouMessage(true); // Show thank you message
                setTimeout(() => {
                    navigate('/'); // Navigate to the homepage after 5 seconds
                }, 5000);
                response.json();
            })
            .catch((error) => {
                console.error('Error completing order:');
            });
    };

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
