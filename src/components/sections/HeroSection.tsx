import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Award, MapPin, ArrowRight, ChevronDown } from 'lucide-react';
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
    <section className="relative min-h-screen flex flex-col bg-background">
      {/* Full-bleed hero image */}
      <div className="relative h-[70vh] min-h-[500px]">
        <img
          src={trainerPhoto}
          alt={t(hero.trainer)}
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/40 to-transparent" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-5 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center font-black text-xs text-primary-foreground">
              LF
            </div>
          </div>
          <LanguageSwitch />
        </div>

        {/* Hero text overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-8 z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-primary" />
              <span className="text-[11px] text-primary font-semibold uppercase tracking-[0.15em]">
                {t(about.accreditation)}
              </span>
            </div>
            <h1 className="font-display text-5xl tracking-wide text-foreground leading-none mb-2">
              {t(hero.trainer)}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              Limassol, Cyprus
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content below hero */}
      <div className="px-5 -mt-2 relative z-20">
        {/* Tagline block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-6"
        >
          <h2 className="font-display text-3xl text-foreground tracking-wide leading-tight mb-2">
            {t(hero.tagline)}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t(hero.subtitle)}
          </p>
        </motion.div>

        {/* CTA Button */}
        <motion.a
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          href="https://calendly.com/limassol-fitness/booking"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-center gap-3 w-full gradient-primary text-primary-foreground font-bold py-4.5 rounded-2xl text-sm uppercase tracking-wider glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98]"
        >
          {t(hero.cta)}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </motion.a>

        {/* USP Grid */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="grid grid-cols-2 gap-3 mt-7"
        >
          {hero.usps.map((usp, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.08 }}
              className="bg-card rounded-2xl p-4 border border-border/50 hover:border-primary/30 transition-colors"
            >
              <span className="text-2xl mb-2 block">{usp.icon}</span>
              <h3 className="text-[13px] font-bold text-foreground mb-1">{t(usp.title)}</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{t(usp.desc)}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Certifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.5 }}
          className="mt-7"
        >
          <h3 className="font-display text-lg text-muted-foreground tracking-wider mb-3">{t(about.certifications)}</h3>
          <div className="flex flex-wrap gap-2">
            {about.certs.map((cert, i) => (
              <motion.span
                key={cert}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 + i * 0.05 }}
                className="px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20"
              >
                {cert}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* Workout types */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 0.6 }}
          className="mt-8 pb-28"
        >
          <h2 className="font-display text-2xl tracking-wide mb-4">{t(workouts.title)}</h2>
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
            {workouts.items.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 + i * 0.06, duration: 0.4 }}
                onClick={() => setExpandedCard(expandedCard === i ? null : i)}
                className="workout-card-expanded bg-card rounded-2xl p-4 min-w-[170px] max-w-[170px] snap-center flex-shrink-0 border border-border/50 hover:border-primary/30 transition-all cursor-pointer select-none"
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
      </div>

      {/* Scroll indicator */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-20 left-1/2 -translate-x-1/2 text-muted-foreground/30"
      >
        <ChevronDown className="w-5 h-5" />
      </motion.div>
    </section>
  );
};

export default HeroSection;
