import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next'; // Import the useTranslation hook
import '../styles/HeroSection.css';

function HeroSection() {
  const { t } = useTranslation(); // Initialize translation hook
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef(new Audio('/sounds/christians.mp3'));
  const navigate = useNavigate();

  const handleShopClick = () => {
    // Reset filters before navigating
    localStorage.removeItem('searchQuery');
    localStorage.removeItem('sortOrder');
    localStorage.setItem('currentPage', 1);

    // Navigate to the shop page
    navigate('/shop');
  };

  const handleDiscountClick = () => {
    // Navigate to the shop page when the discount area is clicked
    navigate('/shop');
  };

  useEffect(() => {
    // Scroll to the top of the page when the component mounts
    window.scrollTo(0, 0);

    // Initialize and start playing the audio
    const audio = audioRef.current;
    audio.loop = true;

    // Cleanup on unmount
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (isPlaying) {
      audio.play();
    } else {
      audio.pause();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className='hero-container'>
      <video
        id="video-field"
        className='hero-v'
        src='https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fvideo-7.mp4?alt=media&token=b0173721-21a1-46d0-b15b-f2001b912e72'
        autoPlay
        loop
        muted
        playsInline
        controls={false}
      />

      <h1>{t('heroSection.heading')}</h1>  {/* Translated Heading */}
      <p>{t('heroSection.subHeading')}</p>  {/* Translated Subheading */}

      <button className='sound-control-btn' onClick={togglePlayPause}>
        <i className={isPlaying ? 'fas fa-volume-mute' : 'fas fa-volume-up'}></i>
      </button>

      <div className='hero-btns'>
        <Button
          destination='/candle'
          className='btns'
          buttonStyle='btn--primary'
          buttonSize='btn--large'
        >
          {t('heroSection.lightCandle')}  {/* Translated Button Text */}
        </Button>

        <Button
          className='btns'
          onClick={handleShopClick}
          destination='/shop'
          buttonStyle='btn--half'
          buttonSize='btn--large'
        >
          {t('heroSection.shopButton')}<i className={t('heroSection.shopIcon')} aria-hidden="true"></i> {/* Translated Shop Button with Icon */}
        </Button>

        <Button
          destination='/tour'
          className='btns'
          buttonStyle='btn--outline'
          buttonSize='btn--large'
        >
          {t('heroSection.tourButton')} <i className={t('heroSection.tourIcon')} /> {/* Translated Tour Button with Icon */}
        </Button>
      </div>

      <div
        onClick={handleDiscountClick}
        style={{
          backgroundColor: "#333",
          color: "#fff",
          padding: "15px 30px",
          borderRadius: "8px",
          textAlign: "center",
          margin: "20px auto",
          maxWidth: "700px",
          fontFamily: "Arial, sans-serif",
          position: "relative",
          overflow: "hidden",
          cursor: "pointer" // Indicate it's clickable
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "0",
            left: "-20px",
            height: "100%",
            width: "160px",
            backgroundColor: "tomato",
            transform: "skewX(-25deg)"
          }}
        ></div>
        <p
          style={{
            fontSize: "20px",
            fontWeight: "bold",
            position: "relative",
            zIndex: 1,
            margin: 0
          }}
        >
          {t('heroSection.discount')}    </p>
      </div>

    </div>
  );
}

export default HeroSection;
