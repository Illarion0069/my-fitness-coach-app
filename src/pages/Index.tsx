import { useState, useRef, useEffect } from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/components/sections/HeroSection';
import TestSection from '@/components/sections/TestSection';
import PricingSection from '@/components/sections/PricingSection';
import AboutSection from '@/components/sections/AboutSection';
import ContactSection from '@/components/sections/ContactSection';
import GroupTrainingSection from '@/components/sections/GroupTrainingSection';
import WelcomeModal from '@/components/WelcomeModal';

const AppContent = () => {
  const { user, profile, loading } = useAuth();
  const [activeSection, setActiveSection] = useState('home');
  const [showWelcome, setShowWelcome] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      setShowWelcome(true);
    }
  }, [loading, user]);

  const handleNavigate = (section: string) => {
    setActiveSection(section);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Authenticated users get group training in nav
  const isAuthenticated = !!user;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div ref={containerRef} className="h-screen overflow-y-auto scroll-smooth">
        {activeSection === 'home' && <HeroSection onNavigate={handleNavigate} />}
        {activeSection === 'test' && <TestSection />}
        {activeSection === 'pricing' && <PricingSection />}
        {activeSection === 'about' && <AboutSection />}
        {activeSection === 'group' && isAuthenticated && <GroupTrainingSection />}
        {activeSection === 'contact' && <ContactSection />}
      </div>
      <BottomNav active={activeSection} onNavigate={handleNavigate} showGroup={isAuthenticated} />
      <WelcomeModal open={showWelcome} onClose={() => setShowWelcome(false)} />
    </div>
  );
};

const Index = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
};

export default Index;
