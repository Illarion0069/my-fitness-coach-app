import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Calendar, Trophy, Users, Clock, Zap } from 'lucide-react';
import trainerPhoto from '@/assets/trainer-photo.jpg';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';
import LanguageSwitch from '@/components/LanguageSwitch';

interface HeroSectionProps {
  onNavigate: (section: string) => void;
}

const stats = [
  { value: '8+', labelEn: 'Years', labelRu: 'Лет', icon: Clock },
  { value: '200+', labelEn: 'Clients', labelRu: 'Клиентов', icon: Users },
  { value: 'EQF 4', labelEn: 'Level', labelRu: 'Уровень', icon: Trophy },
];

const HeroSection = ({ onNavigate }: HeroSectionProps) => {
  const { t, lang } = useLanguage();
  const hero = translations.hero;
  const about = translations.about;
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
      {/* Top bar — minimal */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-extrabold text-[11px]">
            LF
          </div>
        </div>
        <LanguageSwitch />
      </div>

      <div className="flex-1 flex flex-col px-5">
        {/* Trainer card — compact horizontal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-4 mb-5"
        >
          <img
            src={trainerPhoto}
            alt={t(hero.trainer)}
            className="w-16 h-16 rounded-2xl object-cover object-top ring-2 ring-primary/30"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold text-foreground tracking-tight truncate">
              {t(hero.trainer)}
            </h1>
            <p className="text-xs text-primary font-semibold uppercase tracking-wider">
              {t(about.accreditation)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Limassol, Cyprus</p>
          </div>
        </motion.div>

        {/* Main CTA — big and bold */}
        <motion.a
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          href="https://calendly.com/limassol-fitness/booking"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative overflow-hidden gradient-primary text-primary-foreground rounded-2xl p-5 mb-5 glow-primary hover:scale-[1.01] transition-transform active:scale-[0.99]"
        >
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">
                {lang === 'en' ? 'Ready to start?' : 'Готовы начать?'}
              </p>
              <p className="text-xl font-extrabold">{t(hero.cta)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
          </div>
          <ArrowRight className="absolute right-5 bottom-3 w-4 h-4 opacity-40 group-hover:translate-x-1 transition-transform" />
        </motion.a>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="grid grid-cols-3 gap-3 mb-6"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 + i * 0.08 }}
              className="bg-card rounded-2xl p-3.5 text-center border border-border/50"
            >
              <stat.icon className="w-4 h-4 text-primary mx-auto mb-1.5" />
              <p className="text-lg font-extrabold text-foreground leading-none">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                {lang === 'en' ? stat.labelEn : stat.labelRu}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* USPs — horizontal scrollable chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mb-6"
        >
          <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-3">
            {lang === 'en' ? 'Why me' : 'Почему я'}
          </h2>
          <div className="space-y-2.5">
            {hero.usps.map((usp, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.07 }}
                className="flex items-start gap-3 bg-card rounded-xl p-3.5 border border-border/50"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center text-lg shrink-0">
                  {usp.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-bold text-foreground">{t(usp.title)}</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{t(usp.desc)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Certifications — inline tags */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mb-6"
        >
          <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-2.5">
            {t(about.certifications)}
          </h2>
          <div className="flex flex-wrap gap-2">
            {about.certs.map((cert, i) => (
              <span
                key={cert}
                className="px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-[11px] font-semibold"
              >
                {cert}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Workout types — large cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="pb-28"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider">
              {t(workouts.title)}
            </h2>
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {workouts.items.slice(0, 6).map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85 + i * 0.05 }}
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
                      <X className="w-3 h-3 text-muted-foreground/40 mt-2 ml-auto" />
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
          {/* 7th workout card full-width */}
          {workouts.items[6] && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.15 }}
              onClick={() => setExpandedCard(expandedCard === 6 ? null : 6)}
              className="workout-card-expanded bg-card rounded-2xl p-4 border border-border/50 hover:border-primary/30 transition-all cursor-pointer select-none mt-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{workouts.items[6].icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13px] font-bold text-foreground">{t(workouts.items[6].name)}</h3>
                  <AnimatePresence mode="wait">
                    {expandedCard === 6 ? (
                      <motion.p
                        key="exp"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="text-[11px] text-muted-foreground leading-relaxed mt-1 overflow-hidden"
                      >
                        {t(workouts.items[6].desc)}
                      </motion.p>
                    ) : (
                      <motion.p key="col" className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {t(workouts.items[6].desc)}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
