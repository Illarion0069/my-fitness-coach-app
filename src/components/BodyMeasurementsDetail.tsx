import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Measurement {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_leg_cm: number | null;
  right_leg_cm: number | null;
  notes: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  measurements: Measurement[];
  lang: string;
}

const METRICS = [
  { key: 'weight_kg', en: 'Weight', ru: 'Вес', unit: 'kg' },
  { key: 'chest_cm', en: 'Chest', ru: 'Грудь', unit: 'cm' },
  { key: 'waist_cm', en: 'Waist', ru: 'Талия', unit: 'cm' },
  { key: 'hips_cm', en: 'Hips', ru: 'Бёдра', unit: 'cm' },
  { key: 'left_arm_cm', en: 'L.Arm', ru: 'Л.Рука', unit: 'cm' },
  { key: 'right_arm_cm', en: 'R.Arm', ru: 'П.Рука', unit: 'cm' },
  { key: 'left_leg_cm', en: 'L.Leg', ru: 'Л.Нога', unit: 'cm' },
  { key: 'right_leg_cm', en: 'R.Leg', ru: 'П.Нога', unit: 'cm' },
] as const;

type MetricKey = typeof METRICS[number]['key'];

const TIME_RANGES = [
  { key: '3m', en: '3 mon', ru: '3 мес', months: 3 },
  { key: '6m', en: '6 mon', ru: '6 мес', months: 6 },
  { key: '1y', en: '1 year', ru: '1 год', months: 12 },
  { key: 'all', en: 'All', ru: 'Все', months: 999 },
];

const BodyMeasurementsDetail = ({ open, onClose, measurements, lang }: Props) => {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('weight_kg');
  const [timeRange, setTimeRange] = useState('all');

  const metric = METRICS.find(m => m.key === activeMetric)!;
  const range = TIME_RANGES.find(r => r.key === timeRange)!;

  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - range.months);
    return measurements
      .filter(m => {
        const val = m[activeMetric as keyof Measurement] as number | null;
        if (val == null) return false;
        if (range.months < 999) return new Date(m.measured_at) >= cutoff;
        return true;
      })
      .slice()
      .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());
  }, [measurements, activeMetric, timeRange, range.months]);

  const chartData = useMemo(() => {
    return filtered.map(m => ({
      date: new Date(m.measured_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short' }),
      value: m[activeMetric as keyof Measurement] as number,
    }));
  }, [filtered, activeMetric, lang]);

  const grouped = useMemo(() => {
    const sorted = [...measurements]
      .filter(m => (m[activeMetric as keyof Measurement] as number | null) != null)
      .sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime());

    const groups: { label: string; items: Measurement[] }[] = [];
    sorted.forEach(m => {
      const d = new Date(m.measured_at);
      const label = d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { month: 'long', year: 'numeric' });
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(m);
      } else {
        groups.push({ label, items: [m] });
      }
    });
    return groups;
  }, [measurements, activeMetric, lang]);

  // Min/max for Y axis
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    const vals = chartData.map(d => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.15, 2);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [chartData]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    return last - first;
  }, [chartData]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="measurements-detail"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-background flex flex-col"
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 border-b border-border/30"
            style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)' }}
          >
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-base font-bold font-heading flex-1">
              {lang === 'en' ? 'Body Progress' : 'Замеры тела'}
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Metric tabs — horizontal scroll */}
          <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto no-scrollbar">
            {METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeMetric === m.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60'
                }`}
              >
                {lang === 'en' ? m.en : m.ru}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Current value + trend */}
            {chartData.length > 0 && (
              <div className="px-4 pb-2 flex items-end gap-2">
                <span className="text-3xl font-extrabold font-heading">
                  {chartData[chartData.length - 1].value}
                </span>
                <span className="text-sm text-muted-foreground mb-1">{metric.unit}</span>
                {trend != null && (
                  <span className={`flex items-center gap-0.5 text-xs font-bold mb-1 ${
                    trend < 0 ? 'text-green-400' : trend > 0 ? 'text-red-400' : 'text-muted-foreground'
                  }`}>
                    {trend < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : trend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                    {trend > 0 ? '+' : ''}{trend.toFixed(1)}
                  </span>
                )}
              </div>
            )}

            {/* Time range pills */}
            <div className="flex gap-1.5 px-4 pb-3">
              {TIME_RANGES.map(r => (
                <button
                  key={r.key}
                  onClick={() => setTimeRange(r.key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    timeRange === r.key
                      ? 'bg-primary/20 text-primary border border-primary/40'
                      : 'bg-secondary/30 text-muted-foreground'
                  }`}
                >
                  {lang === 'en' ? r.en : r.ru}
                </button>
              ))}
            </div>

            {/* Chart */}
            <div className="px-2 pb-4">
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 5, right: 15, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={yDomain}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                  {lang === 'en' ? 'Not enough data for chart' : 'Недостаточно данных для графика'}
                </div>
              )}
            </div>

            {/* History grouped by month */}
            <div className="px-4 pb-8 space-y-4">
              {grouped.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {lang === 'en' ? 'No measurements yet' : 'Замеров пока нет'}
                </p>
              )}
              {grouped.map(g => (
                <div key={g.label}>
                  <p className="text-xs font-bold text-foreground capitalize mb-1.5">{g.label}</p>
                  <div className="space-y-1">
                    {g.items.map((m, i) => {
                      const val = m[activeMetric as keyof Measurement] as number;
                      const nextVal = g.items[i + 1]
                        ? (g.items[i + 1][activeMetric as keyof Measurement] as number | null)
                        : null;
                      return (
                        <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/20">
                          <span className="text-sm text-muted-foreground">
                            {new Date(m.measured_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg font-extrabold">{val}</span>
                            <span className="text-[10px] text-muted-foreground">{metric.unit}</span>
                            {nextVal != null && (
                              <span className={`text-[10px] font-bold ${
                                val > nextVal ? 'text-red-400' : val < nextVal ? 'text-green-400' : 'text-muted-foreground'
                              }`}>
                                {val > nextVal ? '+' : ''}{(val - nextVal).toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BodyMeasurementsDetail;
