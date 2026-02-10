import { motion } from 'framer-motion';
import { Star, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';

const ReviewsSection = () => {
  const { t, lang } = useLanguage();
  const reviews = translations.reviews;

  return (
    <section className="px-4 pt-6 pb-8">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-2xl font-bold mb-1"
      >
        {t(reviews.title)}
      </motion.h2>
      <div className="flex items-center gap-2 mb-6">
        <p className="text-sm text-muted-foreground">{t(reviews.subtitle)}</p>
        <a
          href="https://maps.app.goo.gl/Jh2iDYPA7HyZGLbH7"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
        >
          <Star className="w-3 h-3 fill-primary text-primary" />
          5.0 Google
          <ExternalLink className="w-3 h-3" />
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
            className="glass rounded-2xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {t(review.name).charAt(0)}
              </div>
              <div>
                <h4 className="text-sm font-bold">{t(review.name)}</h4>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="flex gap-0.5">
                    {Array.from({ length: review.rating }).map((_, j) => (
                      <Star key={j} className="w-3 h-3 fill-primary text-primary" />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground ml-1">Google</span>
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
        className="mt-4 flex items-center justify-center gap-2 text-sm text-primary font-medium hover:underline"
      >
        {lang === 'en' ? 'See all reviews on Google Maps' : 'Все отзывы на Google Картах'}
        <ExternalLink className="w-4 h-4" />
      </motion.a>
    </section>
  );
};

export default ReviewsSection;
