import React, { useState, useMemo } from 'react';
import { API_URL } from '../config.js';
import Select from 'react-select';
import countryList from 'react-select-country-list';
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import ConfirmationOrder from '../components/ConfirmationOrder';
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid2';
import { alpha } from '@mui/material/styles';
import { gold, goldLight, goldDark } from '../theme';

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
                body: JSON.stringify({ "intent": intent, "amount": discountAmount })
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

    const onApprove = async (data) => {
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
            });
    };

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

    const inputSx = {
        '& .MuiOutlinedInput-root': {
            color: goldLight, fontSize: '0.9rem',
            '& fieldset': { borderColor: alpha(gold, 0.2) },
            '&:hover fieldset': { borderColor: alpha(gold, 0.4) },
            '&.Mui-focused fieldset': { borderColor: gold },
        },
        '& .MuiInputLabel-root': { color: alpha(goldLight, 0.5), '&.Mui-focused': { color: gold } },
    };

    return (
        <Box sx={{ minHeight: '80vh', py: { xs: 6, md: 10 }, px: { xs: 2, sm: 3 } }}>
            <Container maxWidth="lg">
                <Typography variant="h3" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.6rem', md: '2rem' }, background: `linear-gradient(135deg, #E8D5A3 0%, #C9A84C 50%, #9A7B35 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', textAlign: 'center', mb: 5 }}>
                    Checkout
                </Typography>
                <Grid container spacing={4} alignItems="flex-start">
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Paper elevation={0} component="form" onSubmit={handleSubmit} sx={{ p: { xs: 3, md: 4 }, background: `linear-gradient(145deg, ${alpha('#1A1215', 0.9)} 0%, ${alpha('#0D0810', 0.95)} 100%)`, border: `1px solid ${alpha(gold, 0.15)}`, borderRadius: '12px', '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', borderRadius: '12px 12px 0 0', background: `linear-gradient(90deg, transparent, ${gold}, transparent)` } }}>
                            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.75rem', letterSpacing: '0.2em', color: gold, textTransform: 'uppercase', mb: 3 }}>{t('paypalComponent.contactInfo')}</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 6 }}><TextField fullWidth label={t('paypalComponent.firstName')} name="firstname" value={form.firstname} onChange={handleChangeForm} required size="small" sx={inputSx} /></Grid>
                                    <Grid size={{ xs: 6 }}><TextField fullWidth label={t('paypalComponent.lastName')} name="lastname" value={form.lastname} onChange={handleChangeForm} required size="small" sx={inputSx} /></Grid>
                                </Grid>
                                <TextField fullWidth label={t('paypalComponent.email')} name="email" value={form.email} onChange={(e) => { handleChangeForm(e); setEmailMatchError(e.target.value === form.confirmEmail ? '' : t('paypalComponent.emailsDontMatch')); }} required size="small" sx={inputSx} />
                                <TextField fullWidth label={t('paypalComponent.confirmEmail')} name="confirmEmail" value={form.confirmEmail} onChange={(e) => { handleChangeForm(e); setEmailMatchError(e.target.value === form.email ? '' : t('paypalComponent.emailsDontMatch')); }} required size="small" sx={inputSx} />
                                {emailMatchError && <Alert severity="error" sx={{ backgroundColor: alpha('#c62828', 0.12), border: `1px solid ${alpha('#c62828', 0.3)}` }}>{emailMatchError}</Alert>}
                                <Box sx={{ '& .PhoneInput': { display: 'flex', gap: 1 }, '& .PhoneInputInput': { background: 'transparent', border: `1px solid ${alpha(gold, 0.2)}`, borderRadius: '4px', color: goldLight, padding: '8px 12px', fontSize: '0.9rem', outline: 'none', flex: 1, '&:focus': { borderColor: gold } } }}>
                                    <PhoneInput value={phoneValue} onChange={changePhoneHandler} international countryCallingCodeEditable={false} defaultCountry="US" />
                                </Box>
                                <Box sx={{ '& .country-select__control': { backgroundColor: alpha('#1A1215', 0.9), border: `1px solid ${alpha(gold, 0.2)}`, borderRadius: '4px', '&:hover': { borderColor: alpha(gold, 0.4) } }, '& .country-select__single-value': { color: goldLight }, '& .country-select__menu': { backgroundColor: '#1A1215', border: `1px solid ${alpha(gold, 0.2)}` }, '& .country-select__option': { color: goldLight, '&:hover': { backgroundColor: alpha(gold, 0.1) } }, '& .country-select__placeholder': { color: alpha(goldLight, 0.4) } }}>
                                    <Select options={options} onChange={changeHandler} value={value} placeholder={t('paypalComponent.country')} classNamePrefix="country-select" />
                                </Box>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 6 }}><TextField fullWidth label={t('paypalComponent.city')} name="city" value={form.city} onChange={handleChangeForm} required size="small" sx={inputSx} /></Grid>
                                    <Grid size={{ xs: 6 }}><TextField fullWidth label={t('paypalComponent.street')} name="street" value={form.street} onChange={handleChangeForm} required size="small" sx={inputSx} /></Grid>
                                </Grid>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 6 }}><TextField fullWidth label={t('paypalComponent.postal')} name="postal" value={form.postal} onChange={handleChangeForm} required size="small" sx={inputSx} /></Grid>
                                    <Grid size={{ xs: 6 }}><TextField fullWidth label={t('paypalComponent.state')} name="state" value={form.state} onChange={handleChangeForm} required size="small" sx={inputSx} /></Grid>
                                </Grid>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, background: `linear-gradient(145deg, ${alpha('#1A1215', 0.9)} 0%, ${alpha('#0D0810', 0.95)} 100%)`, border: `1px solid ${alpha(gold, 0.15)}`, borderRadius: '12px', position: 'sticky', top: '90px' }}>
                            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.75rem', letterSpacing: '0.2em', color: gold, textTransform: 'uppercase', mb: 3 }}>{t('paypalComponent.paymentMethod')}</Typography>
                            {isFormIncomplete && <Alert severity="warning" sx={{ mb: 2, backgroundColor: alpha('#B8860B', 0.12), border: `1px solid ${alpha(gold, 0.3)}`, '& .MuiAlert-icon': { color: gold } }}>{t('paypalComponent.pleaseFillAllDetails')}</Alert>}
                            {showAlert && <Alert severity="info" sx={{ mb: 2 }}>{t('paypalComponent.orderCancelled')}</Alert>}
                            <PayPalScriptProvider options={initialOptions}>
                                {!showConfirmation && !isFormIncomplete && doEmailsMatch && (
                                    <PayPalButtons createOrder={createOrder} onApprove={onApprove} onCancel={onCancel} onError={onError} />
                                )}
                            </PayPalScriptProvider>
                            {showConfirmation && <ConfirmationOrder cartItems={cartItems} firstName={form.firstname} lastName={form.lastname} phone={form.phone} email={form.email} street={form.street} city={form.city} state={form.state} postal={form.postal} country={form.country} totalPrice={discountAmount} />}
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
}

export default PayPalComponent;
