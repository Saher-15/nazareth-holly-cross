import React from 'react';
import { useTranslation } from 'react-i18next';
import './shopUi.css';

// Presentational − value + control. The caller decides what each button does.
const QuantityStepper = ({
  value,
  onDecrease,
  onIncrease,
  decreaseDisabled = false,
  increaseDisabled = false,
  label,
  className = '',
}) => {
  const { t } = useTranslation();
  return (
    <div className={`shp-stepper ${className}`} role="group" aria-label={label || t('cart.quantity')}>
      <button
        type="button"
        className="shp-stepper__btn"
        onClick={onDecrease}
        disabled={decreaseDisabled}
        aria-label={t('shopUi.decrease')}
      >
        <i className="fas fa-minus" aria-hidden="true"></i>
      </button>
      <span className="shp-stepper__value" aria-live="polite" aria-atomic="true">
        <span className="shp-sr">{t('cart.quantity')}: </span>
        {value}
      </span>
      <button
        type="button"
        className="shp-stepper__btn"
        onClick={onIncrease}
        disabled={increaseDisabled}
        aria-label={t('shopUi.increase')}
      >
        <i className="fas fa-plus" aria-hidden="true"></i>
      </button>
    </div>
  );
};

export default QuantityStepper;
