import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Shield, MapPin } from 'lucide-react';
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
          <div className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center text-background font-bold text-sm">
            LF
          </div>
          <span className="text-sm font-black text-foreground tracking-tight uppercase">Limassol Fitness</span>
        </div>
        <LanguageSwitch />
      </div>

      {/* Hero — trainer-centric */}
      <div className="flex-1 flex flex-col px-5 pt-4">
        {/* Trainer photo + name block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative mb-5"
        >
          <div className="relative overflow-hidden rounded-3xl">
            <img
              src={trainerPhoto}
              alt={t(hero.trainer)}
              className="w-full h-64 object-cover object-top"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            
            {/* Name + badge overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-[11px] text-primary font-semibold uppercase tracking-wider">{t(about.accreditation)}</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {t(hero.trainer)}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Limassol, Cyprus
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-lg font-bold text-foreground leading-snug mb-1"
        >
          {t(hero.tagline)}
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-sm text-muted-foreground leading-relaxed mb-5"
        >
          {t(hero.subtitle)}
        </motion.p>

        {/* CTA */}
        <motion.a
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          href="https://calendly.com/limassol-fitness/booking"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-center bg-foreground text-background font-black py-4 rounded-2xl text-sm uppercase tracking-wider hover:scale-[1.02] transition-transform active:scale-[0.98]"
        >
          {t(hero.cta)}
        </motion.a>

        {/* USP pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="grid grid-cols-2 gap-2.5 mt-5"
        >
          {hero.usps.map((usp, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 + i * 0.08 }}
              className="glass rounded-2xl p-3.5"
            >
              <span className="text-xl mb-1.5 block">{usp.icon}</span>
              <h3 className="text-xs font-bold text-foreground mb-0.5">{t(usp.title)}</h3>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{t(usp.desc)}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Certifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.5 }}
          className="mt-5"
        >
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">{t(about.certifications)}</h3>
          <div className="flex flex-wrap gap-2">
            {about.certs.map((cert, i) => (
              <motion.span
                key={cert}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 + i * 0.05 }}
                className="px-3 py-1.5 rounded-full bg-primary/15 text-foreground text-xs font-semibold border border-primary/30"
              >
                {cert}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* Workout types carousel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="mt-6 pb-32"
        >
          <h2 className="text-lg font-bold mb-3">{t(workouts.title)}</h2>
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
            {workouts.items.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 + i * 0.06, duration: 0.4 }}
                onClick={() => setExpandedCard(expandedCard === i ? null : i)}
                className="workout-card-expanded rounded-2xl p-4 min-w-[180px] max-w-[180px] snap-center flex-shrink-0 bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all cursor-pointer select-none"
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
        className="absolute bottom-20 left-1/2 -translate-x-1/2 text-muted-foreground/40"
      >
        <ChevronDown className="w-5 h-5" />
      </motion.div>
    </section>
  );
};

export default HeroSection;
