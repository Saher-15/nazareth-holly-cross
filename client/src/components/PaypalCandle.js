import React, { useState } from 'react';
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useTranslation } from 'react-i18next';
import "../styles/PaypalCandle.css";
import ConfirmationCandle from '../components/ConfirmationCandle';
import { API_URL } from '../config';

const PayPalComponent = ({ form }) => {
    const { t } = useTranslation(); // Hook to use translations
    const [paymentConfirmed, setPaymentConfirmed] = useState(false);
    const [showAlert, setShowAlert] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const initialOptions = {
        clientId: "AfhOc9ToAj72gf5KEowYfhpWShGRSpzSL-Ps2HYX4ky95KmVX8vNRb0o5FZ3AGw3muq8DIvDP0Ua2_ad"
    };

    const intent = 'capture';

    const onCancel = (data) => {
        setShowAlert(true);
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
                body: JSON.stringify({ "intent": intent, "amount": "3" })
            });

            if (!response.ok) {
                throw new Error('Failed to create order');
            }

            const order = await response.json();
            return order.id;
        } catch (error) {
            console.error('Error creating order:');
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
                setShowConfirmation(true);
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
            <div className="form-summary">
                <h2>{t("orderSummary")}</h2>
                <p><strong>{t("firstName")}</strong> {form.firstname}</p>
                <p><strong>{t("lastName")}</strong> {form.lastname}</p>
                <p><strong>{t("email")}</strong> {form.email}</p>
                <p><strong>{t("prayerAt")}</strong> {form.pray}</p>
                <p><strong>{t("cost")}</strong> 3$</p>

                <button onClick={handleConfirmPayment}>
                    {paymentConfirmed ? t("confirmed") : t("confirmDetails")}
                </button>
            </div>

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
                {showConfirmation && (
                    <ConfirmationCandle
                        firstName={form.firstname}
                        lastName={form.lastname}
                        email={form.email}
                        prayer={form.pray}
                    />
                )}
            </div>

            {showAlert && (
                <div className="ms-alert ms-action2 ms-small">
                    <span className="ms-close"></span>
                    <p>{t("orderCancelled")}</p>
                </div>
            )}
        </div>
    );
};

export default PayPalComponent;
