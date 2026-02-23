import { useState, useRef, useEffect, useCallback } from 'react';
import BookingModal from '@/components/BookingModal';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/components/sections/HeroSection';
import TestSection from '@/components/sections/TestSection';
import PricingSection from '@/components/sections/PricingSection';
import AboutSection from '@/components/sections/AboutSection';
import AdminSection from '@/components/sections/AdminSection';
import WelcomeModal from '@/components/WelcomeModal';
import OnboardingModal from '@/components/OnboardingModal';
import AppGuide from '@/components/AppGuide';
import { useLanguage } from '@/contexts/LanguageContext';
import { AnimatePresence, motion } from 'framer-motion';

const AppContent = () => {
  const { user, isTrainer, loading } = useAuth();
  const [activeSection, setActiveSection] = useState('home');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(0);
  const [bookingJustCompleted, setBookingJustCompleted] = useState(false);
  const [showGuide, setShowGuide] = useState(() => {
    return !localStorage.getItem('app_guide_seen') && !user;
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const sections = ['home', 'test', 'pricing', 'about', ...(isTrainer ? ['admin'] : [])];

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

  // Reset state on logout
  useEffect(() => {
    if (!user) setActiveSection('home');
    if (user) setShowGuide(false);
  }, [user]);

  // Handle cancel_session URL parameter (from Telegram cancel button)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cancelSessionId = params.get('cancel_session');
    if (cancelSessionId && user) {
      setShowBooking(true);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('cancel_session');
      window.history.replaceState(null, '', url.pathname + url.search);
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
            if (isTrainer) handleNavigate('admin');
            else setShowWelcome(true);
          }} />
        );
      case 'test': return <TestSection onLoginClick={() => setShowWelcome(true)} />;
      case 'pricing': return <PricingSection />;
      case 'about': return <AboutSection />;
      case 'admin': return isTrainer ? <AdminSection /> : null;
      default: return null;
    }
  };

  // Show a neutral loading screen while auth is resolving to prevent UI flash
  if (loading) {
    return (
      <div className="dark h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
      
      <WelcomeModal
        open={showWelcome}
        onClose={() => setShowWelcome(false)}
        onRegistered={() => setShowOnboarding(true)}
      />
      <OnboardingModal
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onOpenBooking={() => setShowBooking(true)}
        onNavigateToTest={() => {
          setShowOnboarding(false);
          handleNavigate('test');
        }}
        bookingJustCompleted={bookingJustCompleted}
      />
      
      <BookingModal
        open={showBooking}
        onClose={() => setShowBooking(false)}
        onLoginRequest={() => { setShowBooking(false); setShowWelcome(true); }}
        onBooked={() => {
          if (showOnboarding) {
            setBookingJustCompleted(true);
            setTimeout(() => setBookingJustCompleted(false), 2000);
          } else {
            handleNavigate('test');
          }
        }}
      />

      {showGuide && (
        <AppGuide onComplete={() => {
          setShowGuide(false);
          localStorage.setItem('app_guide_seen', '1');
        }} />
      )}
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
