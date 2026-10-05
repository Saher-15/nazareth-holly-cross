import React, { useState, useEffect, useCallback } from 'react';
import i18n from '../i18n';
import '../styles/LanguageSwitcher.css';

const LanguageSwitcher = () => {
    const [isOpen, setIsOpen] = useState(false); 

    const changeLanguage = (lng) => {
        if (i18n && typeof i18n.changeLanguage === 'function') {
            i18n.changeLanguage(lng);
            setIsOpen(false); 
        } else {
            console.error('i18n is not defined or changeLanguage is not a function');
        }
    };

    const toggleDropdown = () => {
        setIsOpen((prev) => !prev); 
    };

    // Memoize handleOutsideClick with useCallback
    const handleOutsideClick = useCallback((e) => {
        if (e.target.closest('.language-switcher') === null) {
            setIsOpen(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('click', handleOutsideClick);
        return () => {
            document.removeEventListener('click', handleOutsideClick);
        };
    }, [handleOutsideClick]); // Add handleOutsideClick to the dependency array

    return (
        <div className="language-switcher">
            <button className="language-button" onClick={toggleDropdown} style={{ fontSize: "1.4rem", color: "#ffdf00", background: "transparent", border: "none" }}>
                🌍
            </button>

            {isOpen && (
                <div className="language-options">
                    <div className="language-card" onClick={() => changeLanguage('en')}>
                        <h3>English</h3>
                    </div>
                    <div className="language-card" onClick={() => changeLanguage('fr')}>
                        <h3>French</h3>
                    </div>
                    <div className="language-card" onClick={() => changeLanguage('es')}>
                        <h3>Spanish</h3>
                    </div>
                    <div className="language-card" onClick={() => changeLanguage('de')}>
                        <h3>German</h3>
                    </div>
                    <div className="language-card" onClick={() => changeLanguage('ru')}>
                        <h3>Russain</h3>
                    </div>
                    <div className="language-card" onClick={() => changeLanguage('pt')}>
                        <h3>Portuguese </h3>
                    </div>
                    <div className="language-card" onClick={() => changeLanguage('it')}>
                        <h3>Italian  </h3>
                    </div>
                    <div className="language-card" onClick={() => changeLanguage('pl')}>
                        <h3>Polish  </h3>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
