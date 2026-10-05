import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import '../styles/Pages.css';
import { SiGooglemaps } from "react-icons/si";
import "../App.css";


const Nazareth = () => {
  const { t } = useTranslation(); // Initialize translation function
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);
  const [isPinch, setIsPinch] = useState(false);
  
  const images = [
    "images/nazareth/nazareth1.webp",
    "images/nazareth/nazareth2.jpg",
    "images/nazareth/nazareth3.jpg",
    "images/nazareth/nazareth4.jpg",
    "images/nazareth/nazareth5.jpg",
    "images/nazareth/nazareth6.jpg",
    "images/nazareth/nazareth7.webp",
    "images/nazareth/nazareth8.webp",
    "images/nazareth/nazareth9.jpg",
    "images/nazareth/nazareth10.jpg",
    "images/nazareth/nazareth11.jpg",
    "images/nazareth/nazareth12.jpg",
  ];

  const handleClickMap = () => {
    window.open('https://www.google.com/maps/place/Nazareth+City+center/@32.7012442,35.2981717,17z/data=!3m1!4b1!4m6!3m5!1s0x151c4dd4b3386aef:0x652378b0cec4d358!8m2!3d32.7012442!4d35.2981717!16s%2Fg%2F11c5s6wx03?entry=ttu', '_blank');
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
    setSelectedImageIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
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
        <h1>
          {t('headerTitleNaz')}
          <SiGooglemaps className="map-btn" onClick={handleClickMap} />
        </h1>
      </div>
      <div className='content'>
        <p>{t('contentNaz.introduction')}</p>
        <h2>{t('contentNaz.historicalSignificance.title')}</h2>
        <p>{t('contentNaz.historicalSignificance.text')}</p>
        <h2>{t('contentNaz.modernNazareth.title')}</h2>
        <p>{t('contentNaz.modernNazareth.text')}</p>
        <h2>{t('contentNaz.accessibility.title')}</h2>
        <p>{t('contentNaz.accessibility.text')}</p>
      </div>
      <div className="gallery">
        <div className="gallery-queue">
          {images.map((image, index) => (
            <img
              key={index}
              src={image}
              alt={`nazareth ${index + 1}`}
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

export default Nazareth;
