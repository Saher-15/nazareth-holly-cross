import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import axios from 'axios';
import { useTranslation } from 'react-i18next'; // Import the translation hook
import { API_URL } from '../config/env';

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
        <div style={styles.container}>
            <h1>{t('confirmationCandle.thankYou')}</h1>
            <p>{t('confirmationCandle.paymentSuccess')}</p>
            <p>{t('confirmationCandle.receipt')}</p>
            <p>{t('confirmationCandle.gratitude')}</p>
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

export default ConfirmationCandle;
