import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import "../shop/productPage.css";
import { useShopContext } from "../../context/shop-context";
import LoadingLogo from './loading'; // Import your LoadingLogo component
import { useTranslation } from 'react-i18next'; // Import the translation hook
import { API_URL } from '../../config';

const ProductPage = () => {
  const { t } = useTranslation(); // Initialize translation
  const { addToCart, getTotalCartQuantity } = useShopContext();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [currentImage, setCurrentImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMessage, setShowMessage] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [zoomStyle, setZoomStyle] = useState({});
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [isZoomVisible, setIsZoomVisible] = useState(false);
  const [selectedColor, setSelectedColor] = useState('');
  const [colorSelectionMessage, setColorSelectionMessage] = useState('');

  const totalCartQuantity = getTotalCartQuantity(); // Get total quantity of items in the cart

  useEffect(() => {
    window.scrollTo(0, 0); // Scroll to the top of the page when the component mounts

    const fetchProduct = async () => {
      try {
        const response = await fetch(`${API_URL}/product/getProduct/${id}`);
        if (!response.ok) throw new Error(t('product.product.error.fetchProduct')); // Use translation for error message
        const data = await response.json();
        setProduct(data);
        // Reset color selection and message when product changes
        setSelectedColor('');
        setColorSelectionMessage('');
      } catch (error) {
        console.error('Error fetching product:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, t]);

  useEffect(() => {
    document.body.style.overflow = isZoomModalOpen ? 'hidden' : ''; // Toggle body scroll
    return () => { document.body.style.overflow = ''; }; // Clean up on component unmount
  }, [isZoomModalOpen]);

  const handleAddToCart = () => {
    if (!selectedColor && product.color && product.color.length > 0) {
      setColorSelectionMessage(t('product.error.selectColor')); // Use translation for color selection message
      setTimeout(() => setColorSelectionMessage(''), 2000);
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
    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 2000);
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

  if (loading) {
    return <LoadingLogo />;
  }

  if (error) {
    return <div className="error-message">{t('product.error.message', { error })}</div>; // Use translation for error message
  }

  if (!product) {
    return <div className="error-message">{t('product.error.productNotFound')}</div>; // Use translation for product not found message
  }

  const { name, price, img, description, additionalImageUrls, color } = product;

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
    <div className="product-container">
      <div className="button-container">
        <Link to="/cart" className="cart-link-logo">
          <i className="fas fa-shopping-cart"></i>
          {totalCartQuantity > 0 && <div className="cart-item-count">{totalCartQuantity}</div>}
        </Link>
      </div>

      <div className="product-details">
        <div className="image-container">
          <img
            className="product-image"
            src={currentImage === 0 ? img : additionalImageUrls[currentImage - 1]}
            alt={name}
            onClick={() => openZoomModal(currentImage === 0 ? img : additionalImageUrls[currentImage - 1])}
          />
          <div className="centered-content">
            <button
              className="add-to-cart-button"
              onClick={handleAddToCart}
            >
              {t('product.button.addToCart')} {/* Use translation for button text */}
            </button>
            {showMessage && <div className="message">{t('product.message.productAdded')}</div>} {/* Use translation for added message */}
            {colorSelectionMessage && <div className="color-selection-message">{colorSelectionMessage}</div>}
          </div>
        </div>
        <div className="description">
          <h1 className="product-name">{name}</h1>

          <div className="other-product-images">
            <img
              src={img}
              key="main"
              onClick={() => handleImageClick(0)} // Handle click for the main image
              alt={name}
              className={`thumbnail ${currentImage === 0 ? 'active' : ''}`}
            />
            {additionalImageUrls.map((imageObj, index) => (
              <img
                src={imageObj}
                key="main"
                onClick={() => handleImageClick(index + 1)} // Handle click for additional images
                alt={name}
                className={`thumbnail ${currentImage === index + 1 ? 'active' : ''}`}
              />
            ))}
          </div>
          {color && color.length > 0 && name !== 'Nazareth city puzzle' && (
            <div className="color-select">
              <div className="color-circles">
                {color.map((colorValue, index) => (
                  <div
                    key={colorValue}
                    className={`color-circle ${selectedColor === colorValue ? 'selected' : ''}`}
                    style={{ backgroundColor: colorValue }}
                    onClick={() => {
                      setSelectedColor(colorValue);
                      setCurrentImage(index + 1); // Change image to match color
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <p className="product-price">{price}$</p>
          <p className="product-description">{description}</p>
          <p className="shipping-note-product-page">
            {t('product.note.shippingFee')} {/* Use translation for shipping note */}
          </p>
        </div>
      </div>

      {/* Zoom Modal */}
      {isZoomModalOpen && (
        <div className="zoom-modal" onClick={closeZoomModal}>
          <div
            className={`zoomed-image ${isZoomVisible ? 'visible' : 'hidden'}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onTouchMove={(e) => handleMouseMove(e.touches[0])} // Support touch devices
            onTouchEnd={handleMouseLeave} // Support touch devices
            style={zoomStyle}
          />
        </div>
      )}
    </div>
  );
};

export default ProductPage;
