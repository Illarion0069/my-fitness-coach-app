import { motion } from 'framer-motion';
import { Star, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';

const ReviewsSection = () => {
  const { t, lang } = useLanguage();
  const reviews = translations.reviews;

  return (
    <section className="min-h-screen px-5 pt-8 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div className="editorial-line mb-4" />
        <h2 className="text-3xl font-bold mb-1">{t(reviews.title)}</h2>
        <div className="flex items-center gap-3 mb-8">
          <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">{t(reviews.subtitle)}</p>
          <a
            href="https://maps.app.goo.gl/Jh2iDYPA7HyZGLbH7"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-primary font-medium hover:underline font-sans uppercase tracking-wider"
          >
            5.0 Google
            <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      </motion.div>

      <div className="space-y-px">
        {reviews.items.map((review, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="border-t border-border py-6"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 flex items-center justify-center text-primary font-bold text-xs font-sans">
                  {t(review.name).charAt(0)}
                </div>
                <h4 className="text-sm font-semibold font-sans">{t(review.name)}</h4>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: review.rating }).map((_, j) => (
                  <Star key={j} className="w-3 h-3 fill-primary text-primary" />
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-sans pl-11">{t(review.desc)}</p>
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
        className="mt-6 inline-flex items-center gap-2 text-xs text-primary font-medium hover:underline font-sans uppercase tracking-wider"
      >
        {lang === 'en' ? 'All reviews on Google Maps' : 'Все отзывы на Google Картах'}
        <ArrowUpRight className="w-3.5 h-3.5" />
      </motion.a>
    </section>
  );
};

export default ReviewsSection;