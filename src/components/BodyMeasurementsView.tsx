import { useEffect, useState } from 'react';
import { Ruler, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import BodyMeasurementsDetail from './BodyMeasurementsDetail';

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
  userId: string;
  lang: string;
  editable?: boolean;
}

const FIELDS = [
  { key: 'weight_kg', en: 'Weight', ru: 'Вес', unit: 'kg' },
  { key: 'chest_cm', en: 'Chest', ru: 'Грудь', unit: 'cm' },
  { key: 'waist_cm', en: 'Waist', ru: 'Талия', unit: 'cm' },
  { key: 'hips_cm', en: 'Hips', ru: 'Бёдра', unit: 'cm' },
  { key: 'left_arm_cm', en: 'Left arm', ru: 'Лев. рука', unit: 'cm' },
  { key: 'right_arm_cm', en: 'Right arm', ru: 'Прав. рука', unit: 'cm' },
  { key: 'left_leg_cm', en: 'Left leg', ru: 'Лев. нога', unit: 'cm' },
  { key: 'right_leg_cm', en: 'Right leg', ru: 'Прав. нога', unit: 'cm' },
] as const;

const TrendIcon = ({ current, previous }: { current: number | null; previous: number | null }) => {
  if (current == null || previous == null) return null;
  if (current < previous) return <TrendingDown className="w-3 h-3 text-green-400" />;
  if (current > previous) return <TrendingUp className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
};

const BodyMeasurementsView = ({ userId, lang, editable = false }: Props) => {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', userId)
      .order('measured_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMeasurements((data || []) as Measurement[]);
        setLoading(false);
      });
  }, [userId, reloadKey]);


  if (loading) return null;
  if (measurements.length === 0) {
    return (
      <div className="text-center py-4">
        <Ruler className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">
          {lang === 'en' ? 'No measurements yet' : 'Замеров пока нет'}
        </p>
      </div>
    );
  }

  const latest = measurements[0];
  const prev = measurements[1];

  return (
    <>
      <div className="space-y-3">
        {/* Latest measurements card — clickable */}
        <button
          onClick={() => setDetailOpen(true)}
          className="w-full text-left bg-background border border-border/50 rounded-xl p-3 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              {lang === 'en' ? 'Latest' : 'Последние'} — {new Date(latest.measured_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <div className="flex items-center gap-1 text-primary">
              <span className="text-[10px] font-semibold">{lang === 'en' ? 'Details' : 'Подробнее'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(f => {
              const val = latest[f.key as keyof Measurement] as number | null;
              const prevVal = prev ? (prev[f.key as keyof Measurement] as number | null) : null;
              if (val == null) return null;
              return (
                <div key={f.key} className="flex items-center justify-between bg-secondary/30 rounded-lg px-2.5 py-1.5">
                  <span className="text-[11px] text-muted-foreground">{lang === 'en' ? f.en : f.ru}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold">{val}</span>
                    <TrendIcon current={val} previous={prevVal} />
                  </div>
                </div>
              );
            })}
          </div>
        </button>
      </div>

      <BodyMeasurementsDetail
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        measurements={measurements}
        lang={lang}
        editable={editable}
        userId={userId}
        onChanged={() => setReloadKey(k => k + 1)}
      />


    </>
  );
};

export default BodyMeasurementsView;
