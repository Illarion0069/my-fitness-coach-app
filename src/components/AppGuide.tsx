import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserRound, ClipboardCheck, Home, CreditCard, User, ChevronRight, X, Dumbbell, CalendarDays } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import trainerLogo from '@/assets/trainer-logo.png';
import trainerPhoto from '@/assets/trainer-photo.jpg';

interface AppGuideProps {
  onComplete: () => void;
}

/* ——— Slide 1: Mini-mockup of hero screen with "Sign In" button highlighted ——— */
const MockupSignIn = ({ lang }: { lang: string }) => (
  <div className="relative w-64 h-[420px] rounded-3xl border-2 border-border/60 bg-background overflow-hidden shadow-2xl mx-auto">
    {/* Status bar */}
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <span className="text-[8px] font-bold text-foreground/60">Limassol Fitness</span>
      <div className="flex items-center gap-1.5">
        <span className="text-[7px] font-bold text-muted-foreground/50 border border-border/40 rounded px-1 py-0.5">RU</span>
        {/* Highlighted Sign In button */}
        <motion.div
          className="relative"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="absolute -inset-2 rounded-xl border-2 border-primary animate-pulse" />
          <div className="absolute -inset-3 rounded-xl bg-primary/10 animate-pulse" />
          <div className="flex items-center gap-1 gradient-primary text-primary-foreground text-[7px] font-bold py-1 px-2 rounded-lg">
            <UserRound className="w-2.5 h-2.5" />
            {lang === 'en' ? 'Sign In' : 'Войти'}
          </div>
        </motion.div>
      </div>
    </div>
    {/* Trainer photo */}
    <div className="flex justify-center mt-4">
      <div className="w-20 h-20 rounded-full p-0.5 bg-gradient-to-b from-primary/40 to-transparent">
        <img src={trainerPhoto} alt="" className="w-full h-full rounded-full object-cover border-2 border-card" style={{ objectPosition: '60% center' }} />
      </div>
    </div>
    {/* Title lines */}
    <div className="text-center mt-3 px-4">
      <div className="h-2 w-24 mx-auto rounded bg-primary/40 mb-1.5" />
      <div className="h-2 w-20 mx-auto rounded bg-foreground/20 mb-1.5" />
      <div className="h-2 w-16 mx-auto rounded bg-primary/40" />
    </div>
    {/* CTA placeholder */}
    <div className="flex justify-center mt-4">
      <div className="h-6 w-28 rounded-xl gradient-primary opacity-40" />
    </div>
    {/* Workout cards placeholder */}
    <div className="grid grid-cols-2 gap-1.5 px-4 mt-4">
      {[0,1,2,3].map(i => (
        <div key={i} className="h-12 rounded-lg bg-card border border-border/30" />
      ))}
    </div>
    {/* Bottom nav */}
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around h-10 bg-background/95 border-t border-border/40">
      {[Home, ClipboardCheck, CreditCard, User].map((Icon, i) => (
        <div key={i} className={`flex flex-col items-center gap-0.5 ${i === 0 ? 'text-primary' : 'text-muted-foreground/40'}`}>
          <Icon className="w-3 h-3" />
          <div className="h-1 w-4 rounded bg-current opacity-30" />
        </div>
      ))}
    </div>
    {/* Arrow pointing to button */}
    <motion.div
      className="absolute top-11 right-16 text-primary"
      animate={{ y: [-2, 2, -2], x: [0, 2, 0] }}
      transition={{ duration: 1.2, repeat: Infinity }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 20 L16 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 4 L16 4 L16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.div>
  </div>
);

/* ——— Slide 2: Mockup highlighting the Test tab in bottom nav ——— */
const MockupTest = ({ lang }: { lang: string }) => (
  <div className="relative w-64 h-[420px] rounded-3xl border-2 border-border/60 bg-background overflow-hidden shadow-2xl mx-auto">
    {/* Header */}
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <span className="text-[8px] font-bold text-foreground/60">Limassol Fitness</span>
      <div className="flex items-center gap-1 gradient-primary text-primary-foreground text-[7px] font-bold py-1 px-2 rounded-lg opacity-60">
        <UserRound className="w-2.5 h-2.5" />
        {lang === 'en' ? 'Sign In' : 'Войти'}
      </div>
    </div>
    {/* Test content mockup */}
    <div className="px-5 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardCheck className="w-5 h-5 text-emerald-500" />
        <span className="text-xs font-bold text-foreground">{lang === 'en' ? 'Fitness Test' : 'Фитнес-тест'}</span>
      </div>
      <div className="space-y-2.5">
        {[0,1,2].map(i => (
          <div key={i} className="bg-card rounded-xl p-3 border border-border/30">
            <div className="h-2 w-32 rounded bg-foreground/15 mb-2" />
            <div className="flex gap-1.5">
              {[0,1,2,3].map(j => (
                <div key={j} className="h-5 flex-1 rounded-lg bg-secondary/60 border border-border/20" />
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Progress bar */}
      <div className="mt-4 h-1.5 w-full rounded-full bg-secondary">
        <div className="h-full w-1/3 rounded-full bg-emerald-500/60" />
      </div>
    </div>
    {/* Bottom nav with Test highlighted */}
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around h-10 bg-background/95 border-t border-border/40">
      {[
        { Icon: Home, label: lang === 'en' ? 'Home' : 'Главная', active: false },
        { Icon: ClipboardCheck, label: lang === 'en' ? 'Test' : 'Тест', active: true },
        { Icon: CreditCard, label: lang === 'en' ? 'Pricing' : 'Тарифы', active: false },
        { Icon: User, label: lang === 'en' ? 'About' : 'Обо мне', active: false },
      ].map((item, i) => (
        <div key={i} className="relative flex flex-col items-center gap-0.5">
          {item.active && (
            <>
              <motion.div
                className="absolute -inset-2 rounded-xl border-2 border-emerald-500"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div
                className="absolute -inset-3 rounded-xl bg-emerald-500/10"
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </>
          )}
          <item.Icon className={`w-3 h-3 ${item.active ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
          <span className={`text-[6px] font-semibold ${item.active ? 'text-emerald-500' : 'text-muted-foreground/40'}`}>{item.label}</span>
        </div>
      ))}
    </div>
  </div>
);

/* ——— Slide 3: Mockup highlighting Book Session CTA ——— */
const MockupBook = ({ lang }: { lang: string }) => (
  <div className="relative w-64 h-[420px] rounded-3xl border-2 border-border/60 bg-background overflow-hidden shadow-2xl mx-auto">
    {/* Header */}
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <span className="text-[8px] font-bold text-foreground/60">Limassol Fitness</span>
      <div className="w-6 h-6 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-[7px] font-bold opacity-60">
        ИФ
      </div>
    </div>
    {/* Trainer photo */}
    <div className="flex justify-center mt-3">
      <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-b from-primary/40 to-transparent">
        <img src={trainerPhoto} alt="" className="w-full h-full rounded-full object-cover border-2 border-card" style={{ objectPosition: '60% center' }} />
      </div>
    </div>
    {/* Title */}
    <div className="text-center mt-2 px-4">
      <div className="h-2 w-24 mx-auto rounded bg-primary/30 mb-1" />
      <div className="h-2 w-18 mx-auto rounded bg-foreground/15" />
    </div>
    {/* CTA highlighted */}
    <div className="flex justify-center mt-4">
      <motion.div
        className="relative"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="absolute -inset-2.5 rounded-2xl border-2 border-blue-500"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <motion.div
          className="absolute -inset-4 rounded-2xl bg-blue-500/10"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <div className="flex items-center gap-1.5 gradient-primary text-primary-foreground text-[9px] font-bold py-2 px-5 rounded-xl glow-primary">
          <CalendarDays className="w-3 h-3" />
          {lang === 'en' ? 'Book a Session' : 'Записаться'}
        </div>
      </motion.div>
    </div>
    {/* Arrow */}
    <motion.div
      className="flex justify-center mt-2 text-blue-400"
      animate={{ y: [-3, 3, -3] }}
      transition={{ duration: 1, repeat: Infinity }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2 L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M6 10 L10 14 L14 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.div>
    {/* Workout cards placeholder */}
    <div className="grid grid-cols-2 gap-1.5 px-4 mt-3">
      {[0,1,2,3].map(i => (
        <div key={i} className="h-10 rounded-lg bg-card border border-border/30" />
      ))}
    </div>
    {/* Bottom nav */}
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around h-10 bg-background/95 border-t border-border/40">
      {[Home, ClipboardCheck, CreditCard, User].map((Icon, i) => (
        <div key={i} className={`flex flex-col items-center gap-0.5 ${i === 0 ? 'text-primary' : 'text-muted-foreground/40'}`}>
          <Icon className="w-3 h-3" />
          <div className="h-1 w-4 rounded bg-current opacity-30" />
        </div>
      ))}
    </div>
  </div>
);

const slides = [
  {
    Mockup: MockupSignIn,
    title: { en: 'Create your account', ru: 'Создайте аккаунт' },
    description: {
      en: 'Tap the "Sign In" button in the top-right corner to register',
      ru: 'Нажмите кнопку «Войти» в правом верхнем углу для регистрации',
    },
  },
  {
    Mockup: MockupTest,
    title: { en: 'Take a fitness test', ru: 'Пройдите фитнес-тест' },
    description: {
      en: 'Open the "Test" tab to check your fitness level',
      ru: 'Откройте вкладку «Тест» для оценки уровня подготовки',
    },
  },
  {
    Mockup: MockupBook,
    title: { en: 'Book your first session', ru: 'Запишитесь на тренировку' },
    description: {
      en: 'Tap "Book a Session" to schedule your first workout',
      ru: 'Нажмите «Записаться» для бронирования первой тренировки',
    },
  },
];

const AppGuide = ({ onComplete }: AppGuideProps) => {
  const { t, lang } = useLanguage();
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);

  const next = () => {
    if (current < slides.length - 1) setCurrent(current + 1);
    else onComplete();
  };

  const prev = () => {
    if (current > 0) setCurrent(current - 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 60) {
      if (delta < 0) next();
      else prev();
    }
  };

  const slide = slides[current];
  const SlideColors = ['hsl(8 85% 58%)', 'hsl(142 71% 45%)', 'hsl(217 91% 60%)'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-background flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip */}
      <div className="flex justify-end px-4 pt-3" style={{ paddingTop: 'max(env(safe-area-inset-top, 12px), 12px)' }}>
        <button onClick={onComplete} className="text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1 transition-colors">
          {t({ en: 'Skip', ru: 'Пропустить' })}
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -80 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex flex-col items-center"
          >
            {/* Phone mockup */}
            <slide.Mockup lang={lang} />

            {/* Text below mockup */}
            <div className="mt-6 text-center max-w-xs">
              <span className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: SlideColors[current] }}>
                {t({ en: `Step ${current + 1} of ${slides.length}`, ru: `Шаг ${current + 1} из ${slides.length}` })}
              </span>
              <h2 className="text-xl font-extrabold text-foreground mb-1.5 font-heading tracking-wide">
                {t(slide.title)}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t(slide.description)}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom: dots + button */}
      <div className="flex flex-col items-center gap-5 pb-8" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 32px), 32px)' }}>
        {/* Dots */}
        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}>
              <div
                className={`rounded-full transition-all duration-300 ${i === current ? 'w-7 h-2' : 'w-2 h-2 bg-muted-foreground/30'}`}
                style={i === current ? { backgroundColor: SlideColors[i] } : undefined}
              />
            </button>
          ))}
        </div>

        <motion.button
          onClick={next}
          className="flex items-center gap-2 gradient-primary text-primary-foreground font-bold py-3 px-8 rounded-2xl glow-primary text-sm"
          whileTap={{ scale: 0.97 }}
        >
          {current === slides.length - 1
            ? t({ en: 'Get Started', ru: 'Начать' })
            : t({ en: 'Next', ru: 'Далее' })}
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  );
};

export default AppGuide;
