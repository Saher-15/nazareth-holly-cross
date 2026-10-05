import React from 'react';
import '../App.css';
import '../styles/Home.css';
import HeroSection from '../components/HeroSection';
import Cards from '../components/Cards';
import WhatIsNew from '../components/WhatIsNew';
import CandleStrip from '../components/home/CandleStrip';
import VerseOfDay from '../components/home/VerseOfDay';
import Souvenirs from '../components/home/Souvenirs';
import Voices from '../components/home/Voices';
import StickyCta from '../components/home/StickyCta';

function Home() {
  return (
    <div className="hx">
      <HeroSection />
      <CandleStrip />
      <Cards />
      <VerseOfDay />
      <Souvenirs />
      <Voices />
      <WhatIsNew />
      <StickyCta />
    </div>
  );
}

export default Home;
