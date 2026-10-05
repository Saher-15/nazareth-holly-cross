import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import "./shopUi.css";
import "./productPage.css";
import { useShopContext } from "../../context/shop-context";
import { ProductPageSkeleton } from './loading';
import CartPill from './CartPill';
import QuantityStepper from './QuantityStepper';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../../config/env';

const MAX_QTY = 99;

const ProductPage = () => {
  const { t } = useTranslation();
  const { addToCart, updateCartItemCount, cartItems, getTotalCartQuantity } = useShopContext();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [currentImage, setCurrentImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0); // bumped by the "Try again" button
  const [showMessage, setShowMessage] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [zoomStyle, setZoomStyle] = useState({});
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [isZoomVisible, setIsZoomVisible] = useState(false);
  const [selectedColor, setSelectedColor] = useState('');
  const [colorSelectionMessage, setColorSelectionMessage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const addedTimer = useRef(null);
  const colorTimer = useRef(null);
  const mainImageButton = useRef(null);
  const closeButton = useRef(null);

  const totalCartQuantity = getTotalCartQuantity(); // Get total quantity of items in the cart

  useEffect(() => {
    window.scrollTo(0, 0); // Scroll to the top of the page when the component mounts

    const fetchProduct = async () => {
      try {
        const response = await fetch(`${API_URL}/product/getProduct/${id}`);
        if (!response.ok) throw new Error(t('product.message.error.fetchProduct'));
        const data = await response.json();
        setProduct(data);
        setError(null);
        // Reset color, image and quantity selection when product changes
        setSelectedColor('');
        setColorSelectionMessage('');
        setCurrentImage(0);
        setQuantity(1);
      } catch (error) {
        console.error('Error fetching product:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, t, attempt]);

  useEffect(() => {
    document.body.style.overflow = isZoomModalOpen ? 'hidden' : ''; // Toggle body scroll
    return () => { document.body.style.overflow = ''; }; // Clean up on component unmount
  }, [isZoomModalOpen]);

  // Zoom dialog: focus the close button, close on Escape, give focus back afterwards.
  useEffect(() => {
    if (!isZoomModalOpen) return undefined;
    const opener = mainImageButton.current;
    if (closeButton.current) closeButton.current.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setZoomedImage(null);
        setIsZoomModalOpen(false);
        setIsZoomVisible(false);
      }
      if (e.key === 'Tab') { e.preventDefault(); if (closeButton.current) closeButton.current.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener) opener.focus();
    };
  }, [isZoomModalOpen]);

  // Clear pending message timers when leaving the page.
  useEffect(() => () => {
    clearTimeout(addedTimer.current);
    clearTimeout(colorTimer.current);
  }, []);

  const handleAddToCart = () => {
    if (!selectedColor && product.color && product.color.length > 0) {
      setColorSelectionMessage(t('product.message.error.selectColor'));
      clearTimeout(colorTimer.current);
      colorTimer.current = setTimeout(() => setColorSelectionMessage(''), 2000);
      return;
    }

    // Determine the correct image based on the selected color
    let selectedImage = product.img; // Default to main image

    if (product.color && product.color.length > 0 && selectedColor) {
      const colorIndex = product.color.indexOf(selectedColor);
      if (colorIndex !== -1 && product.additionalImageUrls && product.additionalImageUrls.length > colorIndex) {
        selectedImage = product.additionalImageUrls[colorIndex]; // Set image to corresponding additional image
      }
    }

    const item = {
      _id: product._id,
      name: product.name,
      price: product.price,
      img: selectedImage, // Use the determined image
      color: selectedColor // Ensure this is a single color, not an array
    };

    addToCart(item);
    if (quantity > 1) {
      // addToCart adds one; the stepper's extra units are set on the same cart line.
      const existing = cartItems.find((ci) => ci._id === item._id && ci.color === item.color);
      updateCartItemCount(item._id, item.color, (existing ? existing.quantity : 0) + quantity);
    }
    setQuantity(1);
    setColorSelectionMessage('');
    setShowMessage(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setShowMessage(false), 2000);
  };

  const openZoomModal = (image) => {
    setZoomedImage(image);
    setZoomStyle({
      backgroundImage: `url(${image})`,
      backgroundSize: '200%',
    });
    setIsZoomModalOpen(true);
  };

  const closeZoomModal = () => {
    setZoomedImage(null);
    setIsZoomModalOpen(false);
    setIsZoomVisible(false);
  };

  const handleMouseMove = (e) => {
    if (!zoomedImage) return;

    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setZoomStyle((prevStyle) => ({
      ...prevStyle,
      backgroundPosition: `${x}% ${y}%`,
    }));

    setIsZoomVisible(true);
  };

  const handleMouseLeave = () => {
    setIsZoomVisible(false);
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    setAttempt((a) => a + 1);
  };

  const topBar = (
    <div className="ui-container pdp-top">
      <Link to="/shop" className="pdp-back">
        <i className="fas fa-arrow-left" aria-hidden="true"></i>
        <span>{t('cart.continueShopping')}</span>
      </Link>
      <CartPill count={totalCartQuantity} />
    </div>
  );

  if (loading) {
    return (
      <main className="ui-page pdp-page">
        {topBar}
        <ProductPageSkeleton />
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="ui-page pdp-page">
        {topBar}
        <div className="ui-container">
          <div className="shp-state ui-glass" role="alert">
            <span className="shp-state__icon shp-state__icon--error" aria-hidden="true">
              <i className={`fas ${error ? 'fa-exclamation-triangle' : 'fa-box-open'}`}></i>
            </span>
            <p className="shp-state__title">
              {error ? t('product.message.error.fetchProduct') : t('product.error.productNotFound')}
            </p>
            <div className="shp-state__actions">
              {error && (
                <button type="button" className="ui-btn ui-btn--gold" onClick={retry}>
                  <i className="fas fa-redo" aria-hidden="true"></i> {t('home.retry')}
                </button>
              )}
              <Link to="/shop" className="ui-btn ui-btn--ghost">{t('cart.backToShopping')}</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const { name, price, img, description, color } = product;
  const additionalImageUrls = product.additionalImageUrls || [];
  const images = [img, ...additionalImageUrls];
  const currentSrc = currentImage === 0 ? img : (additionalImageUrls[currentImage - 1] || img);
  const showColorChips = color && color.length > 0 && name !== 'Nazareth city puzzle';

  const handleImageClick = (index) => {
    if (color && color.length > 0) {
      if (index === 0) {
        // Main image click: reset color and set first additional image
        setSelectedColor('');
        setCurrentImage(0);
      } else {
        // Additional image click: update color based on image index
        setSelectedColor(color[index - 1]); // Set color based on image index
        setCurrentImage(index);
      }
    } else {
      // If no colors, simply change the current image
      setCurrentImage(index);
    }
  };

  return (
    <main className="ui-page pdp-page">
      {topBar}

      <article className="ui-container pdp">
        <div className="pdp-gallery">
          <button
            type="button"
            ref={mainImageButton}
            className="pdp-main"
            onClick={() => openZoomModal(currentSrc)}
            aria-label={`${t('shopUi.enlarge')}: ${name}`}
          >
            <img key={currentSrc} className="pdp-main__img" src={currentSrc} alt={name} />
            <span className="pdp-main__zoom" aria-hidden="true">
              <i className="fas fa-search-plus"></i>
            </span>
          </button>

          {images.length > 1 && (
            <ul className="pdp-thumbs">
              {images.map((src, index) => (
                <li key={`${index}-${src}`}>
                  <button
                    type="button"
                    className={`pdp-thumb ${currentImage === index ? 'is-active' : ''}`}
                    onClick={() => handleImageClick(index)}
                    aria-pressed={currentImage === index}
                    aria-label={t('shopUi.showImage', { n: index + 1 })}
                  >
                    <img src={src} alt="" loading="lazy" decoding="async" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pdp-info">
          <p className="ui-eyebrow">{t('home.shopEyebrow')}</p>
          <h1 className="pdp-title">{name}</h1>
          <p className="pdp-price">${price}</p>
          {description && <p className="pdp-desc">{description}</p>}

          {showColorChips && (
            <fieldset className="pdp-colors">
              <legend className="pdp-label">{t('shopUi.colour')}</legend>
              <div className="pdp-colors__list">
                {color.map((colorValue, index) => (
                  <button
                    type="button"
                    key={colorValue}
                    className={`pdp-chip ${selectedColor === colorValue ? 'is-selected' : ''}`}
                    style={{ backgroundColor: colorValue }}
                    aria-pressed={selectedColor === colorValue}
                    aria-label={`${t('shopUi.colour')}: ${colorValue}`}
                    title={colorValue}
                    onClick={() => {
                      setSelectedColor(colorValue);
                      setCurrentImage(index + 1); // Change image to match color
                    }}
                  />
                ))}
              </div>
            </fieldset>
          )}

          <div className="pdp-buy">
            <div className="pdp-buy__qty">
              <span className="pdp-label" aria-hidden="true">{t('cart.quantity')}</span>
              <QuantityStepper
                value={quantity}
                onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
                onIncrease={() => setQuantity((q) => Math.min(MAX_QTY, q + 1))}
                decreaseDisabled={quantity <= 1}
                increaseDisabled={quantity >= MAX_QTY}
              />
            </div>
            <button
              type="button"
              className={`ui-btn ui-btn--gold pdp-add ${showMessage ? 'is-added' : ''}`}
              onClick={handleAddToCart}
            >
              <i className={`fas ${showMessage ? 'fa-check' : 'fa-cart-plus'}`} aria-hidden="true"></i>
              <span>{showMessage ? t('shopUi.added') : t('product.button.addToCart')}</span>
            </button>
          </div>

          <div className="pdp-feedback" role="status" aria-live="polite">
            {showMessage && (
              <p className="pdp-msg pdp-msg--ok">
                <i className="fas fa-check-circle" aria-hidden="true"></i>
                <span>{t('product.message.productAdded')}</span>
                <Link to="/cart" className="pdp-msg__link">{t('shopUi.viewCart')}</Link>
              </p>
            )}
            {colorSelectionMessage && (
              <p className="pdp-msg pdp-msg--warn">
                <i className="fas fa-palette" aria-hidden="true"></i>
                <span>{colorSelectionMessage}</span>
              </p>
            )}
          </div>

          <p className="pdp-note">
            <i className="fas fa-truck" aria-hidden="true"></i>
            <span>{t('product.note.shippingFee')}</span>
          </p>
        </div>
      </article>

      {/* Zoom Modal */}
      {isZoomModalOpen && (
        <div className="pdp-zoom" role="dialog" aria-modal="true" aria-label={name} onClick={closeZoomModal}>
          <button type="button" ref={closeButton} className="pdp-zoom__close" onClick={closeZoomModal} aria-label={t('shopUi.close')}>
            <i className="fas fa-times" aria-hidden="true"></i>
          </button>
          <div
            className={`pdp-zoom__img ${isZoomVisible ? 'visible' : 'hidden'}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onTouchMove={(e) => handleMouseMove(e.touches[0])} // Support touch devices
            onTouchEnd={handleMouseLeave} // Support touch devices
            style={zoomStyle}
            role="img"
            aria-label={name}
          />
        </div>
      )}
    </main>
  );
};

export default ProductPage;
