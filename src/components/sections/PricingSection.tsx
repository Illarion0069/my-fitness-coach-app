import { motion } from 'framer-motion';
import { Check, Crown, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';

const PricingSection = () => {
  const { t, lang } = useLanguage();
  const pricing = translations.pricing;

  return (
    <section className="min-h-screen px-5 pt-8 pb-28">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-display text-4xl tracking-wide mb-2"
      >
        {t(pricing.title)}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="flex items-start gap-2 bg-card rounded-xl p-3.5 mb-7 border border-border/50"
      >
        <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">{t(pricing.gymNote)}</p>
      </motion.div>

      <div className="space-y-4">
        {pricing.packages.map((pkg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className={`bg-card rounded-2xl p-6 relative overflow-hidden border ${
              pkg.popular ? 'border-primary/50 glow-primary' : 'border-border/50'
            }`}
          >
            {pkg.popular && (
              <div className="absolute top-4 right-4">
                <Crown className="w-5 h-5 text-primary" />
              </div>
            )}

            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-display text-5xl text-gradient">{pkg.sessions}</span>
              <span className="text-sm text-muted-foreground">
                {lang === 'en' ? 'sessions' : 'тренировок'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{t(pkg.period)}</p>

            <div className="font-display text-3xl text-foreground mb-5">
              {pkg.price}€
            </div>

            <div className="space-y-2.5 mb-6">
              {pkg.features[lang].map((feature, j) => (
                <div key={j} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>

            <a
              href="https://revolut.me/illarion"
              target="_blank"
              rel="noopener noreferrer"
              className={`block w-full text-center py-3.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${
                pkg.popular
                  ? 'gradient-primary text-primary-foreground glow-primary hover:scale-[1.02]'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {t(pricing.buy)}
            </a>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default PricingSection;
