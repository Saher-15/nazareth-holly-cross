import React, { useState, useCallback } from 'react';
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useTranslation } from 'react-i18next';
import "../styles/FaithShared.css";
import "../styles/PaypalCandle.css";
import ConfirmationCandle from '../components/ConfirmationCandle';
import { PAYPAL_CLIENT_ID } from '../config/env';
import usePayPalOrder from '../payments/usePayPalOrder';
import PageHero from './ui/PageHero';

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
        <main className={`ui-page fx fx-hero-plain fx-co ${showConfirmation ? 'is-paid' : ''}`}>
            <PageHero
                eyebrow={t('faithUi.checkoutEyebrow')}
                title={t('faithUi.candleCheckoutTitle')}
                lead={t('faithUi.checkoutLead')}
            />

            <div className="ui-container fx-co__grid">
                <section className="fx-co__main ui-glass" aria-labelledby="fx-co-summary">
                    <p className="fx-co__step"><span className="fx-co__stepn" aria-hidden="true">1</span>{t('faithUi.stepDetails')}</p>
                    <h2 id="fx-co-summary" className="fx-co__title">{t("orderSummary")}</h2>
                    <dl className="fx-co__details">
                        <div><dt>{t("firstName")}</dt><dd>{form.firstname}</dd></div>
                        <div><dt>{t("lastName")}</dt><dd>{form.lastname}</dd></div>
                        <div><dt>{t("email")}</dt><dd>{form.email}</dd></div>
                        <div><dt>{t("prayerAt")}</dt><dd className="fx-co__prayer">{form.pray}</dd></div>
                    </dl>

                    <button
                        type="button"
                        className={`ui-btn ${paymentConfirmed ? 'ui-btn--ghost' : 'ui-btn--gold'} fx-btn-lg fx-co__confirm`}
                        onClick={handleConfirmPayment}
                    >
                        {paymentConfirmed && <i className="fas fa-check" aria-hidden="true" />}
                        {paymentConfirmed ? t("confirmed") : t("confirmDetails")}
                    </button>
                </section>

                <aside className="fx-co__side ui-glass" aria-labelledby="fx-co-pay">
                    <p className="fx-co__step"><span className="fx-co__stepn" aria-hidden="true">2</span>{t('faithUi.stepPayment')}</p>
                    <h2 id="fx-co-pay" className="fx-co__title">{t('paypalComponent.paymentMethod')}</h2>

                    <div className="fx-co__total">
                        <span className="fx-co__candle">
                            <span className="fx-flame fx-flame--sm" aria-hidden="true" />
                            {t("cost")}
                        </span>
                        <strong>$3</strong>
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
                        <div className="fx-alert fx-alert--danger fx-co__cancel" role="alert">
                            <i className="fas fa-times-circle" aria-hidden="true" />
                            <p>{t("orderCancelled")}</p>
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
