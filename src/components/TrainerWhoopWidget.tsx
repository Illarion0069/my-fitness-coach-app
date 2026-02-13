import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Heart, Flame, Zap, Moon, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface WhoopMetric {
  metric_date: string;
  calories: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  strain: number | null;
  recovery_score: number | null;
  hrv: number | null;
  resting_heart_rate: number | null;
  sleep_duration_minutes: number | null;
  workout_count: number | null;
}

interface TrainerWhoopWidgetProps {
  userId: string;
  lang: string;
}

const TrainerWhoopWidget = ({ userId, lang }: TrainerWhoopWidgetProps) => {
  const [metrics, setMetrics] = useState<WhoopMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      // Check if user has whoop tokens (trainer can see via RLS)
      const { data: tokenData } = await supabase
        .from('whoop_tokens')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!tokenData) {
        setConnected(false);
        setLoading(false);
        return;
      }

      setConnected(true);

      const { data } = await supabase
        .from('whoop_metrics')
        .select('*')
        .eq('user_id', userId)
        .order('metric_date', { ascending: false })
        .limit(7);

      setMetrics((data as WhoopMetric[]) || []);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connected) return null; // Don't show anything if client hasn't connected Whoop

  const today = metrics[0];
  if (!today) {
    return (
      <div className="bg-secondary/30 rounded-xl p-3 mt-3">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
          <Activity className="w-3 h-3" /> Whoop
        </p>
        <p className="text-xs text-muted-foreground">
          {lang === 'en' ? 'Connected but no data yet' : 'Подключён, но данных пока нет'}
        </p>
      </div>
    );
  }

  const recoveryColor = (score: number | null) => {
    if (score == null) return 'text-muted-foreground';
    if (score >= 67) return 'text-green-400';
    if (score >= 34) return 'text-yellow-400';
    return 'text-red-400';
  };

  const recoveryBg = (score: number | null) => {
    if (score == null) return 'bg-muted/30';
    if (score >= 67) return 'bg-green-500/10 border-green-500/20';
    if (score >= 34) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  // Calculate 7-day averages
  const avg = (key: keyof WhoopMetric) => {
    const vals = metrics.map(m => m[key]).filter((v): v is number => v != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const avgCalories = avg('calories');
  const avgStrain = (() => {
    const vals = metrics.map(m => m.strain).filter((v): v is number => v != null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  })();
  const avgRecovery = avg('recovery_score');
  const avgSleep = avg('sleep_duration_minutes');

  return (
    <div className="bg-secondary/30 rounded-xl p-3 mt-3 space-y-3">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
        <Activity className="w-3 h-3" /> Whoop · {today.metric_date}
      </p>

      {/* Recovery hero */}
      {today.recovery_score != null && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`rounded-xl border p-3 flex items-center gap-3 ${recoveryBg(today.recovery_score)}`}
        >
          <div className={`text-2xl font-extrabold font-heading ${recoveryColor(today.recovery_score)}`}>
            {Math.round(today.recovery_score)}%
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Recovery</p>
            {today.hrv != null && (
              <p className="text-[10px] text-muted-foreground">HRV {Math.round(today.hrv)}ms</p>
            )}
            {today.resting_heart_rate != null && (
              <p className="text-[10px] text-muted-foreground">RHR {Math.round(today.resting_heart_rate)} bpm</p>
            )}
          </div>
        </motion.div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        {today.calories != null && (
          <div className="flex items-center gap-2 bg-background/50 rounded-lg p-2">
            <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <div>
              <p className="text-[9px] text-muted-foreground">{lang === 'en' ? 'Calories' : 'Калории'}</p>
              <p className="text-xs font-bold">{Math.round(today.calories)}</p>
            </div>
          </div>
        )}
        {today.strain != null && (
          <div className="flex items-center gap-2 bg-background/50 rounded-lg p-2">
            <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <div>
              <p className="text-[9px] text-muted-foreground">Strain</p>
              <p className="text-xs font-bold">{today.strain.toFixed(1)}</p>
            </div>
          </div>
        )}
        {today.avg_heart_rate != null && (
          <div className="flex items-center gap-2 bg-background/50 rounded-lg p-2">
            <Heart className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <div>
              <p className="text-[9px] text-muted-foreground">{lang === 'en' ? 'Avg HR' : 'Ср. пульс'}</p>
              <p className="text-xs font-bold">{Math.round(today.avg_heart_rate)} <span className="text-[9px] text-muted-foreground">bpm</span></p>
            </div>
          </div>
        )}
        {today.sleep_duration_minutes != null && (
          <div className="flex items-center gap-2 bg-background/50 rounded-lg p-2">
            <Moon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div>
              <p className="text-[9px] text-muted-foreground">{lang === 'en' ? 'Sleep' : 'Сон'}</p>
              <p className="text-xs font-bold">{Math.floor(today.sleep_duration_minutes / 60)}h {today.sleep_duration_minutes % 60}m</p>
            </div>
          </div>
        )}
      </div>

      {/* 7-day averages */}
      {metrics.length > 1 && (
        <div className="border-t border-border/30 pt-2">
          <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> {lang === 'en' ? '7-day avg' : 'Средн. за 7 дн.'}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
            {avgCalories != null && (
              <span className="text-muted-foreground"><Flame className="w-3 h-3 inline text-orange-400 mr-0.5" />{avgCalories} kcal</span>
            )}
            {avgStrain != null && (
              <span className="text-muted-foreground"><Zap className="w-3 h-3 inline text-yellow-400 mr-0.5" />{avgStrain}</span>
            )}
            {avgRecovery != null && (
              <span className={recoveryColor(avgRecovery)}><Activity className="w-3 h-3 inline mr-0.5" />{avgRecovery}%</span>
            )}
            {avgSleep != null && (
              <span className="text-muted-foreground"><Moon className="w-3 h-3 inline text-blue-400 mr-0.5" />{Math.floor(avgSleep / 60)}h {avgSleep % 60}m</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerWhoopWidget;
