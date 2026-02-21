import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserRound, ClipboardCheck, Dumbbell, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import trainerLogo from '@/assets/trainer-logo.png';

interface AppGuideProps {
  onComplete: () => void;
}

const slides = [
  {
    icon: UserRound,
    title: { en: 'Create your account', ru: 'Создайте аккаунт' },
    description: {
      en: 'Tap the "Sign In" button in the top-right corner to register. Enter your name, phone and password — it takes 30 seconds.',
      ru: 'Нажмите кнопку «Войти» в правом верхнем углу для регистрации. Введите имя, телефон и пароль — это займёт 30 секунд.',
    },
    highlight: 'profile',
    color: 'hsl(8 85% 58%)',
  },
  {
    icon: ClipboardCheck,
    title: { en: 'Take a fitness test', ru: 'Пройдите фитнес-тест' },
    description: {
      en: 'Swipe to the "Test" tab to check your fitness level. The test helps your trainer build the perfect program for you.',
      ru: 'Перейдите на вкладку «Тест», чтобы оценить уровень подготовки. Результат поможет тренеру составить идеальную программу.',
    },
    highlight: 'test',
    color: 'hsl(142 71% 45%)',
  },
  {
    icon: Dumbbell,
    title: { en: 'Book your first session', ru: 'Запишитесь на тренировку' },
    description: {
      en: 'Choose a convenient time and book your first personal training session. Your journey starts here!',
      ru: 'Выберите удобное время и запишитесь на первую персональную тренировку. Ваш путь начинается здесь!',
    },
    highlight: 'book',
    color: 'hsl(217 91% 60%)',
  },
];

const AppGuide = ({ onComplete }: AppGuideProps) => {
  const { t } = useLanguage();
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
  const Icon = slide.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip button */}
      <button
        onClick={onComplete}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)' }}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Logo */}
      <motion.img
        src={trainerLogo}
        alt="Logo"
        className="w-14 h-14 rounded-2xl mb-8 shadow-lg"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
      />

      {/* Slide content */}
      <div className="w-full max-w-sm px-8 flex flex-col items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="flex flex-col items-center text-center"
          >
            {/* Icon circle */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: `${slide.color.replace(')', ' / 0.15)')}` }}
            >
              <Icon className="w-9 h-9" style={{ color: slide.color }} />
            </div>

            {/* Step counter */}
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
              {current + 1} / {slides.length}
            </span>

            {/* Title */}
            <h2 className="text-2xl font-extrabold text-foreground mb-3 leading-tight font-heading tracking-wide">
              {t(slide.title)}
            </h2>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(slide.description)}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="flex items-center gap-2 mt-10">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className="transition-all duration-300"
          >
            <div
              className={`rounded-full transition-all duration-300 ${
                i === current ? 'w-8 h-2' : 'w-2 h-2 bg-muted-foreground/30'
              }`}
              style={i === current ? { backgroundColor: slide.color } : undefined}
            />
          </button>
        ))}
      </div>

      {/* Next / Get Started button */}
      <motion.button
        onClick={next}
        className="mt-10 flex items-center gap-2 gradient-primary text-primary-foreground font-bold py-3.5 px-8 rounded-2xl glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] text-sm"
        whileTap={{ scale: 0.97 }}
      >
        {current === slides.length - 1
          ? t({ en: 'Get Started', ru: 'Начать' })
          : t({ en: 'Next', ru: 'Далее' })}
        <ChevronRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
};

export default AppGuide;
