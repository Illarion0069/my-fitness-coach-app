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
        <ClientDashboard forceClientView={!!clientPreview} />
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

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mb-4 flex flex-col items-center gap-3"
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
          <motion.a
            href="https://wa.me/35796740558"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-7 rounded-2xl text-sm hover:scale-[1.02] transition-all active:scale-[0.98] shadow-[0_4px_20px_-4px_rgba(16,185,129,0.5)]"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            {lang === 'en' ? 'Message Trainer' : 'Написать тренеру'}
          </motion.a>
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
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setBookingOpen(true); }}
                          className="gradient-primary text-primary-foreground font-bold py-1.5 px-4 rounded-xl text-[10px] glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98]"
                        >
                          {lang === 'en' ? 'Book' : 'Записаться'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onNavigate('pricing'); }}
                          className="bg-secondary text-secondary-foreground font-bold py-1.5 px-4 rounded-xl text-[10px] hover:bg-secondary/80 transition-colors active:scale-[0.98]"
                        >
                          {lang === 'en' ? 'Pricing' : 'Цены'}
                        </button>
                      </div>
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
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); setBookingOpen(true); }}
                              className="gradient-primary text-primary-foreground font-bold py-1.5 px-4 rounded-xl text-[10px] glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98]"
                            >
                              {lang === 'en' ? 'Book' : 'Записаться'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onNavigate('pricing'); }}
                              className="bg-secondary text-secondary-foreground font-bold py-1.5 px-4 rounded-xl text-[10px] hover:bg-secondary/80 transition-colors active:scale-[0.98]"
                            >
                              {lang === 'en' ? 'Pricing' : 'Цены'}
                            </button>
                          </div>
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
