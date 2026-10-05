import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useShopContext } from "../../context/shop-context";
import CartItem from "./cartItem";
import PageHero from "../../components/ui/PageHero";
import "../shop/shopUi.css";
import "./cart.css";
import { useTranslation } from "react-i18next";

const money = (n) => `$${n.toFixed(2)}`;

const Cart = () => {
  const { t } = useTranslation();
  const { cartItems } = useShopContext();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Same arithmetic as before: items total, flat $5 shipping, 10% off the items only.
  let total = 0;
  cartItems.forEach(item => {
    total += item.price * item.quantity;
  });
  const totalAmount = total + 5; // Added shipping fee
  const discountAmount = total * 0.9 + 5; // Added shipping fee
  // Shown so the rows add up to the cent: subtotal - discount = total.
  const discountShown = Number(totalAmount.toFixed(2)) - Number(discountAmount.toFixed(2));
  const hasTotal = totalAmount > 5;

  return (
    <main className="ui-page crt-page">
      <PageHero
        eyebrow={t("home.shopEyebrow")}
        title={t("shopUi.cartTitle")}
        lead={hasTotal ? t("shopUi.cartLead") : undefined}
      />

      <div className={`ui-container crt-layout ${hasTotal ? "has-summary" : ""}`}>
        {cartItems.length > 0 && (
          <section className="crt-items" aria-label={t("shopUi.cartTitle")}>
            <ul className="crt-list">
              {cartItems.map((product) => (
                <CartItem
                  key={`${product._id}-${product.color}`}
                  data={product}
                />
              ))}
            </ul>
          </section>
        )}

        {hasTotal ? (
          <aside className="crt-summary ui-glass" aria-labelledby="crt-summary-title">
            <h2 id="crt-summary-title" className="crt-summary__title">{t("shopUi.summaryTitle")}</h2>
            <dl className="crt-rows">
              <div className="crt-row">
                <dt>{t("shopUi.items")}</dt>
                <dd>{money(total)}</dd>
              </div>
              <div className="crt-row">
                <dt>{t("shopUi.shipping")}</dt>
                <dd>{money(5)}</dd>
              </div>
              <div className="crt-row crt-row--sub">
                <dt>{t("shopUi.subtotal")}</dt>
                <dd>{money(totalAmount)}</dd>
              </div>
              <div className="crt-row crt-row--discount">
                <dt>{t("shopUi.discount")}</dt>
                <dd>−{money(discountShown)}</dd>
              </div>
              <div className="crt-row crt-row--total">
                <dt>{t("shopUi.total")}</dt>
                <dd>{money(discountAmount)}</dd>
              </div>
            </dl>

            <button
              type="button"
              className="ui-btn ui-btn--gold crt-summary__checkout"
              onClick={() => navigate("/checkout", { state: { discountAmount, cartItems } })}
            >
              <i className="fas fa-lock" aria-hidden="true"></i>
              {t("cart.checkout")}
            </button>
            <button type="button" className="ui-btn ui-btn--ghost crt-summary__continue" onClick={() => navigate("/shop")}>
              {t("cart.continueShopping")}
            </button>
            <p className="crt-summary__secure">
              <i className="fab fa-paypal" aria-hidden="true"></i>
              {t("shopUi.secure")}
            </p>
          </aside>
        ) : (
          <div className="shp-state ui-glass crt-empty">
            <span className="shp-state__icon" aria-hidden="true">
              <i className="fas fa-shopping-basket"></i>
            </span>
            <h2 className="shp-state__title">{t("cart.emptyCart")}</h2>
            <p className="shp-state__text">{t("shopUi.emptyLead")}</p>
            <div className="shp-state__actions">
              <button type="button" className="ui-btn ui-btn--gold" onClick={() => navigate("/shop")}>
                {t("cart.backToShopping")}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default Cart;
