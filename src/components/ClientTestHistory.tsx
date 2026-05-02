import { useEffect, useState } from 'react';
import { Activity, Apple, Heart, TrendingUp, TrendingDown, Minus, ClipboardCheck, ArrowRight, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import TestSection from '@/components/sections/TestSection';

interface TestResult {
  id: string;
  nutrition_score: number;
  nutrition_max: number;
  health_score: number;
  health_max: number;
  overall_percentage: number;
  created_at: string;
}

interface ClientTestHistoryProps {
  userId: string;
  lang: string;
}

const ClientTestHistory = ({ userId, lang }: ClientTestHistoryProps) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [takingTest, setTakingTest] = useState(false);

  const loadResults = () => {
    supabase
      .from('test_results')
      .select('id, nutrition_score, nutrition_max, health_score, health_max, overall_percentage, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setResults((data || []) as TestResult[]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadResults();
  }, [userId]);

  // Re-fetch results when user closes the test view
  useEffect(() => {
    if (!takingTest) loadResults();
  }, [takingTest]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Active test mode
  if (takingTest) {
    return (
      <div className="-mx-4 -my-4">
        <button
          onClick={() => setTakingTest(false)}
          className="absolute top-3 right-4 z-50 text-xs text-muted-foreground hover:text-foreground bg-card/80 backdrop-blur px-3 py-1.5 rounded-full"
        >
          {lang === 'en' ? 'Close' : 'Закрыть'}
        </button>
        <TestSection />
      </div>
    );
  }

  // Empty state — new client without any test
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
          onClick={() => setTakingTest(true)}
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

  return (
    <div className="space-y-3">
      <button
        onClick={() => setTakingTest(true)}
        className="w-full flex items-center justify-center gap-2 gradient-primary text-primary-foreground font-bold py-3 rounded-2xl text-sm glow-primary hover:scale-[1.02] transition-transform"
      >
        <RefreshCw className="w-4 h-4" />
        {lang === 'en' ? 'Take test again' : 'Пройти тест ещё раз'}
      </button>

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

          return (
            <div key={r.id} className="bg-card/50 rounded-lg p-2.5 flex items-center gap-3">
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
                <div className="flex items-center gap-2 text-[11px]">
                  <Apple className="w-3 h-3 text-green-400 shrink-0" />
                  <span className="text-muted-foreground">{nutritionPct}%</span>
                  <Heart className="w-3 h-3 text-primary shrink-0 ml-1" />
                  <span className="text-muted-foreground">{healthPct}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60">{date}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClientTestHistory;
