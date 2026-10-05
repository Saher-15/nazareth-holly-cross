import React, { useState, useEffect, useCallback } from 'react';
import '../styles/Pages.css';
import { SiGooglemaps } from "react-icons/si";
import "../App.css";
import { useTranslation } from 'react-i18next'; // Import the useTranslation hook

const OldNazareth = () => {
  const { t } = useTranslation(); // Initialize the translation function
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);
  const [isPinch, setIsPinch] = useState(false);
  const images = [
    "images/old/old1.jpg",
    "images/old/old2.jpg",
    "images/old/old3.jpg",    
    "images/old/old4.jpg",
    "images/old/old5.webp",
    "images/old/old6.jpg",
    "images/old/old7.jpg",
    "images/old/old8.jpg",
    "images/old/old9.jpg",
    "images/old/old10.jpg",
    "images/old/old11.jpg",
    "images/old/old12.jpg",
    "images/old/old13.jpg",
    "images/old/old14.jpg",
    "images/old/old15.jpg",
    "images/old/old16.jpg",
  ];

  const handleClickMap = () => {
    window.open('https://www.google.com/maps/place/The+Old+City,+Nazareth/@32.7035145,35.296555,14z/data=!3m1!4b1!4m6!3m5!1s0x151c4c2c9a805123:0x994648ecbf8111f3!8m2!3d32.703515!4d35.296555!16s%2Fg%2F1v5wddhc?entry=ttu', '_blank');
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
        <h1>{t('headerTitleOld')}
          <SiGooglemaps
            className="map-btn"
            onClick={handleClickMap}
          />
        </h1>
      </div>
      <div className='content'>
        <p>{t('mapDescriptionOld')}</p>
        <p>{t('churchDescriptionOld')}</p>
        <p>{t('waterSourceOld')}</p>
      </div>
      <div className="gallery">
        <div className="gallery-queue">
          {images.map((image, index) => (
            <img
              key={index}
              src={image}
              alt={`Greek Church ${index + 1}`}
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

export default OldNazareth;
