import { motion } from 'framer-motion';
import { Award, Shield } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';
import trainerPhoto from '@/assets/trainer-photo.jpg';

const AboutSection = () => {
  const { t } = useLanguage();
  const about = translations.about;

  return (
    <section className="min-h-screen px-4 pt-6 pb-24">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-2xl font-bold mb-6"
      >
        {t(about.title)}
      </motion.h2>

      {/* Trainer card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass rounded-2xl p-6 mb-6"
      >
        <div className="flex items-center gap-4 mb-4">
          <img
            src={trainerPhoto}
            alt="Illarion Ientin"
            className="w-16 h-16 rounded-2xl object-cover"
          />
          <div>
            <h3 className="text-lg font-bold">{t(about.name)}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-primary font-medium">{t(about.accreditation)}</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {t(about.bio)}
        </p>
      </motion.div>

      {/* Certifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">{t(about.certifications)}</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {about.certs.map((cert, i) => (
            <motion.span
              key={cert}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.05 }}
              className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
            >
              {cert}
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* Reasons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
        className="mt-6 space-y-3"
      >
        {[
          { icon: '🏆', title: { en: 'High Standards', ru: 'Высокие стандарты' }, desc: { en: 'Programs designed according to latest fitness trends ensuring targeted results.', ru: 'Программы разработаны по последним трендам фитнеса для достижения целевых результатов.' } },
          { icon: '🤝', title: { en: 'Full Support', ru: 'Полная поддержка' }, desc: { en: 'Mentoring, accompaniment and monitoring throughout your training journey.', ru: 'Наставничество, сопровождение и контроль на протяжении всего пути.' } },
          { icon: '💎', title: { en: 'Great Value', ru: 'Отличная ценность' }, desc: { en: 'Measurements, progress analysis, professional coaching all included.', ru: 'Замеры, анализ прогресса, профессиональный коучинг — всё включено.' } },
        ].map((item, i) => (
          <div key={i} className="glass rounded-2xl p-4 flex gap-3">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <h4 className="text-sm font-bold mb-1">{t(item.title)}</h4>
              <p className="text-xs text-muted-foreground">{t(item.desc)}</p>
            </div>
          </div>
        ))}
      </motion.div>
    </section>
  );
};

export default AboutSection;
