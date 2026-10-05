import React, { useEffect } from 'react';
import '../App.css';
import Cards from '../components/Cards';
import HeroSection from '../components/HeroSection';
import WhatIsNew from '../components/WhatIsNew';
import ReactGA from 'react-ga';

const trackingId = "G-VE42K6WP4H"; // Replace with your Google Analytics tracking ID
ReactGA.initialize(trackingId);

function Home() {
//update
  useEffect(() => {
    ReactGA.pageview(window.location.pathname + window.location.search);
  }, []);

  return (
    <>
      <HeroSection />
      <Cards />
      <WhatIsNew />
    </>
  );
}

export default Home;
