import { useState, useRef, useCallback, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const AppContent = () => {
  const { user, isTrainer, loading, profile, signOut } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState('home');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleNavigate = (section: string) => {
    setActiveSection(section);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auto-close welcome modal when user logs in
  useEffect(() => {
    if (user) {
      setShowWelcome(false);
      setShowProfileMenu(false);
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
              setShowProfileMenu(prev => !prev);
            } else {
              setShowWelcome(true);
            }
          }} />
        )}
        {/* Profile dropdown for logged-in clients */}
        {showProfileMenu && !!user && !isTrainer && (
          <div
            className="fixed top-14 left-5 z-50 bg-card border border-border/50 rounded-2xl shadow-2xl p-3 min-w-[180px]"
            onClick={() => setShowProfileMenu(false)}
          >
            <p className="text-sm font-bold text-foreground px-2 py-1 truncate">{profile?.full_name}</p>
            <p className="text-[11px] text-muted-foreground px-2 pb-2 truncate">{profile?.email}</p>
            <div className="h-px bg-border/50 my-1" />
            <button
              onClick={async () => {
                await signOut();
                setShowProfileMenu(false);
                toast({
                  title: lang === 'en' ? 'Signed out' : 'Вы вышли из аккаунта',
                  duration: 2000,
                });
              }}
              className="w-full text-left text-sm text-destructive font-semibold px-2 py-2 rounded-xl hover:bg-destructive/10 transition-colors"
            >
              {lang === 'en' ? 'Sign out' : 'Выйти'}
            </button>
          </div>
        )}
        {showProfileMenu && <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />}
        {activeSection === 'test' && <TestSection />}
        {activeSection === 'pricing' && <PricingSection />}
        {activeSection === 'about' && <AboutSection />}
        
        {activeSection === 'admin' && isTrainer && <AdminSection />}
        {activeSection === 'contact' && <ContactSection />}
      </div>
      <BottomNav active={activeSection} onNavigate={handleNavigate} showAdmin={isTrainer} />
      
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
