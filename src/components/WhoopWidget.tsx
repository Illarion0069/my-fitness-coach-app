import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Heart, Flame, Zap, Moon, Link2, Loader2, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';

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

const WhoopWidget = () => {
  const { user, session } = useAuth();
  const { lang } = useLanguage();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<WhoopMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showCharts, setShowCharts] = useState(false);

  const syncData = async () => {
    if (!session) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('whoop-sync', {});
      if (error) {
        console.error('Whoop sync error:', error);
        return;
      }
      if (data?.connected === false) {
        setConnected(false);
      } else {
        setConnected(true);
        setMetrics(data?.metrics || []);
      }
    } catch (e) {
      console.error('Whoop sync failed:', e);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && session) syncData();
    else setLoading(false);
  }, [user, session]);

  const connectWhoop = async () => {
    if (!session) return;
    try {
      const { data, error } = await supabase.functions.invoke('whoop-auth', {
        body: {
          action: 'get_auth_url',
          redirect_uri: `${window.location.origin}/whoop-callback`,
        },
      });
      if (error || !data?.url) {
        console.error('Failed to get auth URL:', error);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      console.error('Connect Whoop failed:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="mt-4">
        <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider mb-3">
          Whoop
        </h3>
        <button
          onClick={connectWhoop}
          className="w-full flex items-center justify-center gap-2 bg-background border border-yellow-500/50 rounded-2xl p-4 hover:border-yellow-500 transition-colors"
        >
          <Link2 className="w-5 h-5 text-yellow-500" />
          <span className="text-sm font-semibold text-foreground">
            {lang === 'en' ? 'Reconnect Whoop' : 'Переподключить Whoop'}
          </span>
        </button>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          {lang === 'en' ? 'Session expired. Please reconnect to sync your data.' : 'Сессия истекла. Переподключите для синхронизации данных.'}
        </p>
      </div>
    );
  }

  const today = metrics[0];

  const statCards = today ? [
    { icon: Flame, label: lang === 'en' ? 'Calories' : 'Калории', value: today.calories != null ? Math.round(today.calories) : '—', unit: 'kcal', color: 'text-orange-400' },
    { icon: Heart, label: lang === 'en' ? 'Avg HR' : 'Ср. пульс', value: today.avg_heart_rate != null ? Math.round(today.avg_heart_rate) : '—', unit: 'bpm', color: 'text-red-400' },
    { icon: Zap, label: 'Strain', value: today.strain != null ? today.strain.toFixed(1) : '—', unit: '', color: 'text-yellow-400' },
    { icon: Activity, label: 'Recovery', value: today.recovery_score != null ? `${Math.round(today.recovery_score)}%` : '—', unit: '', color: today.recovery_score != null && today.recovery_score >= 67 ? 'text-green-400' : today.recovery_score != null && today.recovery_score >= 34 ? 'text-yellow-400' : 'text-red-400' },
    { icon: Moon, label: lang === 'en' ? 'Sleep' : 'Сон', value: today.sleep_duration_minutes != null ? `${Math.floor(today.sleep_duration_minutes / 60)}h ${today.sleep_duration_minutes % 60}m` : '—', unit: '', color: 'text-blue-400' },
  ] : [];

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider">
          Whoop
        </h3>
        <button
          onClick={syncData}
          disabled={syncing}
          className="text-[10px] text-primary font-semibold hover:underline disabled:opacity-50"
        >
          {syncing ? (lang === 'en' ? 'Syncing...' : 'Синхр...') : (lang === 'en' ? 'Refresh' : 'Обновить')}
        </button>
      </div>

      {today ? (
        <div className="bg-background border border-border/50 rounded-2xl p-4">
          <p className="text-[11px] text-muted-foreground mb-3">
            {lang === 'en' ? 'Latest data' : 'Последние данные'} · {today.metric_date}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {statCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-2 ${i === statCards.length - 1 && statCards.length % 2 !== 0 ? 'col-span-2' : ''}`}
              >
                <card.icon className={`w-4 h-4 shrink-0 ${card.color}`} />
                <div>
                  <p className="text-[10px] text-muted-foreground">{card.label}</p>
                  <p className="text-sm font-bold text-foreground">
                    {card.value}{card.unit ? <span className="text-[10px] text-muted-foreground ml-0.5">{card.unit}</span> : null}
                  </p>
                </div>
              </motion.div>
            ))}
        </div>

        {/* 7-day charts */}
        {metrics.length > 1 && (
          <div className="mt-3 border-t border-border/30 pt-3">
            <button
              onClick={() => setShowCharts(!showCharts)}
              className="w-full flex items-center justify-between text-[10px] text-muted-foreground font-semibold uppercase tracking-wider"
            >
              <span className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> {lang === 'en' ? '7-day trends' : 'Динамика за 7 дн.'}
              </span>
              <span className="text-primary">{showCharts ? '▲' : '▼'}</span>
            </button>

            {showCharts && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-3 space-y-4"
              >
                {(() => {
                  const chartData = [...metrics].reverse().map(m => ({
                    date: m.metric_date.slice(5),
                    calories: m.calories != null ? Math.round(m.calories) : null,
                    strain: m.strain,
                    recovery: m.recovery_score,
                    hr: m.avg_heart_rate != null ? Math.round(m.avg_heart_rate) : null,
                    sleep: m.sleep_duration_minutes != null ? +(m.sleep_duration_minutes / 60).toFixed(1) : null,
                  }));

                  const tipStyle = {
                    contentStyle: { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '10px' },
                    labelStyle: { fontSize: '10px', color: 'hsl(var(--muted-foreground))' },
                  };

                  return (
                    <>
                      {chartData.some(d => d.recovery != null) && (
                        <div>
                          <p className="text-[9px] text-muted-foreground font-semibold mb-1">Recovery %</p>
                          <ResponsiveContainer width="100%" height={80}>
                            <BarChart data={chartData} barSize={14}>
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                              <Tooltip {...tipStyle} />
                              <Bar dataKey="recovery" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, i) => (
                                  <Cell key={i} fill={entry.recovery == null ? 'hsl(var(--muted))' : entry.recovery >= 67 ? '#4ade80' : entry.recovery >= 34 ? '#facc15' : '#f87171'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {chartData.some(d => d.strain != null) && (
                        <div>
                          <p className="text-[9px] text-muted-foreground font-semibold mb-1">Strain</p>
                          <ResponsiveContainer width="100%" height={60}>
                            <AreaChart data={chartData}>
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                              <Tooltip {...tipStyle} />
                              <Area type="monotone" dataKey="strain" stroke="#facc15" fill="#facc15" fillOpacity={0.15} strokeWidth={2} dot={{ r: 2, fill: '#facc15' }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {chartData.some(d => d.calories != null) && (
                        <div>
                          <p className="text-[9px] text-muted-foreground font-semibold mb-1">{lang === 'en' ? 'Calories' : 'Калории'}</p>
                          <ResponsiveContainer width="100%" height={60}>
                            <AreaChart data={chartData}>
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                              <Tooltip {...tipStyle} />
                              <Area type="monotone" dataKey="calories" stroke="#fb923c" fill="#fb923c" fillOpacity={0.15} strokeWidth={2} dot={{ r: 2, fill: '#fb923c' }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {chartData.some(d => d.hr != null) && (
                        <div>
                          <p className="text-[9px] text-muted-foreground font-semibold mb-1">{lang === 'en' ? 'Avg Heart Rate' : 'Ср. пульс'}</p>
                          <ResponsiveContainer width="100%" height={60}>
                            <AreaChart data={chartData}>
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                              <Tooltip {...tipStyle} />
                              <Area type="monotone" dataKey="hr" stroke="#f87171" fill="#f87171" fillOpacity={0.15} strokeWidth={2} dot={{ r: 2, fill: '#f87171' }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {chartData.some(d => d.sleep != null) && (
                        <div>
                          <p className="text-[9px] text-muted-foreground font-semibold mb-1">{lang === 'en' ? 'Sleep (hours)' : 'Сон (часы)'}</p>
                          <ResponsiveContainer width="100%" height={60}>
                            <BarChart data={chartData} barSize={14}>
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                              <Tooltip {...tipStyle} />
                              <Bar dataKey="sleep" fill="#60a5fa" radius={[4, 4, 0, 0]} fillOpacity={0.7} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            )}
          </div>
        )}
        </div>
      ) : (
        <div className="bg-background border border-border/50 rounded-2xl p-4 text-center">
          <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {lang === 'en' ? 'No data yet. Wear your Whoop!' : 'Пока нет данных. Носите Whoop!'}
          </p>
        </div>
      )}
    </div>
  );
};

export default WhoopWidget;
