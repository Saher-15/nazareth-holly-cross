import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './shopUi.css';

// Glass pill linking to /cart; the gold badge re-animates whenever the count changes.
const CartPill = ({ count, className = '' }) => {
  const { t } = useTranslation();
  return (
    <Link to="/cart" className={`shp-cartpill ${className}`} aria-label={t('shopUi.cartAria', { count })}>
      <i className="fas fa-shopping-cart" aria-hidden="true"></i>
      <span className="shp-cartpill__label">{t('shopUi.cartLink')}</span>
      {count > 0 && (
        <span key={count} className="shp-cartpill__count" aria-hidden="true">
          {count}
        </span>
      )}
    </Link>
  );
};

export default CartPill;
