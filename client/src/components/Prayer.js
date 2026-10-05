import React, { useState, useEffect } from 'react';
import axios from 'axios';
import "../App.css";
import "../styles/FaithShared.css";
import "../styles/Prayer.css";
import { useTranslation } from 'react-i18next'; // Import the translation hook
import { API_URL } from '../config/env';
import PageHero from './ui/PageHero';
import Reveal from './ui/Reveal';

const initialOf = (name) => (typeof name === 'string' && name.trim() ? name.trim()[0].toUpperCase() : '·');

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

    // True until the first list request has finished (only drives the skeleton cards)
    const [loading, setLoading] = useState(true);

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
        } finally {
            setLoading(false);
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

    const reviews = Array.isArray(messages) ? messages : [];

    return (
        <main className="ui-page fx fx-reviews">
            <PageHero
                eyebrow={t('home.voicesEyebrow')}
                title={t('home.voicesTitle')}
                lead={t('pray.messagesDescription')}
                image="/images/vitrage-bg.jpg"
            />

            <div className="ui-container fx-reviews__layout">
                <Reveal as="section" className="fx-reviews__aside" aria-labelledby="fx-review-form-title">
                    <form onSubmit={handleSubmit} className="fx-reviews__card ui-glass">
                        <span className="fx-reviews__mark" aria-hidden="true">&ldquo;</span>
                        <h2 id="fx-review-form-title" className="fx-reviews__title">{t('pray.formTitle')}</h2>
                        <p className="fx-reviews__intro">{t('pray.formDescription')}</p>

                        <div className="ui-field">
                            <label className="ui-label" htmlFor="fullName">{t('pray.placeholderFullName')}</label>
                            <input
                                type="text"
                                name="fullName"
                                id="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                                autoComplete="name"
                                className="ui-input"
                            />
                        </div>

                        <div className="ui-field">
                            <label className="ui-label" htmlFor="country">{t('pray.placeholderCountry')}</label>
                            <input
                                type="text" // Use text for country
                                name="email"
                                id="country"
                                value={formData.email} // Still using 'email' as field name
                                onChange={handleChange}
                                required
                                autoComplete="country-name"
                                className="ui-input"
                            />
                        </div>

                        <div className="ui-field">
                            <label className="ui-label" htmlFor="msg">{t('pray.placeholderMessage')}</label>
                            <textarea
                                id="msg"
                                name="msg"
                                rows={5}
                                value={formData.msg}
                                onChange={handleChange}
                                required
                                className="ui-textarea"
                            />
                        </div>

                        <button type="submit" className="ui-btn ui-btn--gold fx-btn-block">
                            <i className="fas fa-feather-alt" aria-hidden="true" />
                            {t('pray.submitButton')}
                        </button>

                        <div className="fx-reviews__status" role="status" aria-live="polite">
                            {(showMessage || showConfirmationMessage) && (
                                <div className="fx-alert fx-alert--success">
                                    <i className="fas fa-check-circle" aria-hidden="true" />
                                    <div>
                                        {showMessage && <p className="fx-reviews__ok">{t('pray.successMessage')}</p>}
                                        {showConfirmationMessage && <p>{t('pray.confirmationMessage')}</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </form>
                </Reveal>

                {/* Approved reviews: a masonry wall of quote cards */}
                <section className="fx-wall" aria-labelledby="fx-wall-title" aria-busy={loading}>
                    <header className="fx-wall__head">
                        <h2 id="fx-wall-title" className="ui-eyebrow fx-wall__title">{t('pray.messagesTitle')}</h2>
                        {!loading && reviews.length > 0 && (
                            <span className="fx-wall__count" aria-hidden="true">{reviews.length}</span>
                        )}
                    </header>

                    {loading ? (
                        <ul className="fx-wall__grid" aria-label={t('faithUi.reviewsLoading')}>
                            {[150, 220, 120, 190].map((h, i) => (
                                <li key={i} className="fx-quote fx-quote--skeleton">
                                    <span className="ui-skeleton" style={{ height: h }} />
                                    <span className="ui-skeleton fx-quote__skline" />
                                </li>
                            ))}
                        </ul>
                    ) : reviews.length > 0 ? (
                        <ul className="fx-wall__grid">
                            {reviews.map((message, index) => (
                                <li key={message._id || index} className="fx-quote">
                                    <figure>
                                        <blockquote className="fx-quote__text">{message.msg}</blockquote>
                                        <figcaption className="fx-quote__by">
                                            <span className="fx-quote__avatar" aria-hidden="true">{initialOf(message.fullName)}</span>
                                            <span>
                                                <span className="fx-quote__name">{message.fullName}</span>
                                                {message.email && (
                                                    <span className="fx-quote__place">
                                                        <i className="fas fa-map-marker-alt" aria-hidden="true" />
                                                        {message.email}
                                                    </span>
                                                )}
                                            </span>
                                        </figcaption>
                                    </figure>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="fx-wall__empty">
                            <span className="fx-wall__emptymark" aria-hidden="true">&ldquo;</span>
                            <p className="fx-wall__emptytitle">{t('pray.noMessages')}</p>
                            <p className="fx-wall__emptyhint">{t('faithUi.reviewsEmptyHint')}</p>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

export default Pray;
