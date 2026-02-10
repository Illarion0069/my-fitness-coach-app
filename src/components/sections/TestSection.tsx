import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Activity, Heart, Apple, ArrowRight } from 'lucide-react';
import PhoneInput from '@/components/PhoneInput';

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

const TestSection = () => {
  const { t, lang } = useLanguage();
  const test = translations.test;
  const [step, setStep] = useState<'intro' | 'info' | 'quiz' | 'result'>('intro');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+357');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const totalQuestions = test.questions.length;

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
      const msg = `🏋️ <b>New Health Test</b>\n👤 ${name}\n📱 ${countryCode}${phone}\n\n🍎 Nutrition: ${nutritionPct}% (${nutritionScore}/${nutritionMax})\n❤️ Health: ${healthPct}% (${healthScore}/${healthMax})\n📊 Overall: ${overallPct}%`;
      
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
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
          <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
          <circle
            cx="60" cy="60" r="50" fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="square"
            strokeDasharray={`${percentage * 3.14} 314`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="w-4 h-4 mb-1" style={{ color }} />
          <span className="text-2xl font-bold" style={{ color }}>{percentage}%</span>
        </div>
      </div>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-sans">{label}</span>
    </div>
  );

  const WhoBar = ({ percentage, label }: { percentage: number; label: string }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-sans">
        <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}</span>
        <span className="font-medium text-foreground">{percentage}%</span>
      </div>
      <div className="relative h-1.5 bg-secondary overflow-hidden">
        <div
          className="absolute h-full bg-primary transition-all duration-1000"
          style={{ width: `${percentage}%` }}
        />
        <div className="absolute top-0 h-full w-0.5 bg-foreground/50" style={{ left: '80%' }} />
      </div>
      <div className="flex justify-end">
        <span className="text-[9px] text-muted-foreground/60 font-sans uppercase tracking-wider" style={{ marginRight: '16%' }}>
          {lang === 'en' ? 'WHO norm' : 'Норма ВОЗ'}
        </span>
      </div>
    </div>
  );

  return (
    <section className="min-h-screen px-5 pt-8 pb-24">
      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center min-h-[70vh] text-center"
          >
            <div className="editorial-line mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-3">{t(test.title)}</h2>
            <p className="text-xs text-muted-foreground mb-8 max-w-xs font-sans">{t(test.subtitle)}</p>
            <button
              onClick={() => setStep('info')}
              className="inline-flex items-center gap-3 bg-primary text-primary-foreground font-semibold px-8 py-3 text-xs uppercase tracking-wider font-sans hover:opacity-90 transition-opacity"
            >
              {t(test.start)}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {step === 'info' && (
          <motion.div
            key="info"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="flex flex-col items-center justify-center min-h-[70vh]"
          >
            <div className="w-full max-w-sm space-y-4">
              <h3 className="text-2xl font-bold text-center mb-6">{t(test.title)}</h3>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-sans">{t(test.nameLabel)}</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t(test.nameLabel)}
                  className="border-border bg-transparent font-sans"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-sans">{t(test.phoneLabel)}</label>
                <PhoneInput
                  countryCode={countryCode}
                  onCountryCodeChange={setCountryCode}
                  phone={phone}
                  onPhoneChange={setPhone}
                  countryCodes={COUNTRY_CODES}
                />
              </div>
              <button
                onClick={() => name && phone && setStep('quiz')}
                disabled={!name || !phone}
                className="w-full bg-primary text-primary-foreground font-semibold py-3 text-xs uppercase tracking-wider font-sans hover:opacity-90 transition-opacity disabled:opacity-30 mt-4"
              >
                {t(test.next)} →
              </button>
            </div>
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
                <><Apple className="w-4 h-4 text-primary" /><span className="text-[10px] font-medium text-primary uppercase tracking-wider font-sans">{lang === 'en' ? 'Nutrition' : 'Питание'}</span></>
              ) : (
                <><Heart className="w-4 h-4 text-primary" /><span className="text-[10px] font-medium text-primary uppercase tracking-wider font-sans">{lang === 'en' ? 'Health & Lifestyle' : 'Здоровье и образ жизни'}</span></>
              )}
            </div>

            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => {
                  if (currentQ > 0) {
                    setCurrentQ(currentQ - 1);
                    setAnswers(answers.slice(0, -1));
                  } else {
                    setStep('info');
                  }
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 h-px bg-secondary overflow-hidden relative">
                <div
                  className="absolute h-full bg-primary transition-all duration-500"
                  style={{ width: `${((currentQ + 1) / totalQuestions) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground font-sans">{currentQ + 1}/{totalQuestions}</span>
            </div>

            <h3 className="text-xl font-bold mb-6">{t(test.questions[currentQ].q)}</h3>

            <div className="space-y-2">
              {test.questions[currentQ].options[lang].map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  className="w-full border border-border p-4 text-left text-sm font-medium font-sans hover:border-primary hover:text-primary transition-all active:scale-[0.99]"
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center min-h-[70vh] pt-4"
          >
            <div className="editorial-line mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-6">{t(test.resultTitle)}</h2>

            <div className="flex gap-8 mb-6">
              <ScoreRing
                percentage={nutritionPct}
                label={lang === 'en' ? 'Nutrition' : 'Питание'}
                icon={Apple}
                color="hsl(142, 71%, 45%)"
              />
              <ScoreRing
                percentage={healthPct}
                label={lang === 'en' ? 'Health' : 'Здоровье'}
                icon={Heart}
                color="hsl(var(--primary))"
              />
            </div>

            <div className="border border-border p-4 w-full max-w-sm mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold font-sans">{lang === 'en' ? 'Overall Score' : 'Общая оценка'}</span>
                <span className="text-lg font-bold text-gradient">{overallPct}%</span>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 font-sans uppercase tracking-wider ${
                overallPct >= 80 ? 'bg-green-500/20 text-green-400' :
                overallPct >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                overallPct >= 40 ? 'bg-orange-500/20 text-orange-400' :
                'bg-red-500/20 text-red-400'
              }`}>{t(getLevel(overallPct))}</span>
            </div>

            <div className="border border-border p-4 w-full max-w-sm space-y-4 mb-4">
              <h4 className="text-xs font-bold flex items-center gap-2 font-sans uppercase tracking-wider">
                📊 {lang === 'en' ? 'WHO Standards' : 'Стандарты ВОЗ'}
              </h4>
              <WhoBar percentage={nutritionPct} label={lang === 'en' ? 'Nutrition' : 'Питание'} />
              <WhoBar percentage={healthPct} label={lang === 'en' ? 'Health' : 'Здоровье'} />
            </div>

            <div className="w-full max-w-sm space-y-3 mb-4">
              <div className="border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Apple className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-bold font-sans uppercase tracking-wider">{lang === 'en' ? 'Nutrition' : 'Питание'}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed font-sans">{t(getWhoComparison(nutritionPct, 'nutrition'))}</p>
              </div>
              <div className="border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold font-sans uppercase tracking-wider">{lang === 'en' ? 'Health' : 'Здоровье'}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed font-sans">{t(getWhoComparison(healthPct, 'health'))}</p>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/60 mb-1 font-sans">{t(test.whoStandards)}</p>
            <p className="text-[10px] text-primary font-sans uppercase tracking-wider">{t(test.sendResults)}</p>

            <button
              onClick={() => { setStep('intro'); setCurrentQ(0); setAnswers([]); setName(''); setPhone(''); }}
              className="mt-6 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground font-sans"
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