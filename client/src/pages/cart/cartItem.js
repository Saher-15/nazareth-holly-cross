import React from "react";
import { useNavigate } from "react-router-dom";
import { useShopContext } from "../../context/shop-context";
import { useTranslation } from 'react-i18next'; // Import the useTranslation hook
import "./cartItem.css";

const CartItem = ({ data }) => {
  const navigate = useNavigate();
  const { _id, name, price, img, quantity, color } = data;
  const { addToCart, updateCartItemCount, decreaseFromCart, removeFromCart } = useShopContext();
  const { t } = useTranslation(); // Use the useTranslation hook

  // Function to handle click on the image
  const handleImageClick = () => {
    navigate(`/product/${_id}`);
  };

  return (
    <div className="cartItem">
      <img
        src={img}
        alt={name}
        onClick={handleImageClick}
        style={{ cursor: 'pointer' }}
      />
      <div className="description-cart">
        <p>
          <b>{name}</b>
        </p>
        <p>{t("cart.price", { price: price.toFixed(2) })}</p> {/* Use translation for price */}
        <div className="countHandler" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            className="addToCartBttn"
            onClick={(e) => {
              e.stopPropagation();
              if (quantity > 1) {
                decreaseFromCart(_id, color);
              }
            }}
            disabled={quantity <= 1}
          >
            -
          </button>
          <input
            value={quantity}
            onChange={(e) => updateCartItemCount(Number(e.target.value), _id, color)}
            style={{ textAlign: 'center', paddingTop: '10px', paddingBottom: '10px' }}
          />
          <button
            className="addToCartBttn"
            onClick={(e) => {
              e.stopPropagation();
              addToCart({ ...data, color });
            }}
          >
            +
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            className="removeFromCartBtn"
            onClick={(e) => {
              e.stopPropagation();
              removeFromCart(_id, color);
            }}
          >
            {t("cart.remove")} {/* Use translation for remove button */}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartItem;
