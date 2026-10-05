import React from 'react';
import '../styles/GallaryPage.css'; // Import the CSS file for styling
import { useTranslation } from 'react-i18next'; // Import useTranslation

const WhatIsNew = () => {
    const { t } = useTranslation(); // Initialize translation hook

    return (
        <div className="gallery-page">
            <div className="scripture-section">
                <h1>{t('whatIsNew.title')}</h1>
                <div className="note">
                    <strong>{t('whatIsNew.scriptureNotes.matthew')}</strong>
                </div>
                <div className="note">
                    <strong>{t('whatIsNew.scriptureNotes.luke1')}</strong>
                </div>
                <div className="note">
                    <strong>{t('whatIsNew.scriptureNotes.john')}</strong>
                </div>
                <div className="note">
                    <strong>{t('whatIsNew.scriptureNotes.luke4')}</strong>
                </div>
            </div>
            
            <h1>{t('whatIsNew.touchingTheSacred')}</h1>
            <div className="intro-paragraph">
                <p>{t('whatIsNew.introParagraphs.part1')}</p>
                <p>{t('whatIsNew.introParagraphs.part2')}</p>
                <p>{t('whatIsNew.introParagraphs.part3')}</p>
                <p>{t('whatIsNew.introParagraphs.part4')}</p>
                <p>{t('whatIsNew.introParagraphs.part5')}</p>
            </div>
        </div>
    );
};

export default WhatIsNew;
