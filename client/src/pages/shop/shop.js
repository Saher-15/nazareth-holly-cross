import React, { useState, useEffect } from "react";
import axios from "axios";
import Product from "./product";
import "./shop.css";
import LoadingLogo from "./loading"; // Assuming you have a LoadingLogo component
import { useShopContext } from "../../context/shop-context";
import { Link } from "react-router-dom"; // Import Link from react-router-dom
import { useTranslation } from 'react-i18next'; // Import useTranslation from i18next
import { API_URL } from '../../config/env';

const Shop = () => {
  const { t } = useTranslation(); // Initialize the translation function
  const { getTotalCartQuantity } = useShopContext(); // Get the total cart quantity from context
  const [allProducts, setAllProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(
    () => Number(localStorage.getItem('currentPage')) || 1
  );
  const [sortOrder, setSortOrder] = useState(
    localStorage.getItem('sortOrder') || "rateDesc"
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(
    localStorage.getItem('searchQuery') || ""
  );
  const itemsPerPage = 15;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const allProductsResponse = await axios.get(
          `${API_URL}/product/getAllProducts`
        );
        window.scrollTo(0, 0); // Scroll to the top when going to the previous page
        setAllProducts(allProductsResponse.data);
      } catch (error) {
        console.error("Error fetching products:");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentPage]);

  useEffect(() => {
    // Save the current page, sort order, and search query to localStorage
    localStorage.setItem('currentPage', currentPage);
    localStorage.setItem('sortOrder', sortOrder);
    localStorage.setItem('searchQuery', searchQuery);
  }, [currentPage, sortOrder, searchQuery]);

  const handleSortOrderChange = (event) => {
    setSortOrder(event.target.value);
    setCurrentPage(1); // Reset to the first page on sort change
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value.toLowerCase());
    setCurrentPage(1); // Reset to the first page on search
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSortOrder("rateDesc");
    setCurrentPage(1);
    localStorage.removeItem('searchQuery');
    localStorage.removeItem('sortOrder');
    localStorage.setItem('currentPage', 1); // Ensure the page resets to 1
  };

  const filteredProducts = allProducts.filter((product) =>
    product.name.toLowerCase().includes(searchQuery)
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortOrder === "lowToHigh") {
      return a.price - b.price;
    } else if (sortOrder === "highToLow") {
      return b.price - a.price;
    } else if (sortOrder === "rateDesc") {
      return b.rate - a.rate;
    } else {
      return 0;
    }
  });

  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const nextPage = () => {
    if (currentPage * itemsPerPage < sortedProducts.length) {
      setCurrentPage(prevPage => prevPage + 1);
      window.scrollTo(0, 0); // Scroll to the top when going to the previous page
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prevPage => prevPage - 1);
      window.scrollTo(0, 0); // Scroll to the top when going to the previous page
    }
  };

  const totalCartQuantity = getTotalCartQuantity(); // Get the total quantity of items in the cart

  return (
    <div className="shop-page">
      {loading ? (
        <LoadingLogo />
      ) : (
        <>
          <div className="header-filter">
            <input
              type="text"
              placeholder={t("shop.searchPlaceholder")} // Use translation for the placeholder
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
            />
            <div className="sort">
              <select
                id="sortOrder"
                value={sortOrder}
                onChange={handleSortOrderChange}
              >
                <option value="rateDesc">{t("shop.sortNone")}</option>
                <option value="lowToHigh">{t("shop.sortLowToHigh")}</option>
                <option value="highToLow">{t("shop.sortHighToLow")}</option>
              </select>
              <button onClick={handleResetFilters} className="reset-filters">
                <i className="fas fa-redo"></i> {t("shop.resetFilters")}
              </button>
            </div>
          </div>

          <div className="button-container">
            <Link to="/cart" className="cart-link-logo">
              <i className="fas fa-shopping-cart"></i>
              {totalCartQuantity > 0 && <div className="cart-item-count">{totalCartQuantity}</div>}
            </Link>
          </div>

          {paginatedProducts.length === 0 ? (
            <div className="no-products-message">
              <p>{t("shop.noProducts")}</p> {/* Use translation for the message */}
            </div>
          ) : (
            <>
              <div className="products">
                {paginatedProducts.map((item) => (
                  <Product key={item._id} item={item} />
                ))}
              </div>
              <div className="pagination">
                <button onClick={prevPage} disabled={currentPage === 1}>
                  {t("pagination.prev")} {/* Use translation for the Prev button */}
                </button>
                <span>
                  {t("shop.pagination", { currentPage, totalPages: Math.ceil(sortedProducts.length / itemsPerPage)})}
                </span>
                <button onClick={nextPage} disabled={currentPage * itemsPerPage >= sortedProducts.length}>
                  {t("pagination.next")} {/* Use translation for the Next button */}
                </button>
              </div>

            </>
          )}
        </>
      )}
    </div>
  );
};

export default Shop;
