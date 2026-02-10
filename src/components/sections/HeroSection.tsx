import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, X } from 'lucide-react';
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
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <motion.span 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs font-bold uppercase tracking-[0.2em] text-foreground"
        >
          LF
        </motion.span>
        <LanguageSwitch />
      </div>

      <div className="flex-1 flex flex-col px-4">
        {/* Giant title */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-2 mb-5"
        >
          <h1 className="text-[2.8rem] leading-[0.95] font-extrabold text-foreground uppercase">
            {t(hero.trainer)}
          </h1>
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mt-2">
            {t(about.accreditation)}
          </p>
        </motion.div>

        {/* Bento grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="grid grid-cols-2 gap-2.5 mb-5"
        >
          {/* Large trainer card — spans 2 cols */}
          <div className="col-span-2 bento-card group h-64 relative">
            <img
              src={trainerPhoto}
              alt={t(hero.trainer)}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
            <div className="bento-arrow z-10">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
              <p className="text-sm text-background/80 font-medium leading-relaxed max-w-[280px]">
                {t(hero.tagline)}
              </p>
            </div>
          </div>

          {/* USP cards */}
          {hero.usps.map((usp, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              className="bento-card group p-4 flex flex-col justify-between min-h-[140px]"
            >
              <div className="flex items-start justify-between">
                <span className="text-2xl">{usp.icon}</span>
                <div className="bento-arrow !relative !top-0 !right-0 w-7 h-7">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider leading-tight mb-1">
                  {t(usp.title)}
                </h3>
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                  {t(usp.desc)}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="mb-6"
        >
          <a
            href="https://calendly.com/limassol-fitness/booking"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full bg-primary text-primary-foreground font-bold py-4 text-sm tracking-wide uppercase rounded-xl hover:opacity-90 transition-all active:scale-[0.98]"
          >
            {t(hero.cta)}
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </motion.div>

        {/* Certifications — pill row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="mb-6"
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2.5 font-medium">
            {t(about.certifications)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {about.certs.map((cert) => (
              <span
                key={cert}
                className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary rounded-full"
              >
                {cert}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Workout types — horizontal scroll bento */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.5 }}
          className="pb-24"
        >
          <h2 className="text-2xl font-extrabold uppercase mb-4">{t(workouts.title)}</h2>
          <div className="flex gap-2.5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
            {workouts.items.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.85 + i * 0.05 }}
                onClick={() => setExpandedCard(expandedCard === i ? null : i)}
                className="workout-card-expanded bento-card group p-4 min-w-[160px] max-w-[160px] snap-center flex-shrink-0 cursor-pointer select-none"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-xl">{item.icon}</div>
                  <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center">
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                  </div>
                </div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                  {t(item.name)}
                </h3>
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
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{t(item.desc)}</p>
                      <div className="mt-2 flex justify-end">
                        <X className="w-3 h-3 text-muted-foreground/40" />
                      </div>
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
            ))}
          </div>
        </motion.div>

        {/* Service ticker */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="fixed bottom-14 left-0 right-0 z-40 overflow-hidden border-t border-border bg-background/90 backdrop-blur-sm"
        >
          <div className="flex animate-[scroll_20s_linear_infinite] whitespace-nowrap py-2.5">
            {[...about.certs, ...about.certs, ...about.certs].map((cert, i) => (
              <span key={i} className="flex items-center gap-3 px-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {cert}
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
