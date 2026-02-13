import { useState, useRef, useEffect } from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/components/sections/HeroSection';
import TestSection from '@/components/sections/TestSection';
import PricingSection from '@/components/sections/PricingSection';
import AboutSection from '@/components/sections/AboutSection';
import ContactSection from '@/components/sections/ContactSection';
import AdminSection from '@/components/sections/AdminSection';
import WelcomeModal from '@/components/WelcomeModal';
import ClientProfileDrawer from '@/components/ClientProfileDrawer';
import { useLanguage } from '@/contexts/LanguageContext';

const AppContent = () => {
  const { user, isTrainer, loading } = useAuth();
  const [activeSection, setActiveSection] = useState('home');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleNavigate = (section: string) => {
    setActiveSection(section);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auto-close modals when user logs in
  useEffect(() => {
    if (user) {
      setShowWelcome(false);
    }
  }, [user]);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div ref={containerRef} className="h-screen overflow-y-auto scroll-smooth">
        {activeSection === 'home' && (
          <HeroSection onNavigate={handleNavigate} onProfileClick={() => {
            if (isTrainer) {
              handleNavigate('admin');
            } else if (!!user) {
              setShowProfile(true);
            } else {
              setShowWelcome(true);
            }
          }} />
        )}
        {activeSection === 'test' && <TestSection />}
        {activeSection === 'pricing' && <PricingSection />}
        {activeSection === 'about' && <AboutSection />}
        
        {activeSection === 'admin' && isTrainer && <AdminSection />}
        {activeSection === 'contact' && <ContactSection />}
      </div>
      <BottomNav active={activeSection} onNavigate={handleNavigate} showAdmin={isTrainer} />
      
      <WelcomeModal open={showWelcome} onClose={() => setShowWelcome(false)} />
      <ClientProfileDrawer open={showProfile} onClose={() => setShowProfile(false)} />
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
