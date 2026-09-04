import Hero from '@/components/sections/home/Hero';
import LogoMarquee from '@/components/sections/home/LogoMarquee';
import WhatWeDo from '@/components/sections/home/WhatWeDo';
import Benefits from '@/components/sections/home/Benefits';
import Industries from '@/components/sections/home/Industries';
import Offices from '@/components/sections/home/Offices';
import HowItWorks from '@/components/sections/home/HowItWorks';
import Testimonials from '@/components/sections/home/Testimonials';
import WhyAtlas from '@/components/sections/home/WhyAtlas';
import CtaBand from '@/components/sections/home/CtaBand';
import usePageMeta from '@/hooks/usePageMeta';

export function HomePage() {
  usePageMeta({
    title: 'Atlas Recruitment — Skilled people, fully managed',
    description:
      'Vetted, fully managed professionals from South Africa, India, Dubai and the Philippines, placed into UK businesses. Payroll, compliance and HR handled.',
  });

  return (
    <>
      <Hero />
      <LogoMarquee />
      <WhatWeDo />
      <Benefits />
      <Industries />
      <Offices />
      <HowItWorks />
      <Testimonials />
      <WhyAtlas />
      <CtaBand />
    </>
  );
}

export default HomePage;
