import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import axios from 'axios';
import { useTranslation } from 'react-i18next'; // Import the translation hook
import { API_URL } from '../config/env';
import '../styles/FaithShared.css';

const ConfirmationCandle = ({ firstName, lastName, email, prayer }) => {
    const navigate = useNavigate(); // Get the navigate function
    const { t } = useTranslation(); // Initialize the translation hook

    useEffect(() => {
        const sendOrderDetails = async () => {
            try {
                const requestBody = {
                    firstName,
                    lastName,
                    email,
                    prayer
                };

                // Send order details to the server
                //https://nazareth-holy-cross-c5896e0462c5.herokuapp.com/
                await axios.post(`${API_URL}/candle/lightACandle`, requestBody);

                // Redirect to homepage after 5 seconds
                setTimeout(() => {
                    navigate("/");
                }, 5000);
            } catch (error) {
                console.error('Error sending order details:', error);
            }
        };

        sendOrderDetails();
    }, [firstName, lastName, email, prayer, navigate]); // Add dependencies here

    return (
        <div className="fx-done" role="status">
            <span className="fx-done__icon fx-done__icon--flame" aria-hidden="true">
                <span className="fx-flame fx-flame--lg" />
            </span>
            <h2 className="fx-done__title">{t('confirmationCandle.thankYou')}</h2>
            <p>{t('confirmationCandle.paymentSuccess')}</p>
            <p>{t('confirmationCandle.receipt')}</p>
            <p className="fx-done__strong">{t('confirmationCandle.gratitude')}</p>
        </div>
    );
};

export default ConfirmationCandle;
