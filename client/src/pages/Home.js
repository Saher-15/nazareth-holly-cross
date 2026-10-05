import React from 'react';
import '../App.css';
import Cards from '../components/Cards';
import HeroSection from '../components/HeroSection';
import WhatIsNew from '../components/WhatIsNew';

function Home() {
  return (
    <>
      <HeroSection />
      <Cards />
      <WhatIsNew />
    </>
  );
}

export default Home;
