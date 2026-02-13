import { useState, useRef, useEffect, useCallback } from 'react';
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
import { AnimatePresence, motion } from 'framer-motion';

const AppContent = () => {
  const { user, isTrainer, loading } = useAuth();
  const [activeSection, setActiveSection] = useState('home');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const sections = ['home', 'test', 'pricing', 'about', 'contact', ...(isTrainer ? ['admin'] : [])];

  const handleNavigate = (section: string) => {
    const currentIdx = sections.indexOf(activeSection);
    const nextIdx = sections.indexOf(section);
    setSwipeDirection(nextIdx > currentIdx ? 1 : -1);
    setActiveSection(section);
    // Scroll to top on navigate
    setTimeout(() => containerRef.current?.scrollTo({ top: 0 }), 0);
  };

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const currentIdx = sections.indexOf(activeSection);
    if (direction === 'left' && currentIdx < sections.length - 1) {
      setSwipeDirection(1);
      setActiveSection(sections[currentIdx + 1]);
    } else if (direction === 'right' && currentIdx > 0) {
      setSwipeDirection(-1);
      setActiveSection(sections[currentIdx - 1]);
    }
  }, [activeSection, sections]);

  // Touch swipe detection
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // Only swipe if horizontal movement is dominant and > 120px
    if (Math.abs(deltaX) > 120 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
      handleSwipe(deltaX < 0 ? 'left' : 'right');
    }
  };

  // Auto-close modals when user logs in
  useEffect(() => {
    if (user) {
      setShowWelcome(false);
    } else {
      setActiveSection('home');
      setShowProfile(false);
    }
  }, [user]);

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return (
          <HeroSection onNavigate={handleNavigate} onProfileClick={() => {
            if (isTrainer) {
              handleNavigate('admin');
            } else if (!!user) {
              setShowProfile(true);
            } else {
              setShowWelcome(true);
            }
          }} />
        );
      case 'test': return <TestSection />;
      case 'pricing': return <PricingSection />;
      case 'about': return <AboutSection />;
      case 'contact': return <ContactSection />;
      case 'admin': return isTrainer ? <AdminSection /> : null;
      default: return null;
    }
  };

  return (
    <div className="dark h-screen bg-background text-foreground flex flex-col">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait" custom={swipeDirection}>
          <motion.div
            key={activeSection}
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
          >
            {renderSection()}
          </motion.div>
        </AnimatePresence>
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
