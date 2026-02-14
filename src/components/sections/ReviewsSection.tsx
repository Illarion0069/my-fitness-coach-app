import { motion } from 'framer-motion';
import { Star, ExternalLink, Quote } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';

const ReviewsSection = () => {
  const { t, lang } = useLanguage();
  const reviews = translations.reviews;

  return (
    <section className="min-h-screen px-5 pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top, 32px), 32px)' }}>
      <div className="flex items-end justify-between mb-6">
        <div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl font-extrabold uppercase tracking-tight mb-1"
          >
            {t(reviews.title)}
          </motion.h2>
          <p className="text-sm text-muted-foreground">{t(reviews.subtitle)}</p>
        </div>
        <a
          href="https://maps.app.goo.gl/Jh2iDYPA7HyZGLbH7"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 bg-card px-3 py-1.5 rounded-xl border border-border/50 text-xs font-bold text-primary shrink-0"
        >
          <Star className="w-3.5 h-3.5 fill-primary text-primary" />
          5.0
        </a>
      </div>

      <div className="space-y-4">
        {reviews.items.map((review, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="bg-card rounded-2xl p-5 border border-border/50 relative"
          >
            <Quote className="absolute top-4 right-4 w-5 h-5 text-primary/15" />
            <div className="flex items-center gap-3 mb-3.5">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                {t(review.name).charAt(0)}
              </div>
              <div>
                <h4 className="text-sm font-bold">{t(review.name)}</h4>
                <div className="flex items-center gap-1 mt-0.5">
                  {Array.from({ length: review.rating }).map((_, j) => (
                    <Star key={j} className="w-3 h-3 fill-primary text-primary" />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{t(review.desc)}</p>
          </motion.div>
        ))}
      </div>

      <motion.a
        href="https://maps.app.goo.gl/Jh2iDYPA7HyZGLbH7"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-6 flex items-center justify-center gap-2 text-sm text-primary font-semibold hover:underline"
      >
        {lang === 'en' ? 'All reviews on Google Maps' : 'Все отзывы на Google Картах'}
        <ExternalLink className="w-4 h-4" />
      </motion.a>
    </section>
  );
};

export default ReviewsSection;
