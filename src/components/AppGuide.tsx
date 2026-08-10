import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserRound, Home, CreditCard, User, ChevronRight, X, CalendarDays, Bell,
  TrendingUp, Camera, Ruler, Trophy, History, Plus, Globe, ChevronLeft, Flame,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import trainerPhoto from '@/assets/trainer-photo.jpg';

interface AppGuideProps {
  onComplete: () => void;
}

const Phone = ({ children }: { children: React.ReactNode }) => (
  <div className="relative w-64 h-[420px] rounded-3xl border-2 border-border/60 bg-background overflow-hidden shadow-2xl mx-auto">
    {children}
  </div>
);

const PhoneHeader = ({ lang, showAvatar }: { lang: string; showAvatar?: boolean }) => (
  <div className="flex items-center justify-between px-4 pt-3 pb-1">
    <span className="text-[8px] font-bold text-foreground/60">Limassol Fitness</span>
    {showAvatar ? (
      <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-[7px] font-bold">
        IF
      </div>
    ) : (
      <div className="flex items-center gap-1 text-muted-foreground/40 text-[7px] font-bold py-1 px-2 rounded-lg border border-border/30">
        <UserRound className="w-2.5 h-2.5" />
        {lang === 'en' ? 'Sign In' : 'Войти'}
      </div>
    )}
  </div>
);

const BottomNav = ({ activeIndex, lang, highlight }: { activeIndex: number; lang: string; highlight?: boolean }) => {
  const items = [
    { Icon: Home, label: lang === 'en' ? 'Home' : 'Главная' },
    { Icon: CreditCard, label: lang === 'en' ? 'Pricing' : 'Тарифы' },
    { Icon: User, label: lang === 'en' ? 'About' : 'Обо мне' },
  ];
  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around h-10 bg-background/95 border-t border-border/40">
      {items.map((item, i) => {
        const active = i === activeIndex;
        return (
          <div key={i} className={`relative flex flex-col items-center gap-0.5 ${active ? 'text-primary' : 'text-muted-foreground/40'}`}>
            {active && highlight && (
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
            <item.Icon className="w-3 h-3" />
            <span className="text-[6px] font-semibold">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const Pulse = ({ children }: { children: React.ReactNode }) => (
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
    {children}
  </motion.div>
);

const DownArrow = () => (
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
);

/* ——— 1. Book a session ——— */
const MockupBook = ({ lang }: { lang: string }) => (
  <Phone>
    <PhoneHeader lang={lang} />
    <div className="flex justify-center mt-3">
      <motion.div
        className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-b from-primary/40 to-transparent"
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      >
        <img src={trainerPhoto} alt="" className="w-full h-full rounded-full object-cover border-2 border-card" style={{ objectPosition: '60% center' }} />
      </motion.div>
    </div>
    <div className="text-center mt-2 px-4">
      <div className="h-2 w-24 mx-auto rounded bg-primary/30 mb-1.5" />
      <div className="h-1.5 w-36 mx-auto rounded bg-foreground/10" />
    </div>
    <div className="flex justify-center mt-4">
      <Pulse>
        <div className="flex items-center gap-1.5 gradient-primary text-primary-foreground text-[9px] font-bold py-2 px-5 rounded-xl glow-primary">
          <CalendarDays className="w-3 h-3" />
          {lang === 'en' ? 'Book a Session' : 'Записаться'}
        </div>
      </Pulse>
    </div>
    <DownArrow />
    <div className="grid grid-cols-2 gap-1.5 px-4 mt-3">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-10 rounded-lg bg-card border border-border/30" />
      ))}
    </div>
    <div className="flex justify-center mt-3">
      <div className="text-[7px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
        {lang === 'en' ? '✓ No registration required' : '✓ Без регистрации'}
      </div>
    </div>
    <BottomNav activeIndex={0} lang={lang} />
  </Phone>
);

/* ——— 2. Your account: balance card + history ——— */
const MockupAccount = ({ lang }: { lang: string }) => (
  <Phone>
    <PhoneHeader lang={lang} showAvatar />
    {/* Balance card */}
    <div className="px-4 mt-4">
      <Pulse>
        <div className="rounded-2xl bg-card border border-primary/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-semibold text-muted-foreground">
              {lang === 'en' ? 'Sessions left' : 'Осталось занятий'}
            </span>
            <span className="text-[7px] text-primary font-bold">
              {lang === 'en' ? 'History' : 'История'}
            </span>
          </div>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-extrabold text-foreground leading-none">7</span>
            <span className="text-[9px] text-muted-foreground mb-0.5">/ 10</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/40 mt-2 overflow-hidden">
            <motion.div
              className="h-full gradient-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: '70%' }}
              transition={{ duration: 1 }}
            />
          </div>
        </div>
      </Pulse>
    </div>
    <div className="px-4 mt-6 space-y-2">
      {[
        { Icon: CalendarDays, text: lang === 'en' ? 'Next session: Mon 18:00' : 'Ближайшая: Пн 18:00', color: 'text-primary' },
        { Icon: Bell, text: lang === 'en' ? 'Telegram reminders' : 'Напоминания в Telegram', color: 'text-blue-400' },
        { Icon: History, text: lang === 'en' ? 'Full session history' : 'История списаний', color: 'text-emerald-400' },
      ].map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.15, duration: 0.4 }}
          className="flex items-center gap-2.5 bg-card rounded-xl p-2.5 border border-border/30"
        >
          <div className={`w-6 h-6 rounded-lg bg-background flex items-center justify-center border border-border/30 ${item.color}`}>
            <item.Icon className="w-3 h-3" />
          </div>
          <span className="text-[8.5px] font-semibold text-foreground">{item.text}</span>
        </motion.div>
      ))}
    </div>
    <BottomNav activeIndex={0} lang={lang} />
  </Phone>
);

