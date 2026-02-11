import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Shield, Target, Handshake, Gem, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';
import trainerPhoto from '@/assets/trainer-photo.jpg';

const reasons = [
  {
    icon: Target,
    title: { en: 'High Standards', ru: 'Высокие стандарты' },
    desc: {
      en: 'Programs designed according to latest fitness trends ensuring targeted results.',
      ru: 'Программы разработаны по последним трендам фитнеса для достижения целевых результатов.',
    },
    stat: { value: '200+', label: { en: 'clients', ru: 'клиентов' } },
  },
  {
    icon: Handshake,
    title: { en: 'Full Support', ru: 'Полная поддержка' },
    desc: {
      en: 'Mentoring, accompaniment and monitoring throughout your training journey.',
      ru: 'Наставничество, сопровождение и контроль на протяжении всего пути.',
    },
    stat: { value: '24/7', label: { en: 'support', ru: 'на связи' } },
  },
  {
    icon: Gem,
    title: { en: 'Great Value', ru: 'Отличная ценность' },
    desc: {
      en: 'Measurements, progress analysis, professional coaching all included.',
      ru: 'Замеры, анализ прогресса, профессиональный коучинг — всё включено.',
    },
    stat: { value: '8+', label: { en: 'years exp', ru: 'лет опыта' } },
  },
];

const AboutSection = () => {
  const { t, lang } = useLanguage();
  const about = translations.about;
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [expandedReason, setExpandedReason] = useState<number | null>(null);

  return (
    <section className="min-h-screen px-5 pt-8 pb-28">
      {/* Hero banner with trainer photo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden mb-6"
      >
        <img
          src={trainerPhoto}
          alt="Illarion Ientin"
          onClick={() => setPhotoExpanded(true)}
          className="w-full h-48 object-cover object-top cursor-pointer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h2 className="text-2xl font-extrabold uppercase tracking-tight font-heading">
            {lang === 'en' ? 'WHY ME?' : 'ПОЧЕМУ Я?'}
          </h2>
          <div className="flex items-center gap-1.5 mt-1">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-primary font-bold">{t(about.accreditation)}</span>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        {[
          { value: '200+', label: lang === 'en' ? 'Clients' : 'Клиентов' },
          { value: '8+', label: lang === 'en' ? 'Years' : 'Лет' },
          { value: 'EQF 4', label: lang === 'en' ? 'Level' : 'Уровень' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="bg-card border border-border/50 rounded-2xl p-3 text-center"
          >
            <div className="text-xl font-extrabold text-primary font-heading">{stat.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Interactive reasons cards */}
      <div className="space-y-3 mb-6">
        {reasons.map((reason, i) => {
          const Icon = reason.icon;
          const isExpanded = expandedReason === i;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              onClick={() => setExpandedReason(isExpanded ? null : i)}
              className={`bg-card rounded-2xl border cursor-pointer transition-all duration-300 ${
                isExpanded ? 'border-primary shadow-lg shadow-primary/10' : 'border-border/50'
              }`}
            >
              <div className="p-4 flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                  isExpanded ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold">{t(reason.title)}</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-extrabold text-primary">{reason.stat.value}</span>
                    <span className="text-[10px] text-muted-foreground">{t(reason.stat.label)}</span>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
              </div>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 pb-4 text-xs text-muted-foreground leading-relaxed">
                      {t(reason.desc)}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Certifications as scrollable chips */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-card rounded-2xl border border-border/50 p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider">{t(about.certifications)}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {about.certs.map((cert, i) => (
            <motion.span
              key={cert}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 + i * 0.05 }}
              className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20"
            >
              {cert}
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* Photo lightbox */}
      <AnimatePresence>
        {photoExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPhotoExpanded(false)}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          >
            <motion.img
              src={trainerPhoto}
              alt="Illarion Ientin"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="max-w-full max-h-[70vh] rounded-2xl object-cover shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default AboutSection;
