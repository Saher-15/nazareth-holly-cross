import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useShopContext } from "../../context/shop-context";
import CartItem from "./cartItem";
import "./cart.css";
import { useTranslation } from "react-i18next"; // Import useTranslation

const Cart = () => {
  const { t } = useTranslation(); // Initialize translation
  const { cartItems } = useShopContext();
  const navigate = useNavigate();
  const [totalAmount, setTotalAmount] = useState(0);
  const [discountAmount, setdiscountAmount] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let total = 0;
    cartItems.forEach(item => {
      total += item.price * item.quantity;
    });
    setTotalAmount(total + 5); // Added shipping fee
    setdiscountAmount(total*0.9 + 5); // Added shipping fee

  }, [cartItems]);

  return (
    <div className="cart">
      <div className="cart-items">
        {cartItems.map((product) => (
          <CartItem
            key={`${product._id}-${product.color}`}
            data={product}
          />
        ))}
      </div>

      {totalAmount > 5 ? (
        <div className="checkout">
          <div className="shipping-note">
            <p>{t("cart.shipping")}</p>
            <p>{t("cart.subtotal", { amount: totalAmount.toFixed(2) })}</p>
            <p>{t("cart.subtotalDiscount", { amount: discountAmount.toFixed(2) })}</p>

          </div>

          <button onClick={() => navigate("/shop")}>{t("cart.continueShopping")}</button>
          <button onClick={() => navigate("/checkout", { state: { discountAmount, cartItems } })}>
            {t("cart.checkout")} {/* Use translation for Checkout button */}
          </button>
        </div>
      ) : (
        <div className="checkout">
          <h1>{t("cart.emptyCart")}</h1>
          <button onClick={() => navigate("/shop")}>{t("cart.backToShopping")}</button>
        </div>
      )}
    </div>
  );
};

export default Cart;
