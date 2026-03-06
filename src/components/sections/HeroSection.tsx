import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, UserRound, CalendarDays } from 'lucide-react';
import trainerPhoto from '@/assets/trainer-photo.jpg';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/contexts/AuthContext';
import BookingModal from '@/components/BookingModal';
import ClientDashboard from '@/components/ClientDashboard';
import LanguageSwitch from '@/components/LanguageSwitch';
import { supabase } from '@/integrations/supabase/client';

interface HeroSectionProps {
  onNavigate: (section: string) => void;
  onProfileClick: () => void;
  clientPreview?: boolean;
}

const HeroSection = ({ onNavigate, onProfileClick, clientPreview }: HeroSectionProps) => {
  const { t, lang, setLang } = useLanguage();
  const { user, profile, isTrainer } = useAuth();
  const hero = translations.hero;
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingInitialStep, setBookingInitialStep] = useState<'date' | 'my-sessions'>('date');
  const [hasActivePackage, setHasActivePackage] = useState(false);

  const getInitials = () => {
    const name = profile?.full_name || user?.user_metadata?.full_name || '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase() || '?';
  };
  const workouts = translations.workouts;
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  useEffect(() => {
    if (expandedCard === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.workout-card-expanded')) setExpandedCard(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expandedCard]);

  // Check if client has an active package
  useEffect(() => {
    if (!user || isTrainer) return;
    const checkPackage = async () => {
      const { data } = await supabase
        .from('client_packages')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      setHasActivePackage(!!data);
    };
    checkPackage();

    const channel = supabase
      .channel('hero-packages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_packages', filter: `user_id=eq.${user.id}` }, checkPackage)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isTrainer]);

  // Authenticated client (or trainer in preview mode) — show full dashboard
  if (user && (!isTrainer || clientPreview)) {
    return (
      <section className="relative bg-background">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3" style={{ paddingTop: 'max(env(safe-area-inset-top, 12px), 12px)' }}>
          <span className="text-sm font-bold text-foreground tracking-tight">Limassol Fitness</span>
          <LanguageSwitch />
        </div>
        <ClientDashboard />
      </section>
    );
  }

  return (
    <section className="relative min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-safe pb-2" style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)' }}>
        <span className="text-sm font-bold text-foreground tracking-tight">Limassol Fitness</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground border border-border/50 bg-secondary/50 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            {lang === 'en' ? 'RU' : 'EN'}
          </button>
          {user ? (
            /* Logged-in: show initials avatar */
            <button
              onClick={onProfileClick}
              className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-extrabold text-sm shadow-[0_2px_12px_hsl(var(--primary)/0.4)] hover:opacity-90 transition-opacity active:scale-95"
            >
              {getInitials()}
            </button>
          ) : (
            /* Guest: show Sign In button */
            <button
              onClick={onProfileClick}
              className="flex items-center gap-1.5 gradient-primary text-primary-foreground text-xs font-bold py-2 px-3.5 rounded-xl hover:opacity-90 transition-opacity active:scale-95 shadow-[0_2px_12px_hsl(var(--primary)/0.4)]"
            >
              <UserRound className="w-3.5 h-3.5" />
              {lang === 'en' ? 'Sign In' : 'Войти'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-5">
        {/* Circular trainer photo with glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="mt-6 mb-6 relative"
        >
          <div className="w-40 h-40 rounded-full p-1 bg-gradient-to-b from-primary/60 via-primary/20 to-transparent shadow-[0_8px_40px_-8px_hsl(var(--primary)/0.4)]">
            <img
              src={trainerPhoto}
              alt={t(hero.trainer)}
              className="w-full h-full rounded-full object-cover bg-card border-4 border-card"
              style={{ objectPosition: '60% center' }}
            />
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-4"
        >
          <h1 className={`font-extrabold uppercase tracking-tight font-heading leading-[1.05] ${lang === 'ru' ? 'text-[1.6rem]' : 'text-4xl'}`}>
            <span className="text-primary">{t(hero.title.line1)}</span>
            <br />
            <span className="text-foreground">{t(hero.title.line2)}</span>
            <br />
            <span className="text-primary">{t(hero.title.line3)}</span>
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="text-center mb-6"
        >
          <p className={`text-muted-foreground ${lang === 'ru' ? 'text-[11px]' : 'text-sm'}`}>{t(hero.subtitle)}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">— {t(hero.trainer)}</p>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mb-6"
        >
          <motion.button
            key="book"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={() => { setBookingInitialStep('date'); setBookingOpen(true); }}
            className={`gradient-primary text-primary-foreground font-bold rounded-2xl glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] ${lang === 'ru' ? 'py-3 px-7 text-sm' : 'py-3.5 px-10 text-base'}`}
          >
            {t(hero.cta)}
          </motion.button>
        </motion.div>

        {/* Workouts section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="w-full pb-28"
        >
          <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-3">
            {t(workouts.title)}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {workouts.items.slice(0, 4).map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.05 }}
                onClick={() => setExpandedCard(expandedCard === i ? null : i)}
                className="workout-card-expanded bg-card rounded-2xl p-4 border border-border/50 hover:border-primary/30 transition-all cursor-pointer select-none"
              >
                <div className="text-2xl mb-2">{item.icon}</div>
                <h3 className="text-[13px] font-bold text-foreground mb-1">{t(item.name)}</h3>
                <AnimatePresence mode="wait">
                  {expandedCard === i ? (
                    <motion.div
                      key="expanded"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{t(item.desc)}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setBookingOpen(true); }}
                        className="gradient-primary text-primary-foreground font-bold py-1.5 px-4 rounded-xl text-[10px] glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] mt-3 inline-block"
                      >
                        {lang === 'en' ? 'Book session' : 'Записаться'}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.p
                      key="collapsed"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2"
                    >
                      {t(item.desc)}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
          {/* 5th workout card full-width */}
          {workouts.items[4] && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              onClick={() => setExpandedCard(expandedCard === 4 ? null : 4)}
              className="workout-card-expanded bg-card rounded-2xl p-4 border border-border/50 hover:border-primary/30 transition-all cursor-pointer select-none mt-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{workouts.items[4].icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13px] font-bold text-foreground">{t(workouts.items[4].name)}</h3>
                  <AnimatePresence mode="wait">
                    {expandedCard === 4 ? (
                      <motion.div
                        key="exp"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{t(workouts.items[4].desc)}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); setBookingOpen(true); }}
                            className="gradient-primary text-primary-foreground font-bold py-1.5 px-4 rounded-xl text-[10px] glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] mt-3 inline-block"
                          >
                            {lang === 'en' ? 'Book session' : 'Записаться'}
                          </button>
                      </motion.div>
                    ) : (
                      <motion.p key="col" className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {t(workouts.items[4].desc)}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* Scroll hint */}
          <div className="flex justify-center mt-4">
            <ChevronDown className="w-5 h-5 text-muted-foreground/30 animate-bounce" />
          </div>
        </motion.div>
      </div>

      {/* Booking Modal */}
      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} onLoginRequest={onProfileClick} initialStep={bookingInitialStep} />
    </section>
  );
};

export default HeroSection;
