import { useEffect, useState } from 'react';
import { Activity, Apple, Heart, TrendingUp, TrendingDown, Minus, ClipboardCheck, ArrowRight, ChevronDown, Sparkles, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { translations } from '@/i18n/translations';
import TestSection, { type TestType } from '@/components/sections/TestSection';

interface TestResult {
  id: string;
  nutrition_score: number;
  nutrition_max: number;
  health_score: number;
  health_max: number;
  overall_percentage: number;
  created_at: string;
  answers: number[] | null;
  test_type: string | null;
}

interface ClientTestHistoryProps {
  userId: string;
  lang: string;
  initialTest?: TestType | null;
  onAllDone?: () => void;
}

const ClientTestHistory = ({ userId, lang, initialTest = null, onAllDone }: ClientTestHistoryProps) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [takingTest, setTakingTest] = useState<null | TestType>(initialTest);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadResults = () => {
    supabase
      .from('test_results')
      .select('id, nutrition_score, nutrition_max, health_score, health_max, overall_percentage, created_at, answers, test_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setResults((data || []) as TestResult[]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadResults();
  }, [userId]);

  useEffect(() => {
    if (takingTest === null) loadResults();
  }, [takingTest]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (takingTest) {
    return (
      <div className="-mx-4 -my-4">
        <button
          onClick={() => { setTakingTest(null); onAllDone?.(); }}
          className="absolute top-3 right-4 z-50 text-xs text-muted-foreground hover:text-foreground bg-card/80 backdrop-blur px-3 py-1.5 rounded-full"
        >
          {lang === 'en' ? 'Done' : 'Готово'}
        </button>
        <TestSection testType={takingTest} />
      </div>
    );
  }

  // Empty state
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 glow-primary">
          <ClipboardCheck className="w-8 h-8 text-primary-foreground" />
        </div>
        <h3 className="text-base font-extrabold mb-2">
          {lang === 'en' ? 'No tests yet' : 'Тестов пока нет'}
        </h3>
        <p className="text-xs text-muted-foreground mb-6 max-w-[260px]">
          {lang === 'en'
            ? 'Take a 2-minute health assessment so your trainer can see your starting point.'
            : 'Пройдите 2-минутный тест здоровья — тренер увидит вашу стартовую точку.'}
        </p>
        <button
          onClick={() => setTakingTest('baseline')}
          className="group flex items-center gap-2 gradient-primary text-primary-foreground font-bold px-8 py-3 rounded-2xl text-sm uppercase tracking-wider glow-primary hover:scale-105 transition-transform"
        >
          {lang === 'en' ? 'Take the test' : 'Пройти тест'}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
        <p className="text-[10px] text-muted-foreground/50 mt-3">
          {lang === 'en' ? '2 min · 10 questions · free' : '2 минуты · 10 вопросов · бесплатно'}
        </p>
      </div>
    );
  }

  const TrendIcon = ({ current, previous }: { current: number; previous?: number }) => {
    if (previous === undefined) return null;
    if (current > previous) return <TrendingUp className="w-3 h-3 text-green-400" />;
    if (current < previous) return <TrendingDown className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  const langKey = (lang === 'en' ? 'en' : 'ru') as 'en' | 'ru';

  const getTestBank = (type: string | null) =>
    type === 'progress_2m' ? translations.test2 : translations.test;

  const getTestLabel = (type: string | null) =>
    type === 'progress_2m'
      ? (lang === 'en' ? 'Test #2 · Progress' : 'Тест №2 · Прогресс')
      : (lang === 'en' ? 'Test #1 · Baseline' : 'Тест №1 · Базовый');

  const renderAnswerText = (type: string | null, qIdx: number, savedValue: number): { text: string; score: number } => {
    const bank = getTestBank(type);
    const q = bank.questions[qIdx];
    if (!q) return { text: '—', score: 0 };
    // New records store option index (0..3)
    if (savedValue >= 0 && savedValue <= 3) {
      return { text: q.options[langKey][savedValue] ?? '—', score: q.scores[savedValue] ?? 0 };
    }
    // Legacy: stored as score (1..4) — find first option with matching score
    const matchIdx = q.scores.findIndex(s => s === savedValue);
    if (matchIdx >= 0) return { text: q.options[langKey][matchIdx], score: savedValue };
    return { text: `(${savedValue})`, score: savedValue };
  };

  const availableTests: { type: TestType; title: string; subtitle: string; done: boolean }[] = [
    {
      type: 'baseline',
      title: lang === 'en' ? 'Test #1 · Baseline' : 'Тест №1 · Базовый',
      subtitle: lang === 'en' ? 'Nutrition & Health · 10 questions' : 'Питание и здоровье · 10 вопросов',
      done: results.some(r => (r.test_type ?? 'baseline') === 'baseline'),
    },
    {
      type: 'progress_2m',
      title: lang === 'en' ? 'Test #2 · Progress 2m' : 'Тест №2 · Прогресс 2 мес',
      subtitle: lang === 'en' ? 'Body & Discipline · 10 questions' : 'Тело и дисциплина · 10 вопросов',
      done: results.some(r => r.test_type === 'progress_2m'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1 px-1">
          <Plus className="w-3 h-3" />
          {lang === 'en' ? 'Take a new test' : 'Пройти новый тест'}
        </p>
        {availableTests.map(t => (
          <button
            key={t.type}
            onClick={() => setTakingTest(t.type)}
            className="w-full bg-card border border-border/40 rounded-xl p-3 flex items-center gap-3 text-left hover:border-primary/40 transition-colors"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              t.done ? 'bg-secondary' : 'gradient-primary glow-primary'
            }`}>
              <Sparkles className={`w-4 h-4 ${t.done ? 'text-muted-foreground' : 'text-primary-foreground'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-foreground leading-tight">{t.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t.subtitle}</p>
            </div>
            {t.done && (
              <span className="text-[9px] font-bold bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded">
                ✓
              </span>
            )}
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>


      <div className="bg-secondary/30 rounded-xl p-3 space-y-2">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
          <Activity className="w-3 h-3" />
          {lang === 'en' ? 'Health Tests' : 'Тесты здоровья'}
          <span className="ml-auto text-foreground">{results.length}</span>
        </p>

        {results.map((r, idx) => {
          const prev = results[idx + 1];
          const nutritionPct = Math.round((r.nutrition_score / r.nutrition_max) * 100);
          const healthPct = Math.round((r.health_score / r.health_max) * 100);
          const date = new Date(r.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', {
            day: 'numeric', month: 'short', year: idx === 0 ? undefined : '2-digit',
          });
          const isOpen = expandedId === r.id;
          const isProgress = r.test_type === 'progress_2m';
          const bank = getTestBank(r.test_type);
          const sectionA = isProgress ? (lang === 'en' ? 'Body' : 'Тело') : (lang === 'en' ? 'Nutrition' : 'Питание');
          const sectionB = isProgress ? (lang === 'en' ? 'Discipline' : 'Дисциплина') : (lang === 'en' ? 'Health' : 'Здоровье');

          return (
            <div key={r.id} className="bg-card/50 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedId(isOpen ? null : r.id)}
                className="w-full p-2.5 flex items-center gap-3 text-left hover:bg-card transition-colors"
              >
                <div className="flex flex-col items-center min-w-[40px]">
                  <span className={`text-lg font-extrabold ${
                    r.overall_percentage >= 80 ? 'text-green-400' :
                    r.overall_percentage >= 60 ? 'text-yellow-400' :
                    r.overall_percentage >= 40 ? 'text-orange-400' :
                    'text-red-400'
                  }`}>{r.overall_percentage}%</span>
                  <TrendIcon current={r.overall_percentage} previous={prev?.overall_percentage} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      isProgress ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {getTestLabel(r.test_type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <Apple className="w-3 h-3 text-green-400 shrink-0" />
                    <span className="text-muted-foreground">{sectionA} {nutritionPct}%</span>
                    <Heart className="w-3 h-3 text-primary shrink-0 ml-1" />
                    <span className="text-muted-foreground">{sectionB} {healthPct}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">{date}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="border-t border-border/30 p-3 space-y-2 bg-background/40">
                  {(r.answers || []).map((val, qIdx) => {
                    const q = bank.questions[qIdx];
                    if (!q) return null;
                    const { text, score } = renderAnswerText(r.test_type, qIdx, val);
                    return (
                      <div key={qIdx} className="text-[11px] leading-snug">
                        <p className="text-muted-foreground">
                          <span className="text-foreground/60 font-bold">{qIdx + 1}.</span> {q.q[langKey]}
                        </p>
                        <p className="text-foreground font-semibold pl-4 flex items-center gap-1.5">
                          → {text}
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                            score >= 4 ? 'bg-green-500/20 text-green-400' :
                            score >= 3 ? 'bg-yellow-500/20 text-yellow-400' :
                            score >= 2 ? 'bg-orange-500/20 text-orange-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>{score}/4</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClientTestHistory;
