import { useState, useRef } from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/components/sections/HeroSection';
import TestSection from '@/components/sections/TestSection';
import PricingSection from '@/components/sections/PricingSection';
import AboutSection from '@/components/sections/AboutSection';
import ReviewsSection from '@/components/sections/ReviewsSection';
import ContactSection from '@/components/sections/ContactSection';

const sections = ['home', 'test', 'pricing', 'about', 'contact'] as const;

const Index = () => {
  const [activeSection, setActiveSection] = useState('home');
  const containerRef = useRef<HTMLDivElement>(null);

  const handleNavigate = (section: string) => {
    setActiveSection(section);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <LanguageProvider>
      <div className="dark min-h-screen bg-background text-foreground">
        <div ref={containerRef} className="h-screen overflow-y-auto scroll-smooth">
          {activeSection === 'home' && <HeroSection onNavigate={handleNavigate} />}
          {activeSection === 'test' && <TestSection />}
          {activeSection === 'pricing' && <PricingSection />}
          {activeSection === 'about' && (
            <>
              <AboutSection />
              <ReviewsSection />
            </>
          )}
          {activeSection === 'contact' && <ContactSection />}
        </div>
        <BottomNav active={activeSection} onNavigate={handleNavigate} />
      </div>
    </LanguageProvider>
  );
};

export default Index;
