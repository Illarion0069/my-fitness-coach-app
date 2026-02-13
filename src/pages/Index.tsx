import { useState, useRef } from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/components/sections/HeroSection';
import TestSection from '@/components/sections/TestSection';
import PricingSection from '@/components/sections/PricingSection';
import AboutSection from '@/components/sections/AboutSection';
import ContactSection from '@/components/sections/ContactSection';
import GroupTrainingSection from '@/components/sections/GroupTrainingSection';
import AdminSection from '@/components/sections/AdminSection';
import WelcomeModal from '@/components/WelcomeModal';
import SessionWidget from '@/components/SessionWidget';

const AppContent = () => {
  const { user, isTrainer, loading } = useAuth();
  const [activeSection, setActiveSection] = useState('home');
  const [showWelcome, setShowWelcome] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleNavigate = (section: string) => {
    setActiveSection(section);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isAuthenticated = !!user;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div ref={containerRef} className="h-screen overflow-y-auto scroll-smooth">
        {activeSection === 'home' && (
          <>
            <HeroSection onNavigate={handleNavigate} onProfileClick={() => {
              if (isTrainer) {
                handleNavigate('admin');
              } else if (isAuthenticated) {
                // Client is logged in — scroll to session widget on home
                handleNavigate('home');
              } else {
                setShowWelcome(true);
              }
            }} />
            {isAuthenticated && (
              <div className="px-5 -mt-24 relative z-10 max-w-lg mx-auto">
                <SessionWidget />
              </div>
            )}
          </>
        )}
        {activeSection === 'test' && <TestSection />}
        {activeSection === 'pricing' && <PricingSection />}
        {activeSection === 'about' && <AboutSection />}
        {activeSection === 'group' && isAuthenticated && <GroupTrainingSection />}
        {activeSection === 'admin' && isTrainer && <AdminSection />}
        {activeSection === 'contact' && <ContactSection />}
      </div>
      <BottomNav active={activeSection} onNavigate={handleNavigate} showGroup={isAuthenticated} showAdmin={isTrainer} />
      
      <WelcomeModal open={showWelcome} onClose={() => setShowWelcome(false)} />
    </div>
  );
};

const Index = () => (
  <LanguageProvider>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </LanguageProvider>
);

export default Index;
