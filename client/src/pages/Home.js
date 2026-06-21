import Cards from '../components/Cards';
import HeroSection from '../components/HeroSection';
import WhatIsNew from '../components/WhatIsNew';
import StatsSection from '../components/StatsSection';
import DailyScripture from '../components/DailyScripture';
import ScrollReveal from '../components/ScrollReveal';

function Home() {
  return (
    <>
      <HeroSection />
      <ScrollReveal>
        <Cards />
      </ScrollReveal>
      <ScrollReveal delay={100}>
        <StatsSection />
      </ScrollReveal>
      <ScrollReveal delay={80}>
        <WhatIsNew />
      </ScrollReveal>
      <ScrollReveal delay={120}>
        <DailyScripture />
      </ScrollReveal>
    </>
  );
}

export default Home;