/* ——— 3. Nutrition diary ——— */
const Ring = ({ value, color, label, sub }: { value: number; color: string; label: string; sub: string }) => {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" opacity="0.4" />
        <motion.circle
          cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value) }}
          transition={{ duration: 1, ease: 'easeOut' }}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span className="text-[7px] font-bold text-foreground">{label}</span>
      <span className="text-[6px] text-muted-foreground">{sub}</span>
    </div>
  );
};

const MockupNutrition = ({ lang }: { lang: string }) => (
  <Phone>
    <PhoneHeader lang={lang} showAvatar />
    <div className="px-4 mt-3">
      <div className="rounded-2xl bg-card border border-border/40 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[8px] font-bold text-foreground">
            {lang === 'en' ? 'Today' : 'Сегодня'}
          </span>
          <span className="text-[7px] font-bold text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">A</span>
        </div>
        <div className="flex items-center justify-center gap-1 mb-2">
          <Flame className="w-3 h-3 text-primary" />
          <span className="text-lg font-extrabold text-foreground leading-none">1 840</span>
          <span className="text-[7px] text-muted-foreground mb-0.5">/ 2 100 kcal</span>
        </div>
        <div className="flex justify-around">
          <Ring value={0.8} color="hsl(var(--primary))" label={lang === 'en' ? 'Prot' : 'Белки'} sub="120g" />
          <Ring value={0.6} color="hsl(217 91% 60%)" label={lang === 'en' ? 'Carb' : 'Углев'} sub="180g" />
          <Ring value={0.5} color="hsl(160 84% 39%)" label={lang === 'en' ? 'Fat' : 'Жиры'} sub="55g" />
        </div>
      </div>
    </div>
    <div className="flex justify-center mt-5">
      <Pulse>
        <div className="flex items-center gap-1.5 gradient-primary text-primary-foreground text-[9px] font-bold py-2 px-5 rounded-xl glow-primary">
          <Camera className="w-3 h-3" />
          {lang === 'en' ? 'Photo of your meal' : 'Фото еды'}
        </div>
      </Pulse>
    </div>
    <DownArrow />
    <div className="px-4 mt-2">
      <div className="rounded-xl bg-card border border-border/30 p-2.5">
        <div className="text-[7.5px] font-bold text-foreground mb-1">
          {lang === 'en' ? 'Recommendations' : 'Рекомендации'}
        </div>
        <div className="h-1.5 w-full rounded bg-foreground/10 mb-1" />
        <div className="h-1.5 w-3/4 rounded bg-foreground/10" />
      </div>
    </div>
    <BottomNav activeIndex={0} lang={lang} />
  </Phone>
);

/* ——— 4. Progress: measurements + achievements ——— */
const MockupProgress = ({ lang }: { lang: string }) => (
  <Phone>
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <span className="text-[8px] font-bold text-foreground/60">Limassol Fitness</span>
      <motion.div className="relative" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
        <div className="absolute -inset-1.5 rounded-full border-2 border-amber-400/70 animate-pulse" />
        <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center text-primary-foreground">
          <Trophy className="w-3 h-3" />
        </div>
      </motion.div>
    </div>
    <div className="px-4 mt-4">
      <div className="rounded-2xl bg-card border border-border/40 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Ruler className="w-3 h-3 text-primary" />
          <span className="text-[8px] font-bold text-foreground">
            {lang === 'en' ? 'Weight & measurements' : 'Вес и замеры'}
          </span>
        </div>
        <svg viewBox="0 0 200 60" className="w-full h-14">
          <motion.polyline
            points="0,50 30,44 60,46 90,36 120,30 150,24 180,18 200,14"
            fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }}
          />
        </svg>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[7px] text-muted-foreground">82.4 kg</span>
          <span className="text-[7px] font-bold text-emerald-400">−4.1 kg</span>
        </div>
      </div>
    </div>
    <div className="px-4 mt-3 grid grid-cols-3 gap-2">
      {[Trophy, TrendingUp, Flame].map((Icon, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + i * 0.15 }}
          className="rounded-xl bg-card border border-border/30 p-2 flex flex-col items-center gap-1"
        >
          <Icon className="w-3.5 h-3.5 text-amber-400" />
          <div className="h-1 w-8 rounded bg-foreground/10" />
        </motion.div>
      ))}
    </div>
    <div className="flex justify-center mt-4 px-4">
      <div className="text-[7px] text-center text-muted-foreground leading-relaxed">
        {lang === 'en'
          ? 'Tap the badge on your avatar to open achievements'
          : 'Нажми на значок у аватара — откроются достижения'}
      </div>
    </div>
    <BottomNav activeIndex={0} lang={lang} />
  </Phone>
);

