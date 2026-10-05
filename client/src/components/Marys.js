import React, { useState, useEffect, useCallback } from 'react';
import '../styles/Pages.css';
import { SiGooglemaps } from "react-icons/si";
import "../App.css";
import { useTranslation } from 'react-i18next'; // Import translation hook

const Marys = () => {
  const { t } = useTranslation(); // Hook to access translation function
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);
  const [isPinch, setIsPinch] = useState(false);
  
  const images = [
    "images/mary/mary1.jpg",
    "images/mary/mary2.jpg",
    "images/mary/mary3.jpg",
    "images/mary/mary4.jpg",
    "images/mary/mary5.jpg",
    "images/mary/mary6.jpg",
    "images/mary/mary7.jpg",
  ];

  const handleClickMap = () => {
    window.open('https://www.google.com/maps/place/Mary%E2%80%99s+Well/@32.7035145,35.296555,14z/data=!4m6!3m5!1s0x151c4c29c6d1008d:0x23e218b489e18311!8m2!3d32.7060586!4d35.3013417!16zL20vMGY3XzJ2?entry=ttu', '_blank');
  };

  const handleImageClick = useCallback((index) => {
    setSelectedImageIndex(index);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedImageIndex(null);
  }, []);

  const handleNextImage = useCallback(() => {
    setSelectedImageIndex((prevIndex) => (prevIndex + 1) % images.length);
  }, [images.length]);

  const handlePrevImage = useCallback(() => {
    setSelectedImageIndex((prevIndex) =>
      (prevIndex - 1 + images.length) % images.length
    );
  }, [images.length]);

  useEffect(() => {
    // Scroll to the top of the page when the component mounts
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (selectedImageIndex !== null) {
        if (event.key === 'ArrowRight') {
          handleNextImage();
        } else if (event.key === 'ArrowLeft') {
          handlePrevImage();
        } else if (event.key === 'Escape') {
          handleCloseModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedImageIndex, handleNextImage, handlePrevImage, handleCloseModal]);

  useEffect(() => {
    const handleTouchStart = (event) => {
      if (event.touches.length === 1) {
        setTouchStartX(event.touches[0].clientX);
        setIsPinch(false);
      } else {
        setIsPinch(true);
      }
    };

    const handleTouchMove = (event) => {
      if (event.touches.length === 1) {
        setTouchEndX(event.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      if (touchStartX !== null && touchEndX !== null && !isPinch) {
        const diffX = touchStartX - touchEndX;

        if (Math.abs(diffX) > 50) {
          if (diffX > 0) {
            handleNextImage(); // Swipe left
          } else {
            handlePrevImage(); // Swipe right
          }
        }
      }

      // Reset touch states
      setTouchStartX(null);
      setTouchEndX(null);
      setIsPinch(false);
    };

    if (selectedImageIndex !== null) {
      window.addEventListener('touchstart', handleTouchStart);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [selectedImageIndex, touchStartX, touchEndX, isPinch, handleNextImage, handlePrevImage]);

  return (
    <div className='mypage'>
      <div className='header'>
        <h1>{t('headerMary.title')}
          <SiGooglemaps
            className="map-btn"
            onClick={handleClickMap}
          />
        </h1>
      </div>
      <div className='content'>
        <p>{t('contentMary.intro')}</p>
        <p>
          <strong>{t('contentMary.significance.title')}:</strong>
          <ul>
            <li>
            contentMary            </li>
            <li>
              <strong>{t('contentMary.significance.cultural')}</strong>: {t('contentMary.significance.culturalText')}
            </li>
            <li>
              <strong>{t('contentMary.significance.architecture')}</strong>: {t('contentMary.significance.architectureText')}
            </li>
          </ul>
        </p>
        <p>
          <strong>{t('contentMary.modern.title')}:</strong>
          <ul>
            <li>
              <strong>{t('contentMary.modern.restoration')}</strong>: {t('contentMary.modern.restorationText')}
            </li>
            <li>
              <strong>{t('contentMary.modern.attraction')}</strong>: {t('contentMary.modern.attractionText')}
            </li>
            <li>
              <strong>{t('contentMary.modern.surroundings')}</strong>: {t('contentMary.modern.surroundingsText')}
            </li>
          </ul>
        </p>
        <p>
          <strong>{t('contentMary.visiting.title')}:</strong>
          <ul>
            <li>
              <strong>{t('contentMary.visiting.location')}</strong>: {t('contentMary.visiting.locationText')}
            </li>
            <li>
              <strong>{t('contentMary.visiting.accessibility')}</strong>: {t('contentMary.visiting.accessibilityText')}
            </li>
            <li>
              <strong>{t('contentMary.visiting.culturalExperience')}</strong>: {t('contentMary.visiting.culturalExperienceText')}
            </li>
          </ul>
        </p>
      </div>
      <div className="gallery">
        <div className="gallery-queue">
          {images.map((image, index) => (
            <img
              key={index}
              src={image}
              alt={`Mary's Well ${index + 1}`}
              onClick={() => handleImageClick(index)}
            />
          ))}
        </div>
      </div>

      {selectedImageIndex !== null && (
        <div className="modal" onClick={handleCloseModal}>
          <span className="close">&times;</span>
          <img
            className="modal-content"
            src={images[selectedImageIndex]}
            alt={`Enlarged view ${selectedImageIndex + 1}`}
          />
          <button
            className="prev"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevImage();
            }}
          >
            &#10094;
          </button>
          <button
            className="next"
            onClick={(e) => {
              e.stopPropagation();
              handleNextImage();
            }}
          >
            &#10095;
          </button>
        </div>
      )}
    </div>
  );
}

export default Marys;
