import React from "react";
import { Link } from "react-router-dom";
import "./shopUi.css";
import "./product.css";

// One glass card in the shop grid; the whole card links to the product page.
const Product = ({ item }) => {
  const { _id, name, price, img } = item;

  return (
    <article className="shp-card ui-glass">
      <Link className="shp-card__link" to={{ pathname: `/product/${_id}`, state: { productId: _id } }}>
        <span className="shp-card__media">
          <img className="shp-card__img" src={img} alt={name} loading="lazy" decoding="async" />
        </span>
        <span className="shp-card__body">
          <span className="shp-card__name">{name}</span>
          <span className="shp-card__foot">
            <span className="shp-card__price">${price}</span>
            <span className="shp-card__go" aria-hidden="true">
              <i className="fas fa-arrow-right"></i>
            </span>
          </span>
        </span>
      </Link>
    </article>
  );
};

export default Product;
