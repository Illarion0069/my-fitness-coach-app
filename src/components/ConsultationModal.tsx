import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, Stethoscope, Ruler, ClipboardList, Clock, CreditCard, ExternalLink, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ConsultationModalProps {
  open: boolean;
  onClose: () => void;
  onProceedToRegister: () => void;
}

const REVOLUT_LINK = 'https://revolut.me/illarion';

type Step = 'info' | 'payment';

const ConsultationModal = ({ open, onClose, onProceedToRegister }: ConsultationModalProps) => {
  const { lang } = useLanguage();
  const [step, setStep] = useState<Step>('info');
  const [paymentOpened, setPaymentOpened] = useState(false);

  // Reset on open
  if (!open) return null;

  const handlePayClick = () => {
    window.open(REVOLUT_LINK, '_blank');
    setPaymentOpened(true);
  };

  const handlePaid = () => {
    onClose();
    onProceedToRegister();
  };

  const features = [
    {
      icon: <Clock className="w-5 h-5 text-primary" />,
      title: lang === 'en' ? '1-hour session' : '1 час',
      desc: lang === 'en'
        ? 'A detailed one-on-one meeting with your trainer'
        : 'Детальная встреча один-на-один с тренером',
    },
    {
      icon: <Ruler className="w-5 h-5 text-primary" />,
      title: lang === 'en' ? 'Body measurements' : 'Замеры тела',
      desc: lang === 'en'
        ? 'Full body composition assessment and baseline metrics'
        : 'Полная оценка композиции тела и базовые показатели',
    },
    {
      icon: <ClipboardList className="w-5 h-5 text-primary" />,
      title: lang === 'en' ? 'Health questionnaire' : 'Опрос здоровья',
      desc: lang === 'en'
        ? 'Lifestyle, goals, injuries and nutrition habits review'
        : 'Обзор образа жизни, целей, травм и привычек питания',
    },
    {
      icon: <Stethoscope className="w-5 h-5 text-primary" />,
      title: lang === 'en' ? 'Personal plan' : 'Персональный план',
      desc: lang === 'en'
        ? 'Preparation plan for your main training sessions'
        : 'Подготовка к основным тренировкам',
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto border border-border/50 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 bg-card/95 backdrop-blur-md z-10 px-5 pt-5 pb-3 border-b border-border/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {step === 'payment' && (
                  <button onClick={() => setStep('info')} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <h2 className="text-lg font-bold">
                  {lang === 'en' ? 'Consultation' : 'Консультация'}
                </h2>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-1 mt-3">
              {['info', 'payment'].map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    ['info', 'payment'].indexOf(step) >= i ? 'bg-primary' : 'bg-secondary'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="p-5 flex-1">
            {step === 'info' && (
              <div>
                {/* Price badge */}
                <div className="flex items-center justify-center mb-6">
                  <div className="gradient-primary text-primary-foreground font-extrabold text-2xl py-3 px-8 rounded-2xl shadow-lg">
                    50€
                  </div>
                </div>

                <p className="text-sm text-muted-foreground text-center mb-6">
                  {lang === 'en'
                    ? 'A comprehensive introductory session before you start your training journey'
                    : 'Вводная сессия перед началом вашего тренировочного пути'}
                </p>

                {/* Features */}
                <div className="space-y-3 mb-8">
                  {features.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 bg-secondary/50 rounded-xl p-3">
                      <div className="shrink-0 mt-0.5">{f.icon}</div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{f.title}</p>
                        <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setStep('payment')}
                  className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-2xl text-base glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98]"
                >
                  {lang === 'en' ? 'Continue to payment' : 'Перейти к оплате'}
                </button>
              </div>
            )}

            {step === 'payment' && (
              <div>
                <div className="flex flex-col items-center mb-6">
                  <CreditCard className="w-10 h-10 text-primary mb-3" />
                  <p className="text-sm text-muted-foreground text-center">
                    {lang === 'en'
                      ? 'Pay €50 via Revolut to confirm your consultation booking'
                      : 'Оплатите 50€ через Revolut для подтверждения записи'}
                  </p>
                </div>

                {/* Revolut button */}
                <button
                  onClick={handlePayClick}
                  className="w-full bg-[#0075EB] hover:bg-[#0066d1] text-white font-bold py-3.5 rounded-2xl text-base flex items-center justify-center gap-2 transition-colors mb-4"
                >
                  <ExternalLink className="w-4 h-4" />
                  {lang === 'en' ? 'Pay €50 via Revolut' : 'Оплатить 50€ через Revolut'}
                </button>

                {paymentOpened && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <button
                      onClick={handlePaid}
                      className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-2xl text-base glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      {lang === 'en' ? "I've paid — continue" : 'Я оплатил — продолжить'}
                    </button>
                    <p className="text-[11px] text-muted-foreground text-center mt-3">
                      {lang === 'en'
                        ? 'Next: create an account and pick your time slot'
                        : 'Далее: создание аккаунта и выбор времени'}
                    </p>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConsultationModal;
