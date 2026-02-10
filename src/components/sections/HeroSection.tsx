import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import trainerLogo from '@/assets/trainer-logo.png';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';
import LanguageSwitch from '@/components/LanguageSwitch';

interface HeroSectionProps {
  onNavigate: (section: string) => void;
}

const HeroSection = ({ onNavigate }: HeroSectionProps) => {
  const { t } = useLanguage();
  const hero = translations.hero;
  const workouts = translations.workouts;

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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-2 text-xs text-muted-foreground/70"
        >
          — {t(hero.trainer)}
        </motion.p>

        <motion.a
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          href="https://calendly.com/limassol-fitness/booking"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-block gradient-primary text-primary-foreground font-semibold px-8 py-3.5 rounded-2xl text-sm glow-primary hover:scale-105 transition-transform active:scale-95"
        >
          {t(hero.cta)}
        </motion.a>
      </div>

      {/* Workout types carousel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="px-4 pb-24"
      >
        <h2 className="text-lg font-bold mb-3 px-2">{t(workouts.title)}</h2>
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {workouts.items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 + i * 0.08, duration: 0.4 }}
              className="glass rounded-2xl p-4 min-w-[200px] max-w-[200px] snap-center flex-shrink-0 hover:border-primary/30 transition-colors"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <h3 className="text-sm font-bold text-foreground mb-1">{t(item.name)}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{t(item.desc)}</p>
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
