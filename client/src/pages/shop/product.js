import React from "react";
// import { useShopContext } from "../../context/shop-context";
import { Link } from "react-router-dom";
import "../shop/product.css";

const Product = ({ item }) => {
  const { _id, name, price, img } = item;
  // const { getTotalCartQuantity } = useShopContext(); // Get the function to calculate total cart quantity

  // Calculate the total quantity of all items in the cart
  // const totalCartQuantity = getTotalCartQuantity();

  return (
    <div className="product">
      <Link to={{ pathname: `/product/${_id}`, state: { productId: _id } }}>
        <img className="img-size" src={img} alt={name} />
      </Link>
      <p className="nameCard">{name}</p>
      <p className="price">${price}</p> {/* Changed class to price */}
    </div>
  );
};

export default Product;
