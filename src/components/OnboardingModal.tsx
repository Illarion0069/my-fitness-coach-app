import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, CalendarDays, ClipboardCheck, CheckCircle, ChevronRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onOpenBooking: () => void;
  onNavigateToTest: () => void;
}

const ONBOARDING_DONE_KEY = 'onboarding_completed';

const OnboardingModal = ({ open, onClose, onOpenBooking, onNavigateToTest }: OnboardingModalProps) => {
  const { user, profile, refreshProfile } = useAuth();
  const { lang } = useLanguage();
  const [step, setStep] = useState(0); // 0=telegram, 1=booking, 2=test
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [bookingDone, setBookingDone] = useState(false);

  const t = (en: string, ru: string) => (lang === 'en' ? en : ru);

  // Poll for Telegram connection
  useEffect(() => {
    if (!open || step !== 0 || !user) return;

    // Show skip button after 30 seconds
    const skipTimer = setTimeout(() => setShowSkip(true), 30000);

    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.telegram_chat_id) {
        setTelegramConnected(true);
        clearInterval(poll);
        // Auto-advance after brief celebration
        setTimeout(() => setStep(1), 1500);
      }
    }, 3000);

    return () => {
      clearInterval(poll);
      clearTimeout(skipTimer);
    };
  }, [open, step, user]);

  // Listen for booking completion
  useEffect(() => {
    if (!open || step !== 1 || !user) return;

    const channel = supabase
      .channel('onboarding-sessions')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'scheduled_sessions',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        setBookingDone(true);
        setTimeout(() => setStep(2), 1500);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [open, step, user]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    onClose();
  }, [onClose]);

  if (!open || !user) return null;

  const steps = [
    {
      icon: Bot,
      title: t('Connect Telegram', 'Подключи Telegram'),
      desc: t(
        'Get instant notifications about your training schedule, reminders and updates.',
        'Получай мгновенные уведомления о расписании тренировок, напоминания и обновления.'
      ),
      color: 'text-blue-400',
      bg: 'bg-blue-500/15',
    },
    {
      icon: CalendarDays,
      title: t('Book Your First Session', 'Забронируй первую тренировку'),
      desc: t(
        'Choose a convenient time and date for your first personal training session.',
        'Выбери удобное время и дату для первой персональной тренировки.'
      ),
      color: 'text-primary',
      bg: 'bg-primary/15',
    },
    {
      icon: ClipboardCheck,
      title: t('Take a Health Test', 'Пройди тест здоровья'),
      desc: t(
        'A quick assessment helps me create the perfect program for your goals and health.',
        'Быстрая оценка поможет мне составить идеальную программу под твои цели и здоровье.'
      ),
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15',
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-background flex flex-col"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 20px), 20px)', paddingBottom: 'max(env(safe-area-inset-bottom, 20px), 20px)' }}
        >
          {/* Progress bar */}
          <div className="px-6 pt-2 pb-4">
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-border/30">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: i < step ? '100%' : i === step ? '50%' : '0%' }}
                    transition={{ duration: 0.5 }}
                    className="h-full rounded-full gradient-primary"
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2 uppercase tracking-wider font-bold">
              {t(`Step ${step + 1} of 3`, `Шаг ${step + 1} из 3`)}
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col items-center justify-center px-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-sm text-center"
              >
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className={`w-24 h-24 rounded-3xl ${currentStep.bg} flex items-center justify-center mx-auto mb-8`}
                >
                  {(step === 0 && telegramConnected) || (step === 1 && bookingDone) ? (
                    <CheckCircle className="w-12 h-12 text-emerald-400" />
                  ) : (
                    <Icon className={`w-12 h-12 ${currentStep.color}`} />
                  )}
                </motion.div>

                {/* Welcome greeting on first step */}
                {step === 0 && profile?.full_name && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-primary font-bold mb-2"
                  >
                    {t(`Welcome, ${profile.full_name.split(' ')[0]}! 👋`, `Добро пожаловать, ${profile.full_name.split(' ')[0]}! 👋`)}
                  </motion.p>
                )}

                <h2 className="text-2xl font-extrabold font-heading uppercase tracking-tight mb-3">
                  {currentStep.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-8">
                  {currentStep.desc}
                </p>

                {/* Step-specific actions */}
                {step === 0 && (
                  <div className="space-y-3">
                    {telegramConnected ? (
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4"
                      >
                        <p className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          {t('Telegram connected!', 'Telegram подключён!')}
                        </p>
                      </motion.div>
                    ) : (
                      <>
                        <a
                          href={`https://t.me/LimassolFitness_bot?start=${profile?.telegram_link_code || ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl flex items-center justify-center gap-3 text-base hover:scale-[1.01] active:scale-[0.99] transition-all"
                        >
                          <Bot className="w-5 h-5" />
                          {t('Open Telegram Bot', 'Открыть Telegram-бот')}
                        </a>
                        <p className="text-[11px] text-muted-foreground">
                          {t('Press START in the bot — we\'ll detect it automatically', 'Нажмите START в боте — мы определим это автоматически')}
                        </p>
                        {showSkip && (
                          <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={() => setStep(1)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {t('Skip for now →', 'Пропустить →')}
                          </motion.button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-3">
                    {bookingDone ? (
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4"
                      >
                        <p className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          {t('Session booked!', 'Тренировка забронирована!')}
                        </p>
                      </motion.div>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenBooking();
                          }}
                          className="w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl flex items-center justify-center gap-3 text-base hover:scale-[1.01] active:scale-[0.99] transition-all"
                        >
                          <CalendarDays className="w-5 h-5" />
                          {t('Book a Session', 'Забронировать тренировку')}
                        </button>
                        <button
                          onClick={() => setStep(2)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {t('Skip for now →', 'Пропустить →')}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleComplete();
                        onNavigateToTest();
                      }}
                      className="w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl flex items-center justify-center gap-3 text-base hover:scale-[1.01] active:scale-[0.99] transition-all"
                    >
                      <ClipboardCheck className="w-5 h-5" />
                      {t('Take the Test', 'Пройти тест')}
                    </button>
                    <button
                      onClick={handleComplete}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t('Maybe later →', 'Может позже →')}
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom decoration */}
          <div className="px-8 pb-4 text-center">
            <p className="text-[10px] text-muted-foreground/50 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" />
              {t('Your fitness journey starts here', 'Ваш путь к фитнесу начинается здесь')}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};

export default OnboardingModal;
