import { useEffect, useState } from 'react';
import { Activity, Apple, Heart, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

  useEffect(() => {
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
  }, [userId]);

  if (loading) return null;
  if (results.length === 0) return null;

  const TrendIcon = ({ current, previous }: { current: number; previous?: number }) => {
    if (previous === undefined) return null;
    if (current > previous) return <TrendingUp className="w-3 h-3 text-green-400" />;
    if (current < previous) return <TrendingDown className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  return (
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
  );
};

export default ClientTestHistory;
