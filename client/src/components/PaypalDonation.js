import React, { useState, useCallback } from 'react';
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation
import { useTranslation } from 'react-i18next';
import "../styles/FaithShared.css";
import "../styles/PaypalCandle.css";
import { PAYPAL_CLIENT_ID } from '../config/env';
import usePayPalOrder from '../payments/usePayPalOrder';
import PageHero from './ui/PageHero';

const PayPalComponent = ({ name, amount }) => {
    const { t } = useTranslation();
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
        <main className={`ui-page fx fx-hero-plain fx-co ${thankYouMessage ? 'is-paid' : ''}`}>
            <PageHero
                eyebrow={t('faithUi.checkoutEyebrow')}
                title={t('faithUi.donationTitle')}
                lead={t('faithUi.checkoutLead')}
            />

            <div className="ui-container fx-co__grid">
                {/* Display form summary */}
                <section className="fx-co__main ui-glass" aria-labelledby="fx-co-summary">
                    <p className="fx-co__step"><span className="fx-co__stepn" aria-hidden="true">1</span>{t('faithUi.stepDetails')}</p>
                    <h2 id="fx-co-summary" className="fx-co__title">{t('faithUi.donationSummary')}</h2>
                    <dl className="fx-co__details">
                        <div><dt>{t('faithUi.name')}</dt><dd>{name}</dd></div>
                        <div><dt>{t('faithUi.donation')}</dt><dd>{amount}$</dd></div>
                    </dl>
                    <button
                        type="button"
                        className={`ui-btn ${paymentConfirmed ? 'ui-btn--ghost' : 'ui-btn--gold'} fx-btn-lg fx-co__confirm`}
                        onClick={handleConfirmPayment}
                    >
                        {paymentConfirmed && <i className="fas fa-check" aria-hidden="true" />}
                        {paymentConfirmed ? t('confirmed') : t('confirmDetails')}
                    </button>
                </section>

                {/* PayPal buttons appear here once the details are confirmed */}
                <aside className="fx-co__side ui-glass" aria-labelledby="fx-co-pay">
                    <p className="fx-co__step"><span className="fx-co__stepn" aria-hidden="true">2</span>{t('faithUi.stepPayment')}</p>
                    <h2 id="fx-co-pay" className="fx-co__title">{t('paypalComponent.paymentMethod')}</h2>
                    <div className="fx-co__total">
                        <span>{t('faithUi.donation')}</span>
                        <strong>{amount}$</strong>
                    </div>

                    <div className="paypal-card1">
                        <PayPalScriptProvider options={initialOptions}>
                            {!showConfirmation && paymentConfirmed && (
                                <div className="paypal-buttons-container fx-co__paypal">
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
                        {!paymentConfirmed && (
                            <p className="fx-alert fx-alert--info">
                                <i className="fas fa-info-circle" aria-hidden="true" />
                                {t('faithUi.confirmFirst')}
                            </p>
                        )}
                    </div>

                    {showAlert && (
                        <div className="fx-alert fx-alert--danger fx-co__cancel" role="alert">
                            <i className="fas fa-times-circle" aria-hidden="true" />
                            <p>{t('faithUi.paymentCancelled')}</p>
                        </div>
                    )}

                    {thankYouMessage && (
                        <div className="fx-done" role="status">
                            <span className="fx-done__icon" aria-hidden="true"><i className="fas fa-heart" /></span>
                            <p className="fx-done__title">{t('faithUi.donationThanks')}</p>
                        </div>
                    )}

                    <p className="fx-co__secure">
                        <i className="fas fa-lock" aria-hidden="true" />
                        {t('faithUi.securedBy')}
                    </p>
                </aside>
            </div>
        </main>
    );
};

export default PayPalComponent;
