import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';

const PricingSection = () => {
  const { t, lang } = useLanguage();
  const pricing = translations.pricing;

  return (
    <section className="min-h-screen px-5 pt-8 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div className="editorial-line mb-4" />
        <h2 className="text-3xl font-bold mb-2">{t(pricing.title)}</h2>
        <p className="text-xs text-muted-foreground mb-8 uppercase tracking-wider font-sans">{t(pricing.gymNote)}</p>
      </motion.div>

      <div className="space-y-4">
        {pricing.packages.map((pkg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className={`border p-6 relative ${
              pkg.popular ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            {pkg.popular && (
              <span className="absolute top-4 right-4 text-[9px] uppercase tracking-[0.2em] text-primary font-semibold font-sans">
                {lang === 'en' ? 'Popular' : 'Популярный'}
              </span>
            )}

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-bold text-gradient">{pkg.sessions}</span>
              <span className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                {lang === 'en' ? 'sessions' : 'тренировок'}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mb-4 font-sans uppercase tracking-wider">{t(pkg.period)}</p>

            <div className="text-2xl font-bold text-foreground mb-5">
              {pkg.price}€
            </div>

            <div className="space-y-2 mb-6">
              {pkg.features[lang].map((feature, j) => (
                <div key={j} className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground font-sans">{feature}</span>
                </div>
              ))}
            </div>

            <a
              href="https://revolut.me/illarion"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 w-full py-3 text-xs font-semibold uppercase tracking-wider transition-all font-sans ${
                pkg.popular
                  ? 'bg-primary text-primary-foreground hover:opacity-90'
                  : 'border border-foreground/20 text-foreground hover:border-primary hover:text-primary'
              }`}
            >
              {t(pricing.buy)}
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default PricingSection;