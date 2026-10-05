import React from "react";
import { Link } from "react-router-dom";
import { useShopContext } from "../../context/shop-context";
import { useTranslation } from 'react-i18next';
import QuantityStepper from "../shop/QuantityStepper";
import "./cartItem.css";

const CartItem = ({ data }) => {
  const { _id, name, price, img, quantity, color } = data;
  const { addToCart, decreaseFromCart, removeFromCart } = useShopContext();
  const { t } = useTranslation();
  const productPath = `/product/${_id}`;

  return (
    <li className="crt-item ui-glass">
      <Link to={productPath} className="crt-item__media" tabIndex={-1} aria-hidden="true">
        <img src={img} alt="" loading="lazy" decoding="async" />
      </Link>

      <div className="crt-item__body">
        <h3 className="crt-item__name">
          <Link to={productPath}>{name}</Link>
        </h3>
        <p className="crt-item__unit">{t("cart.price", { price: price.toFixed(2) })}</p>
      </div>

      <div className="crt-item__controls">
        <QuantityStepper
          value={quantity}
          label={`${t("cart.quantity")}: ${name}`}
          onDecrease={() => {
            if (quantity > 1) {
              decreaseFromCart(_id, color);
            }
          }}
          decreaseDisabled={quantity <= 1}
          onIncrease={() => addToCart({ ...data, color })}
        />
        <button
          type="button"
          className="crt-item__remove"
          onClick={() => removeFromCart(_id, color)}
          title={t("cart.remove")}
        >
          <i className="fas fa-trash-alt" aria-hidden="true"></i>
          <span className="crt-item__remove-text">{t("cart.remove")}</span>
        </button>
      </div>

      <p className="crt-item__total">${(price * quantity).toFixed(2)}</p>
    </li>
  );
};

export default CartItem;
