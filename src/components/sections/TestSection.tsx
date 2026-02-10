import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowRight, CheckCircle2, Activity } from 'lucide-react';

const TestSection = () => {
  const { t, lang } = useLanguage();
  const test = translations.test;
  const [step, setStep] = useState<'intro' | 'info' | 'quiz' | 'result'>('intro');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const totalQuestions = test.questions.length;
  const maxScore = totalQuestions * 4;

  const handleAnswer = (scoreIndex: number) => {
    const score = test.questions[currentQ].scores[scoreIndex];
    const newAnswers = [...answers, score];
    setAnswers(newAnswers);

    if (currentQ < totalQuestions - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setStep('result');
      // Send via WhatsApp
      const total = newAnswers.reduce((a, b) => a + b, 0);
      const pct = Math.round((total / maxScore) * 100);
      const msg = `New Health Test Result:\nName: ${name}\nPhone: ${phone}\nScore: ${pct}%\nTotal: ${total}/${maxScore}`;
      const waUrl = `https://wa.me/35795144819?text=${encodeURIComponent(msg)}`;
      // Open in background
      window.open(waUrl, '_blank');
    }
  };

  const totalScore = answers.reduce((a, b) => a + b, 0);
  const percentage = Math.round((totalScore / maxScore) * 100);

  const getHealthLevel = () => {
    if (percentage >= 80) return { en: 'Excellent! Your lifestyle aligns well with WHO healthy living standards. Keep it up!', ru: 'Отлично! Ваш образ жизни соответствует стандартам ВОЗ. Так держать!' };
    if (percentage >= 60) return { en: 'Good! You have a solid foundation but there is room for improvement in nutrition and activity.', ru: 'Хорошо! У вас хорошая база, но есть возможности для улучшения питания и активности.' };
    if (percentage >= 40) return { en: 'Average. WHO recommends improving your diet, sleep and physical activity for better health outcomes.', ru: 'Средне. ВОЗ рекомендует улучшить питание, сон и физическую активность для лучших результатов.' };
    return { en: 'Needs attention. Your current lifestyle significantly differs from WHO standards. A personal trainer can help you transform.', ru: 'Требует внимания. Ваш текущий образ жизни значительно отличается от стандартов ВОЗ. Персональный тренер поможет вам измениться.' };
  };

  return (
    <section className="min-h-screen px-4 pt-6 pb-24">
      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center min-h-[70vh] text-center"
          >
            <Activity className="w-16 h-16 text-primary mb-6" />
            <h2 className="text-2xl font-bold mb-3">{t(test.title)}</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-xs">{t(test.subtitle)}</p>
            <button
              onClick={() => setStep('info')}
              className="gradient-primary text-primary-foreground font-semibold px-8 py-3 rounded-2xl text-sm glow-primary hover:scale-105 transition-transform"
            >
              {t(test.start)}
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
              <h3 className="text-xl font-bold text-center mb-6">{t(test.title)}</h3>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t(test.nameLabel)}</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t(test.nameLabel)}
                  className="glass"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t(test.phoneLabel)}</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+357..."
                  className="glass"
                />
              </div>
              <button
                onClick={() => name && phone && setStep('quiz')}
                disabled={!name || !phone}
                className="w-full gradient-primary text-primary-foreground font-semibold py-3 rounded-2xl text-sm glow-primary hover:scale-105 transition-transform disabled:opacity-40 disabled:hover:scale-100 mt-4"
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
            {/* Progress */}
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
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full gradient-primary rounded-full transition-all duration-500"
                  style={{ width: `${((currentQ + 1) / totalQuestions) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{currentQ + 1}/{totalQuestions}</span>
            </div>

            <h3 className="text-lg font-bold mb-6">{t(test.questions[currentQ].q)}</h3>

            <div className="space-y-3">
              {test.questions[currentQ].options[lang].map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  className="w-full glass rounded-2xl p-4 text-left text-sm font-medium hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-[0.98]"
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
            className="flex flex-col items-center justify-center min-h-[70vh] text-center"
          >
            <CheckCircle2 className="w-16 h-16 text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">{t(test.resultTitle)}</h2>

            <div className="relative w-32 h-32 my-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${percentage * 3.14} 314`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-gradient">{percentage}%</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground max-w-xs mb-2">{t(getHealthLevel())}</p>
            <p className="text-xs text-muted-foreground/60">{t(test.whoStandards)}</p>
            <p className="text-xs text-primary mt-4">{t(test.sendResults)}</p>

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
