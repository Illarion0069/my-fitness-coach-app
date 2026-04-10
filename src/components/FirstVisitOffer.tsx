import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, Ruler, ClipboardList, Clock, ArrowRight, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import trainerPhoto from '@/assets/trainer-photo.jpg';
import ConsultationModal from '@/components/ConsultationModal';

interface FirstVisitOfferProps {
  onDismiss: () => void;
  onProceedToRegister: () => void;
}

const FirstVisitOffer = ({ onDismiss, onProceedToRegister }: FirstVisitOfferProps) => {
  const { lang } = useLanguage();
  const [showPayment, setShowPayment] = useState(false);

  const features = [
    {
      icon: <Clock className="w-5 h-5" />,
      text: lang === 'en' ? '1-hour personal session' : '1 час персональной сессии',
    },
    {
      icon: <Ruler className="w-5 h-5" />,
      text: lang === 'en' ? 'Body composition analysis' : 'Анализ состава тела',
    },
    {
      icon: <ClipboardList className="w-5 h-5" />,
      text: lang === 'en' ? 'Health & goals assessment' : 'Оценка здоровья и целей',
    },
    {
      icon: <Stethoscope className="w-5 h-5" />,
      text: lang === 'en' ? 'Personal training plan' : 'Персональный план',
    },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[250] bg-background flex flex-col"
      >
        {/* Skip button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top section — trainer photo with gradient overlay */}
        <div className="relative flex-shrink-0">
          <div className="h-[38vh] overflow-hidden">
            <img
              src={trainerPhoto}
              alt="Personal trainer"
              className="w-full h-full object-cover"
              style={{ objectPosition: '60% 20%' }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
          </div>

          {/* Price badge floating over the photo */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring', damping: 15 }}
            className="absolute -bottom-6 left-1/2 -translate-x-1/2"
          >
            <div className="gradient-primary text-primary-foreground font-black text-3xl py-3 px-8 rounded-2xl shadow-2xl glow-primary">
              50€
            </div>
          </motion.div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col px-6 pt-10 pb-6 overflow-y-auto">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-6"
          >
            <h1 className="text-2xl font-extrabold text-foreground leading-tight">
              {lang === 'en' ? 'Start with a consultation' : 'Начните с консультации'}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-[280px] mx-auto">
              {lang === 'en'
                ? 'A personal meeting to build your training foundation'
                : 'Личная встреча для построения базы тренировок'}
            </p>
          </motion.div>

          {/* Feature list */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="space-y-2.5 mb-auto"
          >
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-card/80 border border-border/30 rounded-xl p-3">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
                  {f.icon}
                </div>
                <span className="text-sm font-medium text-foreground">{f.text}</span>
              </div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 space-y-3"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <button
              onClick={() => setShowPayment(true)}
              className="group w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl text-base glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {lang === 'en' ? 'Book consultation — 50€' : 'Записаться — 50€'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={onDismiss}
              className="w-full text-muted-foreground text-sm py-2 hover:text-foreground transition-colors"
            >
              {lang === 'en' ? 'Browse first' : 'Сначала посмотрю'}
            </button>
          </motion.div>
        </div>
      </motion.div>

      <ConsultationModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        onProceedToRegister={() => {
          setShowPayment(false);
          onDismiss();
          onProceedToRegister();
        }}
      />
    </>
  );
};

export default FirstVisitOffer;
