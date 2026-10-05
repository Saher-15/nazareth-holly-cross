import React from 'react';
import '../styles/Button.css';
import { Link } from 'react-router-dom';

const STYLES = ['btn--primary', 'btn--outline', 'btn--half'];
const SIZES = ['btn--medium', 'btn--large'];

// Legacy style names mapped onto the shared pill buttons from theme.css.
const THEME = {
    'btn--primary': 'ui-btn--gold',
    'btn--outline': 'ui-btn--ghost',
    'btn--half': 'ui-btn--glass',
};

export const Button = ({ children, type, onClick, buttonStyle, buttonSize, destination }) => {
    const checkButtonStyle = STYLES.includes(buttonStyle) ? buttonStyle : STYLES[0];
    const checkButtonSize = SIZES.includes(buttonSize) ? buttonSize : SIZES[0];
    const className = `btn ui-btn ${THEME[checkButtonStyle]} ${checkButtonStyle} ${checkButtonSize}`;

    // A link that looks like a button (a <button> inside an <a> is invalid HTML).
    if (destination) {
        return (
            <Link to={destination} className={`btn-web1 ${className}`} onClick={onClick}>
                {children}
            </Link>
        );
    }

    return (
        <button className={className} type={type || 'button'} onClick={onClick}>
            {children}
        </button>
    );
};
