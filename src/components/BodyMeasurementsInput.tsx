import { useState } from 'react';
import { Ruler, Plus, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  userId: string;
  lang: string;
  onSaved?: () => void;
}

const FIELDS = [
  { key: 'weight_kg', en: 'Weight (kg)', ru: 'Вес (кг)', placeholder: '75.0' },
  { key: 'chest_cm', en: 'Chest (cm)', ru: 'Грудь (см)', placeholder: '95.0' },
  { key: 'waist_cm', en: 'Waist (cm)', ru: 'Талия (см)', placeholder: '80.0' },
  { key: 'hips_cm', en: 'Hips (cm)', ru: 'Бёдра (см)', placeholder: '95.0' },
  { key: 'left_arm_cm', en: 'Left arm (cm)', ru: 'Лев. рука (см)', placeholder: '32.0' },
  { key: 'right_arm_cm', en: 'Right arm (cm)', ru: 'Прав. рука (см)', placeholder: '32.5' },
  { key: 'left_leg_cm', en: 'Left leg (cm)', ru: 'Лев. нога (см)', placeholder: '55.0' },
  { key: 'right_leg_cm', en: 'Right leg (cm)', ru: 'Прав. нога (см)', placeholder: '55.5' },
] as const;

const BodyMeasurementsInput = ({ userId, lang, onSaved }: Props) => {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const hasValues = FIELDS.some(f => values[f.key]?.trim());
    if (!hasValues) {
      toast({ title: lang === 'en' ? 'Enter at least one measurement' : 'Введите хотя бы один замер', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const row: Record<string, any> = {
      user_id: userId,
      trainer_user_id: user.id,
      measured_at: date,
    };
    FIELDS.forEach(f => {
      const v = parseFloat(values[f.key] || '');
      if (!isNaN(v)) row[f.key] = v;
    });

    const { error } = await supabase.from('body_measurements').insert(row as any);
    setSaving(false);

    if (error) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: lang === 'en' ? 'Measurements saved' : 'Замеры сохранены' });
      setValues({});
      setShowForm(false);
      onSaved?.();
    }
  };

  return (
    <div className="bg-secondary/30 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
          <Ruler className="w-3 h-3" />
          {lang === 'en' ? 'Body Measurements' : 'Замеры тела'}
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center text-primary hover:bg-primary/30 transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {showForm && (
        <div className="space-y-2 bg-secondary/50 rounded-lg p-2.5">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-background border border-border/50 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary/50"
          />
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(f => (
              <div key={f.key}>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">{lang === 'en' ? f.en : f.ru}</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder={f.placeholder}
                  value={values[f.key] || ''}
                  onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-background border border-border/50 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary/50"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full gradient-primary text-primary-foreground text-xs font-bold py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <Save className="w-3 h-3" />
            {saving ? (lang === 'en' ? 'Saving...' : 'Сохранение...') : (lang === 'en' ? 'Save' : 'Сохранить')}
          </button>
        </div>
      )}
    </div>
  );
};

export default BodyMeasurementsInput;
