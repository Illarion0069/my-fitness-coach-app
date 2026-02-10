import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';
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
      {/* Header — minimal editorial */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <motion.span 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground"
        >
          Limassol Fitness
        </motion.span>
        <LanguageSwitch />
      </div>

      {/* Hero — editorial layout */}
      <div className="flex-1 flex flex-col px-5">
        {/* Large editorial title */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 mb-6"
        >
          <div className="editorial-line mb-4" />
          <h1 className="text-[2.75rem] leading-[1.05] font-bold text-foreground tracking-tight">
            {t(hero.trainer)}
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary font-medium mt-3">
            {t(about.accreditation)}
          </p>
        </motion.div>

        {/* Trainer photo — dramatic full-width */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-6 overflow-hidden"
        >
          <img
            src={trainerPhoto}
            alt={t(hero.trainer)}
            className="w-full h-72 object-cover object-top grayscale-[20%] contrast-[1.1]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <p className="text-sm text-foreground/80 italic font-light leading-relaxed max-w-[280px]">
              {t(hero.tagline)}
            </p>
          </div>
        </motion.div>

        {/* Subtitle + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-8"
        >
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            {t(hero.subtitle)}
          </p>
          <a
            href="https://calendly.com/limassol-fitness/booking"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-primary text-primary-foreground font-semibold py-3.5 px-7 text-sm tracking-wide uppercase hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            {t(hero.cta)}
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>

        {/* USPs — editorial grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="grid grid-cols-2 gap-px bg-border mb-8"
        >
          {hero.usps.map((usp, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 + i * 0.1 }}
              className="bg-background p-4"
            >
              <span className="text-lg mb-2 block">{usp.icon}</span>
              <h3 className="text-xs font-bold text-foreground mb-1 font-sans uppercase tracking-wider">{t(usp.title)}</h3>
              <p className="text-[10px] text-muted-foreground leading-relaxed font-sans">{t(usp.desc)}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Certifications — minimal line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.5 }}
          className="mb-8"
        >
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3 font-sans">{t(about.certifications)}</p>
          <div className="flex flex-wrap gap-2">
            {about.certs.map((cert, i) => (
              <span
                key={cert}
                className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border border-border text-muted-foreground font-sans"
              >
                {cert}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Workout types — editorial list */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="pb-32"
        >
          <div className="editorial-line mb-4" />
          <h2 className="text-2xl font-bold mb-5">{t(workouts.title)}</h2>
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
            {workouts.items.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 + i * 0.06, duration: 0.4 }}
                onClick={() => setExpandedCard(expandedCard === i ? null : i)}
                className="workout-card-expanded border border-border bg-background p-4 min-w-[170px] max-w-[170px] snap-center flex-shrink-0 hover:border-primary/40 transition-all cursor-pointer select-none"
              >
                <div className="text-xl mb-2">{item.icon}</div>
                <h3 className="text-xs font-bold text-foreground mb-1 font-sans uppercase tracking-wider">{t(item.name)}</h3>
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
                      <p className="text-[10px] text-muted-foreground leading-relaxed font-sans">{t(item.desc)}</p>
                      <div className="mt-2 flex justify-end">
                        <X className="w-3 h-3 text-muted-foreground/40" />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.p
                      key="collapsed"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 font-sans"
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
    </section>
  );
};

export default HeroSection;