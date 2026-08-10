import { useEffect, useState } from 'react';
import { Ruler, Plus, Save, User } from 'lucide-react';
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

const calcAge = (birthDate: string): number | null => {
  if (!birthDate) return null;
  const bd = new Date(`${birthDate}T12:00:00`);
  if (isNaN(bd.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
  return age >= 5 && age <= 100 ? age : null;
};

const BodyMeasurementsInput = ({ userId, lang, onSaved }: Props) => {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Static profile data (height / birth date / gender) — used for personalised nutrition
  const [heightCm, setHeightCm] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [lastWeight, setLastWeight] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: profile }, { data: measurement }] = await Promise.all([
        supabase.from('profiles').select('height_cm, birth_date, gender').eq('user_id', userId).maybeSingle(),
        supabase
          .from('body_measurements')
          .select('weight_kg')
          .eq('user_id', userId)
          .not('weight_kg', 'is', null)
          .order('measured_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!active) return;
      const p = profile as any;
      setHeightCm(p?.height_cm ? String(p.height_cm) : '');
      setBirthDate(p?.birth_date || '');
      setGender(p?.gender || '');
      setLastWeight((measurement as any)?.weight_kg ?? null);
    })();
    return () => { active = false; };
  }, [userId]);

  const age = calcAge(birthDate);
  const weightForBmi = parseFloat(values.weight_kg || '') || lastWeight || 0;
  const h = parseFloat(heightCm) || 0;
  const bmi = h > 0 && weightForBmi > 0 ? Math.round((weightForBmi / Math.pow(h / 100, 2)) * 10) / 10 : null;
  const bmiLabel = bmi == null ? '' :
    bmi < 18.5 ? (lang === 'en' ? 'underweight' : 'дефицит массы') :
    bmi < 25 ? (lang === 'en' ? 'normal' : 'норма') :
    bmi < 30 ? (lang === 'en' ? 'overweight' : 'избыток') :
    (lang === 'en' ? 'obese' : 'ожирение');

  const saveProfileData = async () => {
    const payload: Record<string, any> = {
      height_cm: heightCm ? Math.round(parseFloat(heightCm)) : null,
      birth_date: birthDate || null,
      gender: gender || null,
    };
    if (payload.height_cm != null && (payload.height_cm < 100 || payload.height_cm > 250)) {
      toast({ title: lang === 'en' ? 'Height must be 100-250 cm' : 'Рост должен быть 100-250 см', variant: 'destructive' });
      return false;
    }
    const { error } = await supabase.from('profiles').update(payload as any).eq('user_id', userId);
    if (error) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: error.message, variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    const profileOk = await saveProfileData();
    if (!profileOk) { setSaving(false); return; }

    const hasValues = FIELDS.some(f => values[f.key]?.trim());
    if (!hasValues) {
      setSaving(false);
      toast({ title: lang === 'en' ? 'Profile saved' : 'Данные профиля сохранены' });
      onSaved?.();
      return;
    }

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

  const inputCls = 'w-full bg-background border border-border/50 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary/50';

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

      {/* Quick summary of static data */}
      {(h > 0 || age != null) && (
        <div className="flex flex-wrap gap-1.5">
          {h > 0 && (
            <span className="text-[10px] bg-secondary/60 rounded-md px-2 py-0.5">
              {lang === 'en' ? 'Height' : 'Рост'}: <b>{h} {lang === 'en' ? 'cm' : 'см'}</b>
            </span>
          )}
          {age != null && (
            <span className="text-[10px] bg-secondary/60 rounded-md px-2 py-0.5">
              {lang === 'en' ? 'Age' : 'Возраст'}: <b>{age}</b>
            </span>
          )}
          {bmi != null && (
            <span className="text-[10px] bg-primary/15 text-primary rounded-md px-2 py-0.5">
              BMI: <b>{bmi}</b> · {bmiLabel}
            </span>
          )}
        </div>
      )}

      {showForm && (
        <div className="space-y-2 bg-secondary/50 rounded-lg p-2.5">
          {/* Static profile block */}
          <div className="space-y-2 bg-background/40 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              <User className="w-3 h-3" />
              {lang === 'en' ? 'Profile (for nutrition targets)' : 'Профиль (для норм питания)'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">
                  {lang === 'en' ? 'Height (cm)' : 'Рост (см)'}
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="178"
                  value={heightCm}
                  onChange={e => setHeightCm(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">
                  {lang === 'en' ? 'Date of birth' : 'Дата рождения'}
                  {age != null && <span className="text-primary"> · {age}</span>}
                </label>
                <input
                  type="date"
                  value={birthDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setBirthDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">
                {lang === 'en' ? 'Gender' : 'Пол'}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { v: 'male', en: 'Male', ru: 'Муж' },
                  { v: 'female', en: 'Female', ru: 'Жен' },
                  { v: '', en: 'Not set', ru: 'Не указан' },
                ].map(g => (
                  <button
                    key={g.v || 'none'}
                    type="button"
                    onClick={() => setGender(g.v)}
                    className={`text-[11px] py-1.5 rounded-lg border transition-colors ${
                      gender === g.v
                        ? 'border-primary/60 bg-primary/15 text-primary font-semibold'
                        : 'border-border/50 bg-background text-muted-foreground'
                    }`}
                  >
                    {lang === 'en' ? g.en : g.ru}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={inputCls}
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
                  className={inputCls}
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
