import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, UserRound, MessageCircle } from 'lucide-react';
import trainerPhoto from '@/assets/trainer-avatar.jpg';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/contexts/AuthContext';
import BookingModal from '@/components/BookingModal';
import ClientDashboard from '@/components/ClientDashboard';
import LanguageSwitch from '@/components/LanguageSwitch';
import ThemeToggle from '@/components/ThemeToggle';
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
  const [showContactOptions, setShowContactOptions] = useState(false);

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
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitch />
          </div>
        </div>
        <ClientDashboard forceClientView={!!clientPreview} onNavigate={onNavigate} />
      </section>
    );
  }

  return (
    <section className="relative min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-safe pb-2" style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)' }}>
        <span className="text-sm font-bold text-foreground tracking-tight">Limassol Fitness</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
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
        {/* Circular trainer photo with glow — clickable to contact */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="mt-6 mb-2 flex flex-col items-center"
        >
          <div className="relative">
          {/* Messenger bubbles + chat badge: swap with mode="wait" */}
          <AnimatePresence>
            {showContactOptions ? (
              <motion.div
                key="messengers"
                className="contents"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* WhatsApp — inflates out from behind photo to the left */}
                <motion.a
                  href="https://wa.me/35795144819"
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: [0, 1.18, 0.96, 1] }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="absolute top-1/2 -translate-y-1/2 -left-16 z-10 w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center shadow-[0_4px_20px_rgba(37,211,102,0.4)] hover:scale-110 active:scale-95 transition-transform"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.685-1.228A11.953 11.953 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.153 0-4.16-.655-5.828-1.78l-.348-.222-2.847.747.762-2.782-.243-.364A9.935 9.935 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                </motion.a>
                {/* Telegram — inflates out from behind photo to the right */}
                <motion.a
                  href="https://t.me/fitnesslimassol"
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: [0, 1.18, 0.96, 1] }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ duration: 0.16, ease: 'easeOut', delay: 0.015 }}
                  className="absolute top-1/2 -translate-y-1/2 -right-16 z-10 w-12 h-12 rounded-full bg-[#229ED9] flex items-center justify-center shadow-[0_4px_20px_rgba(34,158,217,0.4)] hover:scale-110 active:scale-95 transition-transform"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                </motion.a>
              </motion.div>
            ) : (
              <motion.div
                key="chat-hint"
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.08, ease: 'easeOut' }}
              >
                {/* Chat badge removed — keep only floating messenger icons hint */}
                {/* Subtle hint — small messenger icons floating */}
                <div className="absolute top-1/2 -translate-y-1/2 -right-[5.5rem] z-10 flex items-center gap-1 pointer-events-none">
                  <motion.span
                    animate={{ x: [0, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                    className="text-primary/50 text-sm"
                  >
                    ←
                  </motion.span>
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-[#25D366]/80 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white fill-current"><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.685-1.228A11.953 11.953 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
                    </span>
                    <span className="w-4 h-4 rounded-full bg-[#229ED9]/80 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white fill-current"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056z"/></svg>
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pulsing ring */}
          <div className="absolute inset-0 rounded-full animate-ping bg-primary/10" style={{ animationDuration: '3s' }} />
          <div className="absolute -inset-1 rounded-full animate-pulse bg-primary/5" style={{ animationDuration: '2s' }} />

          <button
            onClick={() => setShowContactOptions(!showContactOptions)}
            className="relative block"
          >
            <div className="w-40 h-40 rounded-full p-1 bg-gradient-to-b from-primary/60 via-primary/20 to-transparent shadow-[0_8px_40px_-8px_hsl(var(--primary)/0.4)] transition-transform hover:scale-105 active:scale-95">
              <img
                src={trainerPhoto}
                alt={t(hero.trainer)}
                className="w-full h-full rounded-full object-cover object-center bg-card border-4 border-card"
                style={{ objectPosition: '60% center' }}
              />
            </div>
          </button>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-4"
        >
          <h1 className={`uppercase tracking-tight font-heading leading-[1] ${lang === 'ru' ? 'text-[1.6rem]' : 'text-4xl'}`}>
            <span className="block text-primary font-extrabold">{t(hero.title.line1)}</span>
            <span className="block text-muted-foreground/80 font-light italic normal-case tracking-normal text-[0.55em] mt-1 mb-1">{t(hero.title.line2)}</span>
            <span className="block text-foreground font-extrabold">{t(hero.title.line3)}</span>
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

        {/* CTA Button — single, clean */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mb-4 w-full max-w-xs"
        >
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            onClick={() => { setBookingInitialStep('date'); setBookingOpen(true); }}
            className="w-full bg-primary text-primary-foreground font-bold rounded-2xl border border-primary/40 shadow-[0_4px_24px_-8px_hsl(var(--primary)/0.5)] hover:shadow-[0_6px_28px_-6px_hsl(var(--primary)/0.6)] hover:-translate-y-0.5 transition-all active:scale-[0.98] py-4 text-[15px] tracking-wide"
          >
            {lang === 'en' ? 'Book Your Session' : 'Записаться на тренировку'}
          </motion.button>
        </motion.div>

        {/* Workouts section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="w-full pb-28 mt-12"
        >
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xs font-extrabold text-muted-foreground uppercase tracking-[0.2em]">
              {t(workouts.title)}
            </h2>
            <span className="h-px flex-1 ml-3 bg-border/40" />
          </div>
          <div className="grid grid-cols-2 auto-rows-[minmax(0,1fr)] gap-3">
            {workouts.items.slice(0, 4).map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.05 }}
                onClick={() => setExpandedCard(expandedCard === i ? null : i)}
                whileHover={{ y: -3 }}
                className={`workout-card-expanded bg-card rounded-2xl p-4 border border-border/50 hover:border-primary/40 hover:shadow-[0_10px_30px_-12px_hsl(var(--primary)/0.35)] transition-all cursor-pointer select-none ${i === 0 || i === 3 ? 'col-span-2 bg-gradient-to-br from-card to-primary/5' : ''}`}
              >
                <div className={`mb-2 ${i === 0 ? 'text-3xl' : 'text-2xl'}`}>{item.icon}</div>
                <h3 className={`font-bold text-foreground mb-1 ${i === 0 ? 'text-base' : 'text-[13px]'}`}>{t(item.name)}</h3>
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
      <BookingModal
        open={bookingOpen}
        onClose={() => {
          setBookingOpen(false);
          setBookingInitialStep('date');
        }}
        onLoginRequest={onProfileClick}
        initialStep={bookingInitialStep}
        restorePendingPayment
      />
    </section>
  );
};

export default HeroSection;
