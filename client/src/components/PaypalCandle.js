import React, { useState, useCallback } from 'react';
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useTranslation } from 'react-i18next';
import "../styles/PaypalCandle.css";
import ConfirmationCandle from '../components/ConfirmationCandle';
import { PAYPAL_CLIENT_ID } from '../config/env';
import usePayPalOrder from '../payments/usePayPalOrder';

const PayPalComponent = ({ form }) => {
    const { t } = useTranslation(); // Hook to use translations
    const [paymentConfirmed, setPaymentConfirmed] = useState(false);
    const [showAlert, setShowAlert] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const initialOptions = {
        clientId: PAYPAL_CLIENT_ID
    };


    const onCancel = (data) => {
        setShowAlert(true);
        setTimeout(() => {
            setShowAlert(false);
        }, 2000);
    };


    const getPayload = useCallback(() => ({ type: 'candle', amount: '3' }), []);
    const onPaid = useCallback(() => {
        setShowConfirmation(true);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const { createOrder, onApprove, onError, error: payError } = usePayPalOrder({ getPayload, onPaid });

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
                            {payError && <p className="payment-error" role="alert">{payError}</p>}
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
