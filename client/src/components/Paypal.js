import React, { useState, useMemo, useCallback } from 'react';
import Select from 'react-select';
import countryList from 'react-select-country-list';
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import ConfirmationOrder from '../components/ConfirmationOrder';
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';
import "../styles/PaypalProduct.css";
import { useTranslation } from 'react-i18next';
import { PAYPAL_CLIENT_ID } from '../config/env';
import usePayPalOrder from '../payments/usePayPalOrder';

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
        <div className="App-paypal-product">
            <div className="container">
                <form className="paypal-product-form center-form" onSubmit={handleSubmit}>
                    <h2 style={{ textAlign: 'center', marginBottom: '12px' }}>{t('paypalComponent.contactInfo')}</h2>

                    <div className="form-group-paypal">
                        <input
                            type="text"
                            name="firstname"
                            placeholder={t('paypalComponent.firstName')}
                            value={form.firstname}
                            onChange={handleChangeForm}
                            required
                            className="form-control"
                        />
                        <input
                            type="text"
                            name="lastname"
                            placeholder={t('paypalComponent.lastName')}
                            value={form.lastname}
                            onChange={handleChangeForm}
                            required
                            className="form-control"
                        />
                        <input
                            type="text"
                            name="email"
                            placeholder={t('paypalComponent.email')}
                            value={form.email}
                            onChange={(e) => {
                                handleChangeForm(e);
                                setEmailMatchError(e.target.value === form.confirmEmail ? "" : t('paypalComponent.emailsDontMatch'));
                            }}
                            required
                            className="form-control"
                        />
                        <input
                            type="text"
                            name="confirmEmail"
                            placeholder={t('paypalComponent.confirmEmail')}
                            value={form.confirmEmail}
                            onChange={(e) => {
                                handleChangeForm(e);
                                setEmailMatchError(e.target.value === form.email ? "" : t('paypalComponent.emailsDontMatch'));
                            }}
                            required
                            className="form-control"
                        />
                        {emailMatchError && <p className="error-message">{emailMatchError}</p>}

                        <PhoneInput
                            value={phoneValue}
                            onChange={changePhoneHandler}
                            international
                            countryCallingCodeEditable={false}
                            defaultCountry='US'
                            className="form-control PhoneInputInput"
                        />
                        <div className="form-group">
                            <Select
                                options={options}
                                onChange={changeHandler}
                                value={value}
                                placeholder={t('paypalComponent.country')}
                                className="country-select"
                            />
                        </div>
                        <input
                            type="text"
                            name="city"
                            placeholder={t('paypalComponent.city')}
                            value={form.city}
                            onChange={handleChangeForm}
                            required
                            className="form-control"
                        />
                        <input
                            type="text"
                            name="street"
                            placeholder={t('paypalComponent.street')}
                            value={form.street}
                            onChange={handleChangeForm}
                            required
                            className="form-control"
                        />
                        <input
                            type="text"
                            name="postal"
                            placeholder={t('paypalComponent.postal')}
                            value={form.postal}
                            onChange={handleChangeForm}
                            required
                            className="form-control"
                        />
                        <input
                            type="text"
                            name="state"
                            placeholder={t('paypalComponent.state')}
                            value={form.state}
                            onChange={handleChangeForm}
                            required
                            className="form-control"
                        />
                    </div>
                </form>
                <div className="paypal-card">
                    <PayPalScriptProvider options={initialOptions}>
                        {isFormIncomplete && <p style={{ color: 'red', textAlign: 'center' }}>{t('paypalComponent.pleaseFillAllDetails')}</p>}
                        <h2 style={{ textAlign: 'center', marginBottom: '12px' }}>{t('paypalComponent.paymentMethod')}</h2>
                        {!showConfirmation && !isFormIncomplete && doEmailsMatch && (
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
                        <div className="ms-alert ms-action2 ms-small">
                            <span className="ms-close"></span>
                            <p>{t('paypalComponent.orderCancelled')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PayPalComponent;
