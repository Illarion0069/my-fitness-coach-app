import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserRound, Zap, Dumbbell, Heart, Brain, Flame } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';
import LanguageSwitch from '@/components/LanguageSwitch';
import { useAuth } from '@/contexts/AuthContext';
import BookingModal from '@/components/BookingModal';
import SessionWidget from '@/components/SessionWidget';
import BodyMeasurementsView from '@/components/BodyMeasurementsView';

interface HeroSectionProps {
  onNavigate: (section: string) => void;
  onProfileClick: () => void;
}

const workoutIcons = [Dumbbell, Flame, Heart, Brain, Zap];

const HeroSection = ({ onNavigate, onProfileClick }: HeroSectionProps) => {
  const { t, lang } = useLanguage();
  const { user, profile, isTrainer } = useAuth();
  const hero = translations.hero;
  const [bookingOpen, setBookingOpen] = useState(false);

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

  return (
    <section className="relative min-h-screen flex flex-col bg-background overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top-right glow */}
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-primary/8 blur-[100px]" />
        {/* Bottom-left glow */}
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />
        {/* Center subtle radial */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/3 blur-[150px]" />
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-safe pb-2" style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)' }}>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onProfileClick}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shrink-0"
          >
            {user ? (
              <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-extrabold text-[11px]">{getInitials()}</span>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-secondary border border-border/50 flex items-center justify-center">
                <UserRound className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">Limassol Fitness</span>
        </div>
        <LanguageSwitch />
      </div>

      <div className="relative z-10 flex-1 flex flex-col px-5">
        {/* Hero content area */}
        <div className="flex-1 flex flex-col justify-center items-start max-w-md mx-auto w-full">
          {/* Accent line */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 48 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="h-1 rounded-full gradient-primary mb-5"
          />

          {/* Title - left aligned, bold */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="mb-4"
          >
            <h1 className="text-[3.2rem] leading-[0.95] font-extrabold uppercase font-heading tracking-wide">
              <span className="text-primary">{t(hero.title.line1)}</span>
              <br />
              <span className="text-foreground">{t(hero.title.line2)}</span>
              <br />
              <span className="text-gradient">{t(hero.title.line3)}</span>
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-sm text-muted-foreground leading-relaxed mb-1 max-w-[280px]"
          >
            {t(hero.subtitle)}
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xs text-muted-foreground/50 mb-5"
          >
            — {t(hero.trainer)}
          </motion.p>

          {/* CTA Button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            onClick={() => setBookingOpen(true)}
            className="gradient-primary text-primary-foreground font-bold py-3.5 px-8 rounded-2xl text-sm glow-primary hover:scale-[1.03] transition-transform active:scale-[0.97] flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {t(hero.cta)}
          </motion.button>
        </div>

        {/* Client progress widgets */}
        {user && !isTrainer && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="w-full mb-3"
          >
            <SessionWidget />
            <BodyMeasurementsView userId={user.id} lang={lang} />
          </motion.div>
        )}

        {/* Workouts — horizontal scroll strip */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="pb-20 -mx-5"
        >
          <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-2.5 px-5">
            {t(workouts.title)}
          </h2>
          <div className="flex gap-2.5 overflow-x-auto px-5 pb-2 scrollbar-hide">
            {workouts.items.map((item, i) => {
              const IconComponent = workoutIcons[i] || Dumbbell;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  onClick={() => setExpandedCard(expandedCard === i ? null : i)}
                  className="workout-card-expanded shrink-0 w-[140px] bg-card/80 backdrop-blur-sm rounded-2xl p-3.5 border border-border/40 hover:border-primary/40 transition-all cursor-pointer select-none group"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-2.5 group-hover:bg-primary/20 transition-colors">
                    <IconComponent className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <h3 className="text-[12px] font-bold text-foreground mb-1 leading-tight">{t(item.name)}</h3>
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
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{t(item.desc)}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setBookingOpen(true); }}
                          className="gradient-primary text-primary-foreground font-bold py-1.5 px-3 rounded-lg text-[9px] glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] mt-2 inline-block"
                        >
                          {lang === 'en' ? 'Book' : 'Записаться'}
                        </button>
                      </motion.div>
                    ) : (
                      <motion.p
                        key="collapsed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2"
                      >
                        {t(item.desc)}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Booking Modal */}
      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} onLoginRequest={onProfileClick} />
    </section>
  );
};

export default HeroSection;
