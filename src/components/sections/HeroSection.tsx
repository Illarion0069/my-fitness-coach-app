import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import renaissanceHero from '@/assets/renaissance-hero.jpg';
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
    <section className="relative flex flex-col bg-background">
      {/* ===== SPLIT HERO — GIANT TEXT + IMAGE ===== */}
      <div className="relative w-full overflow-hidden">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pt-5">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/60 font-sans"
          >
            {t(about.accreditation)}
          </motion.span>
          <LanguageSwitch />
        </div>

        {/* Giant company name */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="pt-16 px-4"
        >
          <h1
            className="font-black uppercase leading-[0.85] tracking-tight text-foreground"
            style={{ fontSize: 'clamp(4rem, 18vw, 10rem)' }}
          >
            LIMASSOL<br />FITNESS
          </h1>
        </motion.div>

        {/* Image strip — overlapped by text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.5 }}
          className="relative w-full h-[55vh] -mt-4 overflow-hidden"
        >
          <img
            src={renaissanceHero}
            alt={t(hero.trainer)}
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/80" />

          {/* Tagline + CTA over image */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="absolute bottom-8 left-0 right-0 z-10 px-6 flex flex-col items-center gap-4"
          >
            <p className="text-xs text-white/70 leading-relaxed font-sans text-center max-w-[280px]">
              {t(hero.tagline)}
            </p>
            <a
              href="https://calendly.com/limassol-fitness/booking"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-white/30 text-white/90 font-sans text-[11px] font-medium uppercase tracking-[0.2em] px-6 py-3 backdrop-blur-sm bg-white/5 hover:bg-white/10 transition-all"
            >
              {t(hero.cta)}
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </motion.div>
        </motion.div>
      </div>

      {/* ===== BELOW THE FOLD ===== */}
      <div className="px-5 pt-12 pb-6">
        {/* USPs */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 gap-px bg-border mb-10"
        >
          {hero.usps.map((usp, i) => (
            <div key={i} className="bg-background p-5">
              <span className="text-lg mb-2 block">{usp.icon}</span>
              <h3 className="text-[10px] font-bold text-foreground mb-1 font-sans uppercase tracking-wider">
                {t(usp.title)}
              </h3>
              <p className="text-[10px] text-muted-foreground leading-relaxed font-sans">
                {t(usp.desc)}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Certifications */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3 font-sans">
            {t(about.certifications)}
          </p>
          <div className="flex flex-wrap gap-2">
            {about.certs.map((cert) => (
              <span
                key={cert}
                className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border border-border text-muted-foreground font-sans"
              >
                {cert}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Workout types — horizontal scroll */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="pb-24"
        >
          <div className="editorial-line mb-4" />
          <h2 className="text-2xl font-bold mb-5">{t(workouts.title)}</h2>
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
            {workouts.items.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                onClick={() => setExpandedCard(expandedCard === i ? null : i)}
                className="workout-card-expanded border border-border bg-background p-4 min-w-[170px] max-w-[170px] snap-center flex-shrink-0 hover:border-primary/40 transition-all cursor-pointer select-none"
              >
                <div className="text-xl mb-2">{item.icon}</div>
                <h3 className="text-xs font-bold text-foreground mb-1 font-sans uppercase tracking-wider">
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
                      <p className="text-[10px] text-muted-foreground leading-relaxed font-sans">
                        {t(item.desc)}
                      </p>
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
