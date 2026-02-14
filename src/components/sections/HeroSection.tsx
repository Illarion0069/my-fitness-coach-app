import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, UserRound } from 'lucide-react';
import trainerPhoto from '@/assets/trainer-photo.jpg';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';
import LanguageSwitch from '@/components/LanguageSwitch';
import { useAuth } from '@/contexts/AuthContext';
import BookingModal from '@/components/BookingModal';

interface HeroSectionProps {
  onNavigate: (section: string) => void;
  onProfileClick: () => void;
}

const HeroSection = ({ onNavigate, onProfileClick }: HeroSectionProps) => {
  const { t, lang } = useLanguage();
  const { user, profile } = useAuth();
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
    <section className="relative min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
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
          <h1 className="text-4xl font-extrabold uppercase tracking-tight font-heading leading-[1.1]">
            <span className="text-primary">{lang === 'en' ? 'PERSONAL' : 'ПЕРСОНАЛЬНЫЙ'}</span>
            <br />
            <span className="text-foreground">{lang === 'en' ? 'FITNESS' : 'ФИТНЕС'}</span>
            <br />
            <span className="text-primary">{lang === 'en' ? 'ASSISTANT' : 'АССИСТЕНТ'}</span>
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="text-center mb-6"
        >
          <p className="text-sm text-muted-foreground">{t(hero.subtitle)}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">— {t(hero.trainer)}</p>
        </motion.div>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          onClick={() => setBookingOpen(true)}
          className="gradient-primary text-primary-foreground font-bold py-3.5 px-10 rounded-2xl text-base glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] mb-10"
        >
          {t(hero.cta)}
        </motion.button>

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
      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} onLoginRequest={onProfileClick} />
    </section>
  );
};

export default HeroSection;
