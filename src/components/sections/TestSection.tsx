import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { translations } from '@/i18n/translations';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Activity, Heart, Apple, ArrowRight, LogIn } from 'lucide-react';
import PhoneInput from '@/components/PhoneInput';
import { supabase } from '@/integrations/supabase/client';

const COUNTRY_CODES = [
  { code: '+357', country: '🇨🇾', label: 'Cyprus' },
  { code: '+7', country: '🇷🇺', label: 'Russia' },
  { code: '+380', country: '🇺🇦', label: 'Ukraine' },
  { code: '+44', country: '🇬🇧', label: 'UK' },
  { code: '+49', country: '🇩🇪', label: 'Germany' },
  { code: '+30', country: '🇬🇷', label: 'Greece' },
  { code: '+1', country: '🇺🇸', label: 'USA' },
  { code: '+972', country: '🇮🇱', label: 'Israel' },
  { code: '+971', country: '🇦🇪', label: 'UAE' },
  { code: '+33', country: '🇫🇷', label: 'France' },
];

const NUTRITION_INDICES = [0, 1, 2, 3, 4];
const HEALTH_INDICES = [5, 6, 7, 8, 9];

interface TestSectionProps {
  onLoginClick?: () => void;
}

const TestSection = ({ onLoginClick }: TestSectionProps) => {
  const { t, lang } = useLanguage();
  const { user, profile } = useAuth();
  const test = translations.test;
  const [step, setStep] = useState<'intro' | 'info' | 'quiz' | 'result'>('intro');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+357');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const totalQuestions = test.questions.length;

  // For logged-in users, use profile data
  const effectiveName = user && profile ? profile.full_name : name;
  const effectivePhone = user && profile ? profile.phone : `${countryCode}${phone}`;

  const handleStart = () => {
    if (user) {
      // Logged in — skip info step, go straight to quiz
      setStep('quiz');
    } else {
      // Not logged in — prompt to register
      onLoginClick?.();
    }
  };

  const handleAnswer = (scoreIndex: number) => {
    const score = test.questions[currentQ].scores[scoreIndex];
    const newAnswers = [...answers, score];
    setAnswers(newAnswers);

    if (currentQ < totalQuestions - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setStep('result');
      const { nutritionScore, nutritionMax, healthScore, healthMax } = calculateScores(newAnswers);
      const nutritionPct = Math.round((nutritionScore / nutritionMax) * 100);
      const healthPct = Math.round((healthScore / healthMax) * 100);
      const overallPct = Math.round(((nutritionScore + healthScore) / (nutritionMax + healthMax)) * 100);

      // Save to database
      if (user) {
        supabase.from('test_results').insert({
          user_id: user.id,
          nutrition_score: nutritionScore,
          nutrition_max: nutritionMax,
          health_score: healthScore,
          health_max: healthMax,
          overall_percentage: overallPct,
          answers: newAnswers.map(a => Number(a)),
        }).then(({ error }) => {
          if (error) console.error('Save test result error:', error);
        });
      }

      const msg = `🏋️ <b>New Health Test</b>\n👤 ${effectiveName}\n📱 ${effectivePhone}\n\n🍎 Nutrition: ${nutritionPct}% (${nutritionScore}/${nutritionMax})\n❤️ Health: ${healthPct}% (${healthScore}/${healthMax})\n📊 Overall: ${overallPct}%`;
      
      supabase.functions.invoke('send-telegram', {
        body: { action: 'testResult', message: msg },
      }).catch(err => console.error('Telegram send error:', err));
    }
  };

  const calculateScores = (ans: number[]) => {
    const nutritionScore = NUTRITION_INDICES.reduce((sum, i) => sum + (ans[i] || 0), 0);
    const healthScore = HEALTH_INDICES.reduce((sum, i) => sum + (ans[i] || 0), 0);
    const nutritionMax = NUTRITION_INDICES.length * 4;
    const healthMax = HEALTH_INDICES.length * 4;
    return { nutritionScore, nutritionMax, healthScore, healthMax };
  };

  const { nutritionScore, nutritionMax, healthScore, healthMax } = calculateScores(answers);
  const nutritionPct = Math.round((nutritionScore / nutritionMax) * 100);
  const healthPct = Math.round((healthScore / healthMax) * 100);
  const overallPct = Math.round(((nutritionScore + healthScore) / (nutritionMax + healthMax)) * 100);

  const getLevel = (pct: number) => {
    if (pct >= 80) return { en: 'Excellent', ru: 'Отлично' };
    if (pct >= 60) return { en: 'Good', ru: 'Хорошо' };
    if (pct >= 40) return { en: 'Average', ru: 'Средне' };
    return { en: 'Needs improvement', ru: 'Нужно улучшить' };
  };

  const getWhoComparison = (pct: number, type: 'nutrition' | 'health') => {
    const whoTarget = 80;
    const diff = whoTarget - pct;
    if (diff <= 0) {
      return type === 'nutrition'
        ? { en: 'Your nutrition meets WHO healthy eating standards. Keep balanced meals!', ru: 'Ваше питание соответствует стандартам здорового питания ВОЗ. Продолжайте!' }
        : { en: 'Your lifestyle aligns with WHO physical activity and health guidelines.', ru: 'Ваш образ жизни соответствует рекомендациям ВОЗ по физической активности.' };
    }
    return type === 'nutrition'
      ? { en: `Your nutrition is ${diff}% below WHO standards. Focus on more fruits, vegetables, and hydration.`, ru: `Ваше питание на ${diff}% ниже стандартов ВОЗ. Больше фруктов, овощей и воды.` }
      : { en: `Your health habits are ${diff}% below WHO standards. More exercise, better sleep and stress management needed.`, ru: `Ваши привычки здоровья на ${diff}% ниже стандартов ВОЗ. Нужно больше упражнений, сна и управления стрессом.` };
  };

  const ScoreRing = ({ percentage, label, icon: Icon, color }: { percentage: number; label: string; icon: React.ElementType; color: string }) => (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="50" fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${percentage * 3.14} 314`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="w-4 h-4 mb-1" style={{ color }} />
          <span className="text-2xl font-extrabold" style={{ color }}>{percentage}%</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
    </div>
  );

  const WhoBar = ({ percentage, label }: { percentage: number; label: string }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold text-foreground">{percentage}%</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-secondary overflow-hidden">
        <div
          className="absolute h-full rounded-full gradient-primary transition-all duration-1000"
          style={{ width: `${percentage}%` }}
        />
        <div className="absolute top-0 h-full w-0.5 bg-foreground/50" style={{ left: '80%' }} />
      </div>
      <div className="flex justify-end">
        <span className="text-[10px] text-muted-foreground/50" style={{ marginRight: '16%' }}>
          {lang === 'en' ? 'WHO norm' : 'Норма ВОЗ'}
        </span>
      </div>
    </div>
  );

  return (
    <section className="h-full px-5 pb-28 overflow-hidden flex flex-col" style={{ paddingTop: 'max(env(safe-area-inset-top, 32px), 32px)' }}>
      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center min-h-[70vh] text-center"
          >
            <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mb-6 glow-primary">
              <Activity className="w-10 h-10 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-extrabold uppercase tracking-tight mb-3">{t(test.title)}</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-xs">{t(test.subtitle)}</p>

            {user ? (
              <button
                onClick={handleStart}
                className="group flex items-center gap-2 gradient-primary text-primary-foreground font-bold px-10 py-3.5 rounded-2xl text-sm uppercase tracking-wider glow-primary hover:scale-105 transition-transform"
              >
                {t(test.start)}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-muted-foreground max-w-xs">
                  {lang === 'en' ? 'Please sign in to take the test' : 'Войдите в аккаунт, чтобы пройти тест'}
                </p>
                <button
                  onClick={() => onLoginClick?.()}
                  className="group flex items-center gap-2 gradient-primary text-primary-foreground font-bold px-10 py-3.5 rounded-2xl text-sm uppercase tracking-wider glow-primary hover:scale-105 transition-transform"
                >
                  <LogIn className="w-4 h-4" />
                  {lang === 'en' ? 'Sign In' : 'Войти'}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 'quiz' && (
          <motion.div
            key={`quiz-${currentQ}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="flex flex-col min-h-[70vh]"
          >
            <div className="flex items-center gap-2 mb-3">
              {NUTRITION_INDICES.includes(currentQ) ? (
                <><Apple className="w-4 h-4 text-primary" /><span className="text-xs font-bold text-primary uppercase tracking-wider">{lang === 'en' ? 'Nutrition' : 'Питание'}</span></>
              ) : (
                <><Heart className="w-4 h-4 text-primary" /><span className="text-xs font-bold text-primary uppercase tracking-wider">{lang === 'en' ? 'Health & Lifestyle' : 'Здоровье'}</span></>
              )}
            </div>

            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => {
                  if (currentQ > 0) {
                    setCurrentQ(currentQ - 1);
                    setAnswers(answers.slice(0, -1));
                  } else {
                    setStep('intro');
                  }
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full gradient-primary rounded-full transition-all duration-500"
                  style={{ width: `${((currentQ + 1) / totalQuestions) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-bold">{currentQ + 1}/{totalQuestions}</span>
            </div>

            <h3 className="text-lg font-extrabold mb-6">{t(test.questions[currentQ].q)}</h3>

            <div className="space-y-3">
              {test.questions[currentQ].options[lang].map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  className="w-full bg-card rounded-xl p-4 text-left text-sm font-bold border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-[0.98]"
                >
                  {option}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center min-h-[70vh] pt-4"
          >
            <h2 className="text-2xl font-extrabold uppercase tracking-tight mb-6">{t(test.resultTitle)}</h2>

            <div className="flex gap-8 mb-6">
              <ScoreRing
                percentage={nutritionPct}
                label={lang === 'en' ? 'Nutrition' : 'Питание'}
                icon={Apple}
                color="hsl(8, 85%, 58%)"
              />
              <ScoreRing
                percentage={healthPct}
                label={lang === 'en' ? 'Health' : 'Здоровье'}
                icon={Heart}
                color="hsl(8, 85%, 58%)"
              />
            </div>

            <div className="bg-card rounded-2xl p-4 w-full max-w-sm mb-4 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-extrabold">{lang === 'en' ? 'Overall Score' : 'Общая оценка'}</span>
                <span className="text-xl font-extrabold text-gradient">{overallPct}%</span>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                overallPct >= 80 ? 'bg-green-500/20 text-green-400' :
                overallPct >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                overallPct >= 40 ? 'bg-orange-500/20 text-orange-400' :
                'bg-red-500/20 text-red-400'
              }`}>{t(getLevel(overallPct))}</span>
            </div>

            <div className="bg-card rounded-2xl p-4 w-full max-w-sm space-y-4 mb-4 border border-border/50">
              <h4 className="text-sm font-extrabold flex items-center gap-2">
                📊 {lang === 'en' ? 'WHO Standards' : 'Стандарты ВОЗ'}
              </h4>
              <WhoBar percentage={nutritionPct} label={lang === 'en' ? 'Nutrition' : 'Питание'} />
              <WhoBar percentage={healthPct} label={lang === 'en' ? 'Health' : 'Здоровье'} />
            </div>

            <div className="w-full max-w-sm space-y-3 mb-4">
              <div className="bg-card rounded-2xl p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Apple className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-extrabold">{lang === 'en' ? 'Nutrition' : 'Питание'}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{t(getWhoComparison(nutritionPct, 'nutrition'))}</p>
              </div>
              <div className="bg-card rounded-2xl p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-primary" />
                  <span className="text-sm font-extrabold">{lang === 'en' ? 'Health' : 'Здоровье'}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{t(getWhoComparison(healthPct, 'health'))}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground/50 mb-1">{t(test.whoStandards)}</p>
            <p className="text-xs text-primary font-bold">{t(test.sendResults)}</p>

            <button
              onClick={() => { setStep('intro'); setCurrentQ(0); setAnswers([]); setName(''); setPhone(''); }}
              className="mt-6 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {lang === 'en' ? 'Take again' : 'Пройти снова'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default TestSection;
