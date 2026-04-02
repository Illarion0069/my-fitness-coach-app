import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserRound, Home, CreditCard, User, ChevronRight, X, CalendarDays, Bell, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import trainerPhoto from '@/assets/trainer-photo.jpg';

interface AppGuideProps {
  onComplete: () => void;
}

const BottomNav = ({ activeIndex, lang }: { activeIndex: number; lang: string }) => {
  const items = [
    { Icon: Home, label: lang === 'en' ? 'Home' : 'Главная' },
    { Icon: CreditCard, label: lang === 'en' ? 'Pricing' : 'Тарифы' },
    { Icon: User, label: lang === 'en' ? 'About' : 'Обо мне' },
  ];
  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around h-10 bg-background/95 border-t border-border/40">
      {items.map((item, i) => (
        <div key={i} className={`flex flex-col items-center gap-0.5 ${i === activeIndex ? 'text-primary' : 'text-muted-foreground/40'}`}>
          <item.Icon className="w-3 h-3" />
          <span className="text-[6px] font-semibold">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

/* ——— Slide 1: Book a Session (no registration needed!) ——— */
const MockupBook = ({ lang }: { lang: string }) => (
  <div className="relative w-64 h-[420px] rounded-3xl border-2 border-border/60 bg-background overflow-hidden shadow-2xl mx-auto">
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <span className="text-[8px] font-bold text-foreground/60">Limassol Fitness</span>
      <div className="flex items-center gap-1 text-muted-foreground/40 text-[7px] font-bold py-1 px-2 rounded-lg border border-border/30">
        <UserRound className="w-2.5 h-2.5" />
        {lang === 'en' ? 'Sign In' : 'Войти'}
      </div>
    </div>
    {/* Trainer photo */}
    <div className="flex justify-center mt-3">
      <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-b from-primary/40 to-transparent">
        <img src={trainerPhoto} alt="" className="w-full h-full rounded-full object-cover border-2 border-card" style={{ objectPosition: '60% center' }} />
      </div>
    </div>
    <div className="text-center mt-2 px-4">
      <div className="h-2 w-24 mx-auto rounded bg-primary/30 mb-1.5" />
      <div className="h-1.5 w-36 mx-auto rounded bg-foreground/10" />
    </div>
    {/* CTA highlighted */}
    <div className="flex justify-center mt-4">
      <motion.div
        className="relative"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="absolute -inset-2.5 rounded-2xl border-2 border-primary"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <motion.div
          className="absolute -inset-4 rounded-2xl bg-primary/10"
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
      className="flex justify-center mt-2 text-primary"
      animate={{ y: [-3, 3, -3] }}
      transition={{ duration: 1, repeat: Infinity }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2 L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M6 10 L10 14 L14 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.div>
    {/* Cards */}
    <div className="grid grid-cols-2 gap-1.5 px-4 mt-3">
      {[0,1,2,3].map(i => (
        <div key={i} className="h-10 rounded-lg bg-card border border-border/30" />
      ))}
    </div>
    {/* No-registration badge */}
    <div className="flex justify-center mt-3">
      <div className="text-[7px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
        {lang === 'en' ? '✓ No registration required' : '✓ Без регистрации'}
      </div>
    </div>
    <BottomNav activeIndex={0} lang={lang} />
  </div>
);

/* ——— Slide 2: Create Account for full features ——— */
const MockupSignUp = ({ lang }: { lang: string }) => (
  <div className="relative w-64 h-[420px] rounded-3xl border-2 border-border/60 bg-background overflow-hidden shadow-2xl mx-auto">
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <span className="text-[8px] font-bold text-foreground/60">Limassol Fitness</span>
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
    {/* Arrow pointing to sign in */}
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
    {/* Benefits list */}
    <div className="px-5 mt-10">
      <div className="space-y-3">
        {[
          { Icon: CalendarDays, text: lang === 'en' ? 'Track your schedule' : 'Отслеживай расписание', color: 'text-primary' },
          { Icon: Bell, text: lang === 'en' ? 'Get reminders via Telegram' : 'Напоминания в Telegram', color: 'text-blue-400' },
          { Icon: TrendingUp, text: lang === 'en' ? 'Monitor your progress' : 'Следи за прогрессом', color: 'text-emerald-400' },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.2, duration: 0.4 }}
            className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border/30"
          >
            <div className={`w-7 h-7 rounded-lg bg-card flex items-center justify-center border border-border/30 ${item.color}`}>
              <item.Icon className="w-3.5 h-3.5" />
            </div>
            <span className="text-[9px] font-semibold text-foreground">{item.text}</span>
          </motion.div>
        ))}
      </div>
    </div>
    {/* Trainer photo small */}
    <div className="flex justify-center mt-6">
      <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-b from-primary/40 to-transparent">
        <img src={trainerPhoto} alt="" className="w-full h-full rounded-full object-cover border-2 border-card" style={{ objectPosition: '60% center' }} />
      </div>
    </div>
    <BottomNav activeIndex={-1} lang={lang} />
  </div>
);

/* ——— Slide 3: Check pricing ——— */
const MockupPricing = ({ lang }: { lang: string }) => (
  <div className="relative w-64 h-[420px] rounded-3xl border-2 border-border/60 bg-background overflow-hidden shadow-2xl mx-auto">
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <span className="text-[8px] font-bold text-foreground/60">Limassol Fitness</span>
      <div className="w-6 h-6 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-[7px] font-bold opacity-60">
        ИФ
      </div>
    </div>
    {/* Pricing cards */}
    <div className="px-4 mt-4 space-y-2.5">
      {[
        { name: '8', sessions: '8', popular: false },
        { name: '12', sessions: '12', popular: true },
        { name: '16', sessions: '16', popular: false },
      ].map((pkg, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.15 }}
          className={`rounded-xl p-3 border ${pkg.popular ? 'border-primary/50 bg-primary/5' : 'border-border/30 bg-card'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-foreground">{pkg.sessions} {lang === 'en' ? 'sessions' : 'тренировок'}</span>
                {pkg.popular && (
                  <span className="text-[6px] font-bold text-primary bg-primary/10 rounded px-1 py-0.5">
                    {lang === 'en' ? 'POPULAR' : 'ПОПУЛЯРНЫЙ'}
                  </span>
                )}
              </div>
              <div className="h-1.5 w-16 rounded bg-foreground/10 mt-1" />
            </div>
            <div className="h-2 w-10 rounded bg-primary/30" />
          </div>
        </motion.div>
      ))}
    </div>
    {/* Pricing tab highlight */}
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around h-10 bg-background/95 border-t border-border/40">
      {[
        { Icon: Home, label: lang === 'en' ? 'Home' : 'Главная', active: false },
        { Icon: CreditCard, label: lang === 'en' ? 'Pricing' : 'Тарифы', active: true },
        { Icon: User, label: lang === 'en' ? 'About' : 'Обо мне', active: false },
      ].map((item, i) => (
        <div key={i} className="relative flex flex-col items-center gap-0.5">
          {item.active && (
            <>
              <motion.div
                className="absolute -inset-2 rounded-xl border-2 border-primary"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div
                className="absolute -inset-3 rounded-xl bg-primary/10"
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </>
          )}
          <item.Icon className={`w-3 h-3 ${item.active ? 'text-primary' : 'text-muted-foreground/40'}`} />
          <span className={`text-[6px] font-semibold ${item.active ? 'text-primary' : 'text-muted-foreground/40'}`}>{item.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const slides = [
  {
    Mockup: MockupBook,
    title: { en: 'Book your first session', ru: 'Запишись на тренировку' },
    description: {
      en: 'Just enter your name and phone — no registration needed',
      ru: 'Просто укажи имя и телефон — регистрация не нужна',
    },
  },
  {
    Mockup: MockupSignUp,
    title: { en: 'Create an account', ru: 'Создай аккаунт' },
    description: {
      en: 'Sign up to track progress, get reminders and manage your schedule',
      ru: 'Зарегистрируйся, чтобы отслеживать прогресс, получать напоминания и управлять расписанием',
    },
  },
  {
    Mockup: MockupPricing,
    title: { en: 'Check pricing plans', ru: 'Узнай тарифы' },
    description: {
      en: 'Choose a package that fits your goals and budget',
      ru: 'Выбери пакет, подходящий под твои цели и бюджет',
    },
  },
];

const SlideColors = ['hsl(var(--primary))', 'hsl(217 91% 60%)', 'hsl(var(--primary))'];

const AppGuide = ({ onComplete }: { onComplete: () => void }) => {
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

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 60) { delta < 0 ? next() : prev(); }
  };

  const slide = slides[current];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-background flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex justify-end px-4 pt-3" style={{ paddingTop: 'max(env(safe-area-inset-top, 12px), 12px)' }}>
        <button onClick={onComplete} className="text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1 transition-colors">
          {t({ en: 'Skip', ru: 'Пропустить' })}
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

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
            <slide.Mockup lang={lang} />
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

      <div className="flex flex-col items-center gap-5 pb-8" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 32px), 32px)' }}>
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
