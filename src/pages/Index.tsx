import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import BookingModal from '@/components/BookingModal';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
// import ChatAssistant from '@/components/ChatAssistant'; // frozen: chat assistant is disabled for now

import HeroSection from '@/components/sections/HeroSection';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSwitch from '@/components/LanguageSwitch';
import WelcomeModal from '@/components/WelcomeModal';
import OnboardingModal from '@/components/OnboardingModal';
import AppGuide from '@/components/AppGuide';
import SwipeHint from '@/components/SwipeHint';

import { AnimatePresence, motion } from 'framer-motion';
import AdminSection from '@/components/sections/AdminSection';
import { SHOP_PUBLIC } from '@/config/features';

function restorePendingConsentUrl(userId: string | undefined) {
  try {
    const pending = sessionStorage.getItem('mcp_consent_return_url');
    if (!pending) return;
    const url = new URL(pending);
    if (url.origin !== window.location.origin) return;
    if (!url.pathname.startsWith('/.lovable/oauth/consent')) return;
    sessionStorage.removeItem('mcp_consent_return_url');
    if (userId) {
      window.location.href = pending;
    }
  } catch {
    // ignore malformed URLs
  }
}
const PricingSection = lazy(() => import('@/components/sections/PricingSection'));
const AboutSection = lazy(() => import('@/components/sections/AboutSection'));
const TestSection = lazy(() => import('@/components/sections/TestSection'));
const ShopSection = lazy(() => import('@/components/sections/ShopSection'));

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
  const [showGuide, setShowGuide] = useState(() => {
    return !localStorage.getItem('app_guide_seen') && !localStorage.getItem('user_role_hint');
  });
  const containerRef = useRef<HTMLDivElement>(null);
  // Note: previously force-remounted the active section on visibilitychange/pageshow as a
  // workaround for an iOS Safari framer-motion black-screen bug. That wiped in-section state
  // (selected client, calendar day, viewMode) every time the user backgrounded the app.
  // Removed so navigation state persists when returning from another tab/app.

  const optimisticIsTrainer = isTrainer || (loading && roleHint === 'trainer');
  const effectiveIsTrainer = optimisticIsTrainer && !clientPreview;

  const canSeeShop = SHOP_PUBLIC || optimisticIsTrainer;
  const showShopInNav = canSeeShop && !clientPreview;

  const sections = ['home', 'pricing', ...(showShopInNav ? ['shop'] : []), 'about', ...(effectiveIsTrainer ? ['admin'] : [])];
  const routableSections = [...sections, 'test', ...(canSeeShop && !showShopInNav ? ['shop'] : [])];

  const handleNavigate = (section: string) => {
    if (!routableSections.includes(section)) section = 'home';
    const currentIdx = routableSections.indexOf(activeSection);
    const nextIdx = routableSections.indexOf(section);
    setSwipeDirection(nextIdx > currentIdx ? 1 : -1);
    setActiveSection(section);
    setTimeout(() => containerRef.current?.scrollTo({ top: 0 }), 0);
  };

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const currentIdx = sections.indexOf(activeSection);
    if (currentIdx === -1) return;
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
  const swipeCancelled = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Ignore multi-touch (pinch/zoom) and zoomed-in state
    if (e.touches.length > 1 || (window.visualViewport && window.visualViewport.scale > 1.01)) {
      swipeCancelled.current = true;
      return;
    }
    swipeCancelled.current = false;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1) swipeCancelled.current = true;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeCancelled.current) return;
    if (window.visualViewport && window.visualViewport.scale > 1.01) return;
    // Ignore swipes that originate inside scrollable/interactive elements
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-no-swipe], input, textarea, select, [role="dialog"], .overflow-x-auto, .overflow-x-scroll, .overflow-auto, .overflow-scroll')) {
      return;
    }
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
      restorePendingConsentUrl(user.id);
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

  // Capture UTM params (Google Business Profile etc.) into sessionStorage so
  // downstream bookings/leads can be attributed. Persists for the session only.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    const captured: Record<string, string> = {};
    utmKeys.forEach((k) => {
      const v = params.get(k);
      if (v) captured[k] = v.slice(0, 64);
    });
    if (Object.keys(captured).length > 0) {
      try {
        sessionStorage.setItem('attribution', JSON.stringify({ ...captured, ts: Date.now() }));
      } catch { /* storage may be unavailable */ }
    }
  }, []);

  // Deep link: ?book=1 opens the BookingModal immediately. Used for the
  // "Website" link in Google Business Profile so visitors land on booking.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookParam = params.get('book');
    if (bookParam) {
      setShowBooking(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('book');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }, []);

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
      case 'about': return <AboutSection onNavigate={handleNavigate} onBookClick={() => setShowBooking(true)} />;
      case 'shop': return canSeeShop ? <ShopSection /> : null;
      case 'admin': return effectiveIsTrainer ? <AdminSection /> : null;
      case 'test': return <TestSection onLoginClick={() => setShowWelcome(true)} />;
      default: return null;
    }
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
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
            <Suspense fallback={
              <div className="min-h-screen bg-background px-5 pt-6 pb-28 space-y-4">
                <div className="h-8 w-1/2 rounded-lg bg-muted/40 animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-muted/30 animate-pulse" />
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-2xl bg-muted/30 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
                <div className="h-40 rounded-2xl bg-muted/20 animate-pulse mt-3" />
              </div>
            }>
              {renderSection()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
      {activeSection !== 'home' && activeSection !== 'admin' && (
        <div
          className="fixed right-3 z-[90] flex items-center gap-2"
          style={{ top: 'max(env(safe-area-inset-top, 8px), 8px)' }}
        >
          <ThemeToggle />
          <LanguageSwitch />
        </div>
      )}
      <BottomNav active={activeSection} onNavigate={handleNavigate} showAdmin={effectiveIsTrainer} showShop={showShopInNav} />
      {!showGuide && !effectiveIsTrainer && <SwipeHint />}

      {/* {activeSection !== 'admin' && <ChatAssistant />} */}


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

import { ThemeProvider } from '@/contexts/ThemeContext';

const Index = () => (
  <ThemeProvider>
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  </ThemeProvider>
);

export default Index;