/* ——— 5. Navigation ——— */
const MockupNavigate = ({ lang }: { lang: string }) => (
  <Phone>
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <span className="text-[8px] font-bold text-foreground/60">Limassol Fitness</span>
      <motion.div className="relative" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
        <div className="absolute -inset-1.5 rounded-lg border border-primary/70 animate-pulse" />
        <div className="flex items-center gap-1 text-[7px] font-bold text-foreground border border-border/40 rounded-lg px-2 py-1">
          <Globe className="w-2.5 h-2.5" />
          EN / RU
        </div>
      </motion.div>
    </div>

    {/* Swipe hint */}
    <div className="flex items-center justify-center gap-3 mt-14 text-primary">
      <motion.div animate={{ x: [-4, 0, -4] }} transition={{ duration: 1.2, repeat: Infinity }}>
        <ChevronLeft className="w-5 h-5" />
      </motion.div>
      <div className="w-24 h-14 rounded-xl bg-card border border-border/40" />
      <motion.div animate={{ x: [4, 0, 4] }} transition={{ duration: 1.2, repeat: Infinity }}>
        <ChevronRight className="w-5 h-5" />
      </motion.div>
    </div>
    <div className="text-center text-[7.5px] text-muted-foreground mt-2 px-6">
      {lang === 'en' ? 'Swipe left / right between sections' : 'Свайпай влево-вправо между разделами'}
    </div>

    {/* Buy sessions */}
    <div className="flex justify-center mt-8">
      <Pulse>
        <div className="flex items-center gap-1.5 gradient-primary text-primary-foreground text-[9px] font-bold py-2 px-5 rounded-xl glow-primary">
          <Plus className="w-3 h-3" />
          {lang === 'en' ? 'Buy more sessions' : 'Докупить тренировки'}
        </div>
      </Pulse>
    </div>

    <BottomNav activeIndex={1} lang={lang} highlight />
  </Phone>
);

const slides = [
  {
    Mockup: MockupBook,
    title: { en: 'Book in 30 seconds', ru: 'Запишись за 30 секунд' },
    description: {
      en: 'Just your name and phone — no registration needed',
      ru: 'Только имя и телефон — регистрация не нужна',
    },
  },
  {
    Mockup: MockupAccount,
    title: { en: 'Your personal account', ru: 'Твой личный кабинет' },
    description: {
      en: 'Sessions left, schedule, Telegram reminders and full history in one card',
      ru: 'Остаток занятий, расписание, напоминания в Telegram и вся история — в одной карточке',
    },
  },
  {
    Mockup: MockupNutrition,
    title: { en: 'Nutrition diary', ru: 'Дневник питания' },
    description: {
      en: 'Snap your meal — calories, macros and personal advice appear automatically',
      ru: 'Сфотографируй еду — калории, БЖУ и персональные советы появятся сами',
    },
  },
  {
    Mockup: MockupProgress,
    title: { en: 'Track your progress', ru: 'Следи за прогрессом' },
    description: {
      en: 'Weight, measurements and achievements — see how far you have come',
      ru: 'Вес, замеры и достижения — видно, насколько ты продвинулся',
    },
  },
  {
    Mockup: MockupNavigate,
    title: { en: 'Find your way around', ru: 'Как ориентироваться' },
    description: {
      en: 'Swipe between sections, switch language on top, top up sessions at the bottom',
      ru: 'Свайпай между разделами, язык — сверху, докупить занятия — внизу',
    },
  },
];

const SlideColors = [
  'hsl(var(--primary))',
  'hsl(217 91% 60%)',
  'hsl(160 84% 39%)',
  'hsl(38 92% 50%)',
  'hsl(var(--primary))',
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
            <div className="mt-5 text-center max-w-xs">
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
