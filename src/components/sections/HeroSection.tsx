import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import trainerLogo from '@/assets/trainer-logo.png';
import trainerPhoto from '@/assets/trainer-photo.jpg';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';
import LanguageSwitch from '@/components/LanguageSwitch';

interface HeroSectionProps {
  onNavigate: (section: string) => void;
}

const HeroSection = ({ onNavigate }: HeroSectionProps) => {
  const { t } = useLanguage();
  const hero = translations.hero;
  const about = translations.about;
  const workouts = translations.workouts;
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expandedCard === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.workout-card-expanded')) {
        setExpandedCard(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expandedCard]);

  return (
    <section className="relative min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            LF
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">Limassol Fitness</span>
        </div>
        <LanguageSwitch />
      </div>

      {/* Hero content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-6"
        >
          <img
            src={trainerLogo}
            alt="Illarion Ientin — Personal Fitness Trainer"
            className="w-28 h-28 rounded-full object-cover border-2 border-primary/30 shadow-lg shadow-primary/20"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
            <span className="text-gradient">PERSONAL</span>
            <br />
            <span className="text-foreground">FITNESS</span>
            <br />
            <span className="text-gradient">ASSISTANT</span>
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-4 text-muted-foreground text-sm max-w-xs"
        >
          {t(hero.subtitle)}
        </motion.p>

        {/* Trainer intro card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          onClick={() => onNavigate('about')}
          className="mt-5 glass rounded-2xl p-4 flex items-center gap-3 max-w-xs w-full cursor-pointer hover:border-primary/30 transition-all active:scale-[0.98]"
        >
          <img
            src={trainerPhoto}
            alt={t(hero.trainer)}
            className="w-12 h-12 rounded-xl object-cover border border-primary/20"
          />
          <div className="text-left flex-1">
            <p className="text-sm font-bold text-foreground">{t(hero.trainer)}</p>
            <p className="text-[10px] text-primary font-medium">{t(about.accreditation)}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground/50 -rotate-90" />
        </motion.div>

        <motion.a
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          href="https://calendly.com/limassol-fitness/booking"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block gradient-primary text-primary-foreground font-semibold px-8 py-3.5 rounded-2xl text-sm glow-primary hover:scale-105 transition-transform active:scale-95"
        >
          {t(hero.cta)}
        </motion.a>
      </div>

      {/* Workout types carousel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="px-4 pb-32"
      >
        <h2 className="text-lg font-bold mb-3 px-2">{t(workouts.title)}</h2>
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {workouts.items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 + i * 0.08, duration: 0.4 }}
              onClick={() => setExpandedCard(expandedCard === i ? null : i)}
              className="workout-card-expanded glass rounded-2xl p-4 min-w-[200px] max-w-[200px] snap-center flex-shrink-0 hover:border-primary/30 transition-all cursor-pointer select-none"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <h3 className="text-sm font-bold text-foreground mb-1">{t(item.name)}</h3>
              <AnimatePresence mode="wait">
                {expandedCard === i ? (
                  <motion.div
                    key="expanded"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <p className="text-xs text-muted-foreground leading-relaxed">{t(item.desc)}</p>
                    <div className="mt-2 flex justify-end">
                      <X className="w-3.5 h-3.5 text-muted-foreground/50" />
                    </div>
                  </motion.div>
                ) : (
                  <motion.p
                    key="collapsed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-muted-foreground leading-relaxed line-clamp-2"
                  >
                    {t(item.desc)}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-20 left-1/2 -translate-x-1/2 text-muted-foreground/40"
      >
        <ChevronDown className="w-5 h-5" />
      </motion.div>
    </section>
  );
};

export default HeroSection;
