import React, { useState, useMemo, useCallback } from 'react';
import Select from 'react-select';
import countryList from 'react-select-country-list';
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import ConfirmationOrder from '../components/ConfirmationOrder';
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';
import "../styles/FaithShared.css";
import "../styles/PaypalCandle.css";
import "../styles/PaypalProduct.css";
import { useTranslation } from 'react-i18next';
import { PAYPAL_CLIENT_ID } from '../config/env';
import usePayPalOrder from '../payments/usePayPalOrder';
import PageHero from './ui/PageHero';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const PayPalComponent = ({ discountAmount, cartItems }) => {
    const { t } = useTranslation();
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showAlert, setShowAlert] = useState(false);
    const [form, setForm] = useState({
        firstname: "",
        lastname: "",
        phone: "",
        email: "",
        confirmEmail: "",
        street: "",
        city: "",
        state: "",
        postal: "",
        country: ""
    });
    const [phoneValue, setphoneValue] = useState();
    const [emailMatchError, setEmailMatchError] = useState("");
    const [value, setValue] = useState('');
    const options = useMemo(() => countryList().getData(), []);

    const changePhoneHandler = value => {
        setphoneValue(value);
        setForm(prev => ({ ...prev, phone: value }));
    };

    const changeHandler = value => {
        setValue(value);
        setForm(prev => ({ ...prev, country: value.label }));
    };

    const handleChangeForm = (e) => {
        const { name, value } = e.target;
        setForm((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    };

    const initialOptions = {
        clientId: PAYPAL_CLIENT_ID
    };


    const onCancel = (data) => {
        setShowAlert(true);
        setTimeout(() => {
            setShowAlert(false);
        }, 2000);
    };


    const getPayload = useCallback(() => ({
        type: 'order',
        items: cartItems.map((item) => ({ _id: item._id, quantity: item.quantity })),
        amount: discountAmount, // only read by the pre-stage-6 API; the server now prices the items itself
    }), [cartItems, discountAmount]);
    const onPaid = useCallback(() => {
        setShowConfirmation(true);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const { createOrder, onApprove, onError, error: payError } = usePayPalOrder({ getPayload, onPaid });

    const isFormIncomplete = Object.values(form).some(value => value === "");
    const doEmailsMatch = form.email === form.confirmEmail;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!doEmailsMatch) {
            setEmailMatchError(t('paypalComponent.emailsDontMatch'));
            return;
        }
        // You can proceed with the payment or any other logic here
    };

    return (
        <main className={`ui-page fx fx-hero-plain fx-co fx-co--order ${showConfirmation ? 'is-paid' : ''}`}>
            <PageHero
                eyebrow={t('faithUi.checkoutEyebrow')}
                title={t('faithUi.orderTitle')}
                lead={t('faithUi.checkoutLead')}
            />

            <div className="ui-container fx-co__grid">
                <section className="fx-co__main ui-glass" aria-labelledby="fx-co-contact">
                    <form className="paypal-product-form" onSubmit={handleSubmit}>
                        <p className="fx-co__step"><span className="fx-co__stepn" aria-hidden="true">1</span>{t('faithUi.stepDetails')}</p>
                        <h2 id="fx-co-contact" className="fx-co__title">{t('paypalComponent.contactInfo')}</h2>

                        <div className="fx-co__fields">
                            <div className="ui-field">
                                <label className="ui-label" htmlFor="co-firstname">{t('paypalComponent.firstName')}</label>
                                <input
                                    type="text"
                                    id="co-firstname"
                                    name="firstname"
                                    value={form.firstname}
                                    onChange={handleChangeForm}
                                    required
                                    autoComplete="given-name"
                                    className="ui-input"
                                />
                            </div>
                            <div className="ui-field">
                                <label className="ui-label" htmlFor="co-lastname">{t('paypalComponent.lastName')}</label>
                                <input
                                    type="text"
                                    id="co-lastname"
                                    name="lastname"
                                    value={form.lastname}
                                    onChange={handleChangeForm}
                                    required
                                    autoComplete="family-name"
                                    className="ui-input"
                                />
                            </div>
                            <div className="ui-field">
                                <label className="ui-label" htmlFor="co-email">{t('paypalComponent.email')}</label>
                                <input
                                    type="text"
                                    id="co-email"
                                    name="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    value={form.email}
                                    onChange={(e) => {
                                        handleChangeForm(e);
                                        setEmailMatchError(e.target.value === form.confirmEmail ? "" : t('paypalComponent.emailsDontMatch'));
                                    }}
                                    required
                                    className="ui-input"
                                />
                            </div>
                            <div className="ui-field">
                                <label className="ui-label" htmlFor="co-confirm-email">{t('paypalComponent.confirmEmail')}</label>
                                <input
                                    type="text"
                                    id="co-confirm-email"
                                    name="confirmEmail"
                                    inputMode="email"
                                    autoComplete="email"
                                    value={form.confirmEmail}
                                    onChange={(e) => {
                                        handleChangeForm(e);
                                        setEmailMatchError(e.target.value === form.email ? "" : t('paypalComponent.emailsDontMatch'));
                                    }}
                                    required
                                    aria-describedby={emailMatchError ? 'co-email-error' : undefined}
                                    className="ui-input"
                                />
                            </div>
                            {emailMatchError && (
                                <p id="co-email-error" className="fx-alert fx-alert--danger fx-co__wide" role="alert">
                                    <i className="fas fa-exclamation-circle" aria-hidden="true" />
                                    {emailMatchError}
                                </p>
                            )}

                            <div className="ui-field">
                                <label className="ui-label" htmlFor="co-phone">{t('faithUi.phone')}</label>
                                <PhoneInput
                                    id="co-phone"
                                    value={phoneValue}
                                    onChange={changePhoneHandler}
                                    international
                                    countryCallingCodeEditable={false}
                                    defaultCountry='US'
                                    autoComplete="tel"
                                    className="fx-phone"
                                />
                            </div>
                            <div className="ui-field">
                                <label className="ui-label" htmlFor="co-country">{t('faithUi.countryLabel')}</label>
                                <Select
                                    inputId="co-country"
                                    options={options}
                                    onChange={changeHandler}
                                    value={value}
                                    placeholder={t('paypalComponent.country')}
                                    className="country-select"
                                    classNamePrefix="fx-select"
                                />
                            </div>
                            <div className="ui-field">
                                <label className="ui-label" htmlFor="co-city">{t('paypalComponent.city')}</label>
                                <input
                                    type="text"
                                    id="co-city"
                                    name="city"
                                    value={form.city}
                                    onChange={handleChangeForm}
                                    required
                                    autoComplete="address-level2"
                                    className="ui-input"
                                />
                            </div>
                            <div className="ui-field">
                                <label className="ui-label" htmlFor="co-street">{t('paypalComponent.street')}</label>
                                <input
                                    type="text"
                                    id="co-street"
                                    name="street"
                                    value={form.street}
                                    onChange={handleChangeForm}
                                    required
                                    autoComplete="street-address"
                                    className="ui-input"
                                />
                            </div>
                            <div className="ui-field">
                                <label className="ui-label" htmlFor="co-postal">{t('paypalComponent.postal')}</label>
                                <input
                                    type="text"
                                    id="co-postal"
                                    name="postal"
                                    value={form.postal}
                                    onChange={handleChangeForm}
                                    required
                                    autoComplete="postal-code"
                                    className="ui-input"
                                />
                            </div>
                            <div className="ui-field">
                                <label className="ui-label" htmlFor="co-state">{t('paypalComponent.state')}</label>
                                <input
                                    type="text"
                                    id="co-state"
                                    name="state"
                                    value={form.state}
                                    onChange={handleChangeForm}
                                    required
                                    autoComplete="address-level1"
                                    className="ui-input"
                                />
                            </div>
                        </div>
                    </form>
                </section>

                <aside className="fx-co__side ui-glass" aria-labelledby="fx-co-summary">
                    <p className="fx-co__step"><span className="fx-co__stepn" aria-hidden="true">2</span>{t('faithUi.stepPayment')}</p>
                    <h2 id="fx-co-summary" className="fx-co__title">{t('paypalComponent.summary')}</h2>

                    <ul className="fx-co__items">
                        {cartItems.map((item) => (
                            <li key={`${item._id}-${item.color}`} className="fx-co__item">
                                {item.img && <img className="fx-co__thumb" src={item.img} alt="" loading="lazy" />}
                                <span className="fx-co__itemtext">
                                    <span className="fx-co__itemname">{item.name}</span>
                                    <span className="fx-co__itemmeta">
                                        {item.color ? `${item.color} · ` : ''}
                                        {t('faithUi.quantity', { qty: item.quantity })}
                                    </span>
                                </span>
                                {item.price !== undefined && (
                                    <span className="fx-co__itemprice">{money(item.price * item.quantity)}</span>
                                )}
                            </li>
                        ))}
                    </ul>

                    <p className="fx-co__line">{t('cart.shipping')}</p>
                    <div className="fx-co__total">
                        <span>{t('faithUi.total')}</span>
                        <strong>{money(discountAmount)}</strong>
                    </div>
                    <p className="fx-co__note">
                        <i className="fas fa-tag" aria-hidden="true" />
                        {t('faithUi.discountNote')}
                    </p>

                    <div className="paypal-card">
                        <PayPalScriptProvider options={initialOptions}>
                            <h3 className="fx-co__paytitle">{t('paypalComponent.paymentMethod')}</h3>
                            {isFormIncomplete && (
                                <p className="fx-alert fx-alert--info">
                                    <i className="fas fa-info-circle" aria-hidden="true" />
                                    {t('paypalComponent.pleaseFillAllDetails')}
                                </p>
                            )}
                            {!showConfirmation && !isFormIncomplete && doEmailsMatch && (
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
                        {showConfirmation && (
                            <ConfirmationOrder
                                cartItems={cartItems}
                                firstName={form.firstname}
                                lastName={form.lastname}
                                phone={form.phone}
                                email={form.email}
                                street={form.street}
                                city={form.city}
                                state={form.state}
                                postal={form.postal}
                                country={form.country}
                                totalPrice={discountAmount}
                            />
                        )}
                        {showAlert && (
                            <div className="fx-alert fx-alert--danger fx-co__cancel" role="alert">
                                <i className="fas fa-times-circle" aria-hidden="true" />
                                <p>{t('paypalComponent.orderCancelled')}</p>
                            </div>
                        )}
                    </div>

                    <p className="fx-co__secure">
                        <i className="fas fa-lock" aria-hidden="true" />
                        {t('faithUi.securedBy')}
                    </p>
                </aside>
            </div>
        </main>
    );
}

export default PayPalComponent;
