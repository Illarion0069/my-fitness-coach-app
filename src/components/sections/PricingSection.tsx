import { motion } from 'framer-motion';
import { Check, Crown, AlertCircle, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';

const PricingSection = () => {
  const { t, lang } = useLanguage();
  const pricing = translations.pricing;

  return (
    <section className="min-h-screen px-5 pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top, 32px), 32px)' }}>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-2xl font-extrabold uppercase tracking-tight mb-2"
      >
        {t(pricing.title)}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="flex items-start gap-2.5 bg-card rounded-xl p-3.5 mb-6 border border-border/50"
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
            className={`bg-card rounded-2xl p-5 relative overflow-hidden border ${
              pkg.popular ? 'border-primary/50 glow-primary' : 'border-border/50'
            }`}
          >
            {pkg.popular && (
              <div className="absolute top-0 right-0 gradient-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                <Crown className="w-3 h-3 inline mr-1" />
                {lang === 'en' ? 'Popular' : 'Популярно'}
              </div>
            )}

            <div className="flex items-end justify-between mb-4">
              <div>
                <span className="text-4xl font-extrabold text-gradient">{pkg.sessions}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  {lang === 'en' ? 'sessions' : 'тренировок'}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">{t(pkg.period)}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold text-foreground">{pkg.price}€</div>
                <div className="text-[10px] text-muted-foreground">
                  {Math.round(pkg.price / pkg.sessions)}€/{lang === 'en' ? 'session' : 'трен.'}
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              {pkg.features[lang].map((feature, j) => (
                <div key={j} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
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
              className={`group flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
                pkg.popular
                  ? 'gradient-primary text-primary-foreground glow-primary hover:scale-[1.02]'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {t(pricing.buy)}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default PricingSection;
