import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import BookingModal from '@/components/BookingModal';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/components/sections/HeroSection';
import WelcomeModal from '@/components/WelcomeModal';
import OnboardingModal from '@/components/OnboardingModal';
import AppGuide from '@/components/AppGuide';
import FirstVisitOffer from '@/components/FirstVisitOffer';
import { AnimatePresence, motion } from 'framer-motion';
import AdminSection from '@/components/sections/AdminSection';
const PricingSection = lazy(() => import('@/components/sections/PricingSection'));
const AboutSection = lazy(() => import('@/components/sections/AboutSection'));

const getInitialSection = () => {
  const hint = localStorage.getItem('user_role_hint');
  return hint === 'trainer' ? 'admin' : 'home';
};

const AppContent = () => {
  const { user, isTrainer, loading } = useAuth();
  const roleHint = localStorage.getItem('user_role_hint');
  const [activeSection, setActiveSection] = useState(getInitialSection);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(0);
  const [bookingJustCompleted, setBookingJustCompleted] = useState(false);
  const [clientPreview, setClientPreview] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showFirstVisit, setShowFirstVisit] = useState(() => {
    return !localStorage.getItem('first_visit_seen') && !localStorage.getItem('user_role_hint');
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const optimisticIsTrainer = isTrainer || (loading && roleHint === 'trainer');
  const effectiveIsTrainer = optimisticIsTrainer && !clientPreview;

  const sections = ['home', 'pricing', 'about', ...(effectiveIsTrainer ? ['admin'] : [])];

  const handleNavigate = (section: string) => {
    const currentIdx = sections.indexOf(activeSection);
    const nextIdx = sections.indexOf(section);
    setSwipeDirection(nextIdx > currentIdx ? 1 : -1);
    setActiveSection(section);
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

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > 120 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
      handleSwipe(deltaX < 0 ? 'left' : 'right');
    }
  };

  useEffect(() => {
    if (loading) return;

    if (!user) {
      localStorage.removeItem('user_role_hint');
      setActiveSection('home');
      setClientPreview(false);
    } else {
      setShowGuide(false);
      if (isTrainer) {
        localStorage.setItem('user_role_hint', 'trainer');
        setActiveSection('admin');
      } else {
        localStorage.setItem('user_role_hint', 'client');
        if (activeSection === 'admin') setActiveSection('home');
      }
    }
  }, [user, isTrainer, loading]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cancelSessionId = params.get('cancel_session');
    if (cancelSessionId && user) {
      setShowBooking(true);
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
            if (effectiveIsTrainer) handleNavigate('admin');
            else setShowWelcome(true);
          }} clientPreview={clientPreview} />
        );
      case 'pricing': return <PricingSection />;
      case 'about': return <AboutSection />;
      case 'admin': return effectiveIsTrainer ? <AdminSection /> : null;
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
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
              {renderSection()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
      <BottomNav active={activeSection} onNavigate={handleNavigate} showAdmin={effectiveIsTrainer} />

      {optimisticIsTrainer && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-[100] flex flex-col gap-1">
          <button
            onClick={() => {
              setClientPreview(prev => {
                if (!prev) setActiveSection('home');
                return !prev;
              });
            }}
            className={`px-2 py-3 rounded-l-xl text-[10px] font-bold shadow-lg transition-all active:scale-95 writing-vertical ${
              clientPreview
                ? 'bg-destructive text-destructive-foreground animate-pulse'
                : 'bg-muted/90 text-muted-foreground border border-r-0 border-border/50 backdrop-blur-sm'
            }`}
            style={{ writingMode: 'vertical-lr' }}
          >
            {clientPreview ? '← Тренер' : '👁 Клиент'}
          </button>
          {!clientPreview && (
            <button
              onClick={() => setShowGuide(true)}
              className="px-2 py-3 rounded-l-xl text-[10px] font-bold shadow-lg transition-all active:scale-95 bg-muted/90 text-muted-foreground border border-r-0 border-border/50 backdrop-blur-sm"
              style={{ writingMode: 'vertical-lr' }}
            >
              👋 Визит
            </button>
          )}
        </div>
      )}
      
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
        forceClientView={clientPreview}
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
