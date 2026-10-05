import React, { useState, useEffect } from 'react';
import axios from 'axios';
import "../App.css";
import "../styles/Prayer.css";
import { useTranslation } from 'react-i18next'; // Import the translation hook
import { API_URL } from '../config';

function Pray() {
    const { t } = useTranslation(); // Initialize the translation hook

    // State to store form data
    const [formData, setFormData] = useState({
        fullName: '',
        email: '', // Use email for country in the backend
        phone: '000',
        msg: ''
    });

    // State to store fetched messages
    const [messages, setMessages] = useState([]);

    // State to manage the visibility of the success message
    const [showMessage, setShowMessage] = useState(false);

    // State to manage the visibility of the confirmation message
    const [showConfirmationMessage, setShowConfirmationMessage] = useState(false);

    // Handler function to update form data
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    // Function to fetch all reviewed messages
    const fetchMessages = async () => {
        try {
            const response = await axios.get(`${API_URL}/review/getReviews`);
            // The server returns approved reviews, newest first
            setMessages(response.data);
        } catch (error) {
            console.error('Error fetching reviews:', error);
        }
    };

    // Handler function to submit form data
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.fullName === '' || formData.email === '' || formData.phone === '' || formData.msg === '') {
            alert('Please fill in all fields');
            return;
        }

        try {
            // Map country field to email field for backend
            const modifiedFormData = { ...formData, email: formData.email };

            // Send form data to server
            await axios.post(`${API_URL}/review/addReview`, modifiedFormData);

            // Reset form fields
            setFormData({
                fullName: '',
                email: '', // Reset email field
                phone: '000',
                msg: ''
            });

            // Show success message and confirmation message
            setShowMessage(true);
            setShowConfirmationMessage(true);
            setTimeout(() => {
                setShowMessage(false);
                setShowConfirmationMessage(false);
            }, 3000);

            // Fetch messages after form submission
            fetchMessages();
        } catch (error) {
            console.error('Error sending form data:', error.response ? error.response.data : error.message);
            alert('Failed to send form data');
        }
    };

    useEffect(() => {
        // Scroll to the top of the page when the component mounts
        window.scrollTo(0, 0);

        // Fetch all messages when the component mounts
        fetchMessages();
    }, []);

    return (
        <div className="pray-container">
            <div className="blur-overlay"></div>
            <div className="form-section">
                <form onSubmit={handleSubmit} className="message-form">
                    <label htmlFor="first-name" className="form-title">
                        <h2 className='form-title-text'>{t('pray.formTitle')}</h2>
                    </label>
                    <p className='form-description'>{t('pray.formDescription')}</p>
                    <div className="form-group-pray">
                        <div className="form-input-group">
                            <input
                                type="text"
                                name="fullName"
                                id="fullName"
                                placeholder={t('pray.placeholderFullName')}
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                                autoComplete="given-name"
                                className="form-input"
                            />
                        </div>

                        <div className="form-input-group">
                            <input
                                type="text" // Use text for country
                                name="email"
                                id="country"
                                placeholder={t('pray.placeholderCountry')}
                                value={formData.email} // Still using 'email' as field name
                                onChange={handleChange}
                                required
                                autoComplete="country"
                                className="form-input"
                            />
                        </div>

                        <textarea
                            placeholder={t('pray.placeholderMessage')}
                            id="msg"
                            name="msg"
                            value={formData.msg}
                            onChange={handleChange}
                            required
                            className="form-textarea"
                        />
                    </div>

                    <div className="form-submit-container">
                        <button type="submit" className="form-submit-button">{t('pray.submitButton')}</button>
                    </div>
                    <div className="success-message-container">
                        {showMessage && <p className="success-message">{t('pray.successMessage')}</p>}
                        {showConfirmationMessage && <p className="confirmation-message">{t('pray.confirmationMessage')}</p>}
                    </div>
                </form>
            </div>

            {/* Display messages */}
            <div className="messages-section">
                <h3 className="messages-title">{t('pray.messagesTitle')}</h3>
                <p className='messages-description'>{t('pray.messagesDescription')}</p>
                {messages.length > 0 ? (
                    <div className="messages-grid">
                        {messages.map((message, index) => (
                            <div key={index} className="message-item">
                                <p><strong>Name:</strong> {message.fullName}</p>
                                <p><strong>Country:</strong> {message.email}</p> {/* Displaying country as email */}
                                <p><strong>Review:</strong> {message.msg}</p>
                                <hr className="message-divider" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="no-messages">{t('pray.noMessages')}</p>
                )}
            </div>
        </div>
    );
}

export default Pray;
