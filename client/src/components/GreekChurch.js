import React, { useState, useEffect, useCallback } from 'react';
import '../styles/Pages.css';
import { SiGooglemaps } from "react-icons/si";
import { useTranslation } from 'react-i18next'; // Import useTranslation
import "../App.css";

const GreekChurch = () => {
  const { t } = useTranslation(); // Initialize translation function
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);
  const [isPinch, setIsPinch] = useState(false);
  
  const images = [
    "images/greek/greek1.jpg",
    "images/greek/greek2.jpg",
    "images/greek/greek3.jpg",
    "images/greek/greek4.jpg",
    "images/greek/greek5.jpg",
    "images/greek/greek6.jpg",
    "images/greek/greek7.jpg",
    "images/greek/greek8.jpg",
    "images/greek/greek9.jpg",
    "images/greek/greek10.jpg",
    "images/greek/greek11.jpg",
    "images/greek/greek12.jpg",
    "images/greek/greek13.jpg",
    "images/greek/greek14.jpg",
    "images/greek/greek15.jpg",
    "images/greek/greek16.jpg",
    "images/greek/greek17.jpg",
    "images/greek/greek18.jpg",
  ];

  const handleClickMap = () => {
    window.open('https://www.google.com/maps/place/The+Greek+Orthodox+Church+of+the+Annunciation/@32.7070723,35.3016619,17z/data=!3m1!4b1!4m6!3m5!1s0x151c4c29d17b5477:0xc7296709e9a3ab85!8m2!3d32.7070723!4d35.3016619!16s%2Fm%2F03gtxsl?entry=ttu', '_blank');
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
        setIsPinch(true); // Pinch detected
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
        <h1>
          {t('headerGreek.title')}
          <SiGooglemaps
            className="map-btn"
            onClick={handleClickMap}
            title={t('headerGreek.mapButton')} // Title for the map button
          />
        </h1>
      </div>

      <div className='content'>
        <p>{t('contentGreek.paragraph1')}</p>
        <p>{t('contentGreek.paragraph2')}</p>
        <p>{t('contentGreek.paragraph3')}</p>
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
              e.stopPropagation(); // Prevents click event from closing the modal
              handlePrevImage();
            }}
          >
            &#10094;
          </button>
          <button
            className="next"
            onClick={(e) => {
              e.stopPropagation(); // Prevents click event from closing the modal
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

export default GreekChurch;
