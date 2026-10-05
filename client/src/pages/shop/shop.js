import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Product from "./product";
import "./shopUi.css";
import "./shop.css";
import { ProductGridSkeleton } from "./loading";
import CartPill from "./CartPill";
import PageHero from "../../components/ui/PageHero";
import Reveal from "../../components/ui/Reveal";
import { useShopContext } from "../../context/shop-context";
import { useTranslation } from 'react-i18next';
import { API_URL } from '../../config/env';

const Shop = () => {
  const { t } = useTranslation();
  const { getTotalCartQuantity } = useShopContext(); // Get the total cart quantity from context
  const [allProducts, setAllProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(
    () => Number(localStorage.getItem('currentPage')) || 1
  );
  const [sortOrder, setSortOrder] = useState(
    localStorage.getItem('sortOrder') || "rateDesc"
  );
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0); // bumped by the "Try again" button
  const [searchQuery, setSearchQuery] = useState(
    localStorage.getItem('searchQuery') || ""
  );
  const itemsPerPage = 15;
  const barSentinel = useRef(null);
  const [barStuck, setBarStuck] = useState(false);

  // Marks the filter bar as "stuck" once it sits under the navbar (purely visual).
  useEffect(() => {
    const el = barSentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const top = parseFloat(getComputedStyle(el).getPropertyValue('--shop-sticky-top')) || 80;
    const io = new IntersectionObserver(
      ([entry]) => setBarStuck(!entry.isIntersecting && entry.boundingClientRect.top < top),
      { rootMargin: `-${top}px 0px 0px 0px` }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const allProductsResponse = await axios.get(
          `${API_URL}/product/getAllProducts`
        );
        window.scrollTo(0, 0); // Scroll to the top when going to the previous page
        setAllProducts(allProductsResponse.data);
        setLoadFailed(false);
      } catch (error) {
        console.error("Error fetching products:");
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentPage, attempt]);

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
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const pageLabel = t("shop.pagination", { currentPage, totalPages });
  const firstShown = (currentPage - 1) * itemsPerPage + 1;
  const lastShown = firstShown + paginatedProducts.length - 1;

  let content;
  if (loading) {
    content = <ProductGridSkeleton count={8} />;
  } else if (loadFailed) {
    content = (
      <div className="shp-state ui-glass" role="alert">
        <span className="shp-state__icon shp-state__icon--error" aria-hidden="true">
          <i className="fas fa-exclamation-triangle"></i>
        </span>
        <p className="shp-state__title">{t("shopUi.loadError")}</p>
        <div className="shp-state__actions">
          <button type="button" className="ui-btn ui-btn--gold" onClick={() => setAttempt((a) => a + 1)}>
            <i className="fas fa-redo" aria-hidden="true"></i> {t("home.retry")}
          </button>
        </div>
      </div>
    );
  } else if (paginatedProducts.length === 0) {
    content = (
      <div className="shp-state ui-glass" role="status">
        <span className="shp-state__icon" aria-hidden="true">
          <i className="fas fa-search"></i>
        </span>
        <p className="shp-state__title">{t("shop.noProducts")}</p>
        <div className="shp-state__actions">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={handleResetFilters}>
            <i className="fas fa-redo" aria-hidden="true"></i> {t("shop.resetFilters")}
          </button>
        </div>
      </div>
    );
  } else {
    content = (
      <>
        <p className="shp-count" aria-live="polite">
          {t("shopUi.showing", { from: firstShown, to: lastShown, total: sortedProducts.length })}
        </p>
        <ul className="shp-grid">
          {paginatedProducts.map((item, i) => (
            <Reveal as="li" key={item._id} className="shp-grid__item" delay={(i % 4) * 70}>
              <Product item={item} />
            </Reveal>
          ))}
        </ul>
        <nav className="shp-pager" aria-label={pageLabel}>
          <button type="button" className="ui-btn ui-btn--glass shp-pager__btn" onClick={prevPage} disabled={currentPage === 1}>
            <i className="fas fa-arrow-left" aria-hidden="true"></i>
            <span>{t("pagination.prev")}</span>
          </button>
          <span className="shp-pager__label">{pageLabel}</span>
          <button type="button" className="ui-btn ui-btn--glass shp-pager__btn" onClick={nextPage} disabled={currentPage * itemsPerPage >= sortedProducts.length}>
            <span>{t("pagination.next")}</span>
            <i className="fas fa-arrow-right" aria-hidden="true"></i>
          </button>
        </nav>
      </>
    );
  }

  return (
    <main className="ui-page shp-page">
      <PageHero
        eyebrow={t("home.shopEyebrow")}
        title={t("shopUi.heroTitle")}
        lead={t("shopUi.heroLead")}
        image="/images/vitrage-bg.jpg"
      />

      <div ref={barSentinel} className="shp-bar-sentinel" aria-hidden="true" />
      <div className={`shp-bar-wrap ${barStuck ? "is-stuck" : ""}`}>
        <div className="ui-container">
          <div className="shp-bar" role="search">
            <div className="shp-bar__search">
              <label htmlFor="shop-search" className="shp-sr">{t("shopUi.searchLabel")}</label>
              <i className="fas fa-search shp-bar__search-icon" aria-hidden="true"></i>
              <input
                id="shop-search"
                type="text"
                placeholder={t("shop.searchPlaceholder")}
                value={searchQuery}
                onChange={handleSearchChange}
                className="ui-input shp-bar__input"
                autoComplete="off"
              />
            </div>
            <div className="shp-bar__tools">
              <label htmlFor="sortOrder" className="shp-bar__label">{t("shopUi.sortLabel")}</label>
              <select
                id="sortOrder"
                className="ui-select shp-bar__select"
                value={sortOrder}
                onChange={handleSortOrderChange}
              >
                <option value="rateDesc">{t("shop.sortNone")}</option>
                <option value="lowToHigh">{t("shop.sortLowToHigh")}</option>
                <option value="highToLow">{t("shop.sortHighToLow")}</option>
              </select>
              <button type="button" onClick={handleResetFilters} className="shp-bar__reset" title={t("shop.resetFilters")}>
                <i className="fas fa-redo" aria-hidden="true"></i>
                <span className="shp-bar__reset-text">{t("shop.resetFilters")}</span>
              </button>
              <CartPill count={totalCartQuantity} className="shp-bar__cart" />
            </div>
          </div>
        </div>
      </div>

      <section className="ui-container shp-results" aria-busy={loading}>
        {content}
      </section>
    </main>
  );
};

export default Shop;
