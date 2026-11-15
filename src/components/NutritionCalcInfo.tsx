import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator, Scale, Ruler, Droplets, UtensilsCrossed, Activity,
  ChevronRight, Flame, Target, Info, User, CalendarDays,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNutritionTargets } from '@/hooks/useNutritionTargets';

interface Props {
  userId: string;
}

interface ProfileData {
  full_name: string | null;
  height_cm: number | null;
  birth_date: string | null;
  gender: string | null;
  nutrition_goal: string | null;
}

interface MeasurementData {
  weight_kg: number | null;
  measured_at: string | null;
}

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card border border-border/40 rounded-2xl p-4 mb-4"
  >
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
    </div>
    <div className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
      {children}
    </div>
  </motion.div>
);

const FormulaBox = ({ children, label }: { children: React.ReactNode; label?: string }) => (
  <div className="rounded-xl bg-secondary/40 border border-border/30 p-3 font-mono text-[11px] text-foreground overflow-x-auto">
    {label && <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>}
    {children}
  </div>
);

const MockRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
    <span className="text-[10px] text-muted-foreground">{label}</span>
    <span className={`text-[11px] font-semibold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</span>
  </div>
);

export default function NutritionCalcInfo({ userId }: Props) {
  const { lang } = useLanguage();
  const en = lang === 'en';

  const targets = useNutritionTargets(userId);
  const { heightCm, weightKg, gender, age, bmi, bmr, tdee, goal, activityFactor } = targets;
  const targetKcal = targets.calories;
  const proteinTarget = targets.protein;
  const waterTargetMl = targets.water;
  const loading = false;

  const t = {
    title: en ? 'How we calculate calories' : 'Как мы считаем калории',
    subtitle: en
      ? 'Every number in your dashboard comes from your body data + the food you log. Here is exactly how it works.'
      : 'Каждая цифра в кабинете берётся из данных вашего тела + еды, которую вы добавляете. Вот точная логика.',
    yourData: en ? 'Your data right now' : 'Ваши данные сейчас',
    sources: en ? 'Where the data comes from' : 'Откуда берутся данные',
    bmrTitle: en ? '1. Basal metabolic rate (BMR)' : '1. Основной обмен (BMR)',
    bmrText: en
      ? 'This is how many calories your body burns at complete rest. We use the Mifflin–St Jeor equation, which is considered one of the most accurate for adults.'
      : 'Это количество калорий, которое ваше тело сжигает в полном покое. Мы используем формулу Миффлина — Сан Жеора — одну из самых точных для взрослых.',
    tdeeTitle: en ? '2. Total daily energy expenditure (TDEE)' : '2. Общий расход энергии (TDEE)',
    tdeeText: en
      ? 'The activity estimate uses your questionnaire answers about exercise and daily steps. Without answers, the estimated factor is 1.5.'
      : 'Активность оценивается по ответам анкеты о тренировках и ежедневных шагах. Без ответов используется ориентировочный коэффициент 1,5.',
    targetTitle: en ? '3. Your personal calorie target' : '3. Ваша цель по калориям',
    targetText: en
      ? 'Your trainer’s personal calorie target takes priority. In automatic mode: a 15% deficit for fat loss or a 10% surplus for muscle gain.'
      : 'Индивидуальная норма, установленная тренером, имеет приоритет. В автоматическом режиме: дефицит 15% для снижения веса или профицит 10% для набора мышц.',
    macrosTitle: en ? '4. Macros & water' : '4. БЖУ и вода',
    macrosText: en
      ? 'Protein is 1.6 g/kg for fat loss or 1.8 g/kg for muscle gain. Fat is 28% of your calorie target; carbs use the remaining calories. Water is 33 ml/kg. Missing body data is not invented.'
      : 'Белок — 1,6 г/кг для снижения веса или 1,8 г/кг для набора мышц. Жиры — 28% нормы калорий; углеводы — оставшиеся калории. Вода — 33 мл/кг. Отсутствующие параметры не выдумываются.',
    analysisTitle: en ? '5. From numbers to advice' : '5. От цифр к советам',
    analysisText: en
      ? 'Every time you post a meal, the AI compares your day against your personal targets: calories, protein, portions, meal timing, vegetables, processed food and late-night carbs. Recommendations are based on your body data, not generic templates.'
      : 'Каждый раз, когда вы добавляете приём пищи, ИИ сравнивает день с вашими личными целями: калории, белок, порции, время еды, овощи, обработанная еда и поздние углеводы. Советы основываются на данных вашего тела, а не на шаблонах.',
    syncTitle: en ? '6. Sync with body measurements' : '6. Связь с замерами тела',
    syncText: en
      ? 'Your latest weight is pulled from Body Measurements. Height, age and gender come from your profile. When you update any of these, your calorie and macro targets update automatically.'
      : 'Актуальный вес берётся из раздела «Замеры тела». Рост, возраст и пол — из профиля. Когда вы обновляете любой из этих параметров, цели по калориям и БЖУ пересчитываются автоматически.',
    disclaimer: en
      ? 'All numbers are estimates for guidance, not medical prescriptions.'
      : 'Все цифры — оценки для ориентира, а не медицинские предписания.',
  };

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-xl font-heading uppercase tracking-wide text-foreground mb-1.5">{t.title}</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">{t.subtitle}</p>
      </div>

      {/* Personal data card */}
      <Section icon={<User className="w-4 h-4" />} title={t.yourData}>
        {loading ? (
          <p className="text-xs text-muted-foreground">{en ? 'Loading your data…' : 'Загружаем ваши данные…'}</p>
        ) : (
          <>
            <div className="bg-secondary/30 rounded-xl p-3 border border-border/30 mb-3">
              <MockRow label={en ? 'Height' : 'Рост'} value={heightCm > 0 ? `${heightCm} cm` : en ? 'Not set' : 'Не указан'} />
              <MockRow label={en ? 'Weight' : 'Вес'} value={weightKg > 0 ? `${weightKg} kg` : en ? 'Not set' : 'Не указан'} highlight={weightKg > 0} />
              <MockRow label={en ? 'Age' : 'Возраст'} value={age > 0 ? `${age}` : en ? 'Not set' : 'Не указан'} />
              <MockRow label={en ? 'Gender' : 'Пол'} value={gender === 'male' ? (en ? 'Male' : 'Мужской') : gender === 'female' ? (en ? 'Female' : 'Женский') : en ? 'Not set' : 'Не указан'} />
              <MockRow label={en ? 'BMI' : 'ИМТ'} value={bmi > 0 ? String(bmi) : en ? '—' : '—'} />
              <MockRow label={en ? 'Goal' : 'Цель'} value={goal === 'muscle_gain' ? (en ? 'Muscle gain' : 'Набор мышц') : (en ? 'Fat loss' : 'Похудение')} highlight />
            </div>

            {(bmr > 0 || targetKcal > 0 || proteinTarget > 0) && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-primary/10 rounded-xl p-3 border border-primary/20">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{en ? 'BMR' : 'BMR'}</div>
                  <div className="text-lg font-bold text-primary">{bmr > 0 ? `${bmr}` : '—'}</div>
                  <div className="text-[10px] text-muted-foreground">{en ? 'kcal/day rest' : 'ккал/день в покое'}</div>
                </div>
                <div className="bg-primary/10 rounded-xl p-3 border border-primary/20">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{en ? 'TDEE' : 'TDEE'}</div>
                  <div className="text-lg font-bold text-primary">{tdee > 0 ? `${tdee}` : '—'}</div>
                  <div className="text-[10px] text-muted-foreground">{en ? 'kcal/day total' : 'ккал/день всего'}</div>
                </div>
                <div className="bg-primary/10 rounded-xl p-3 border border-primary/20">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{en ? 'Target' : 'Цель'}</div>
                  <div className="text-lg font-bold text-primary">{targetKcal > 0 ? `${targetKcal}` : '—'}</div>
                  <div className="text-[10px] text-muted-foreground">{en ? 'kcal/day' : 'ккал/день'}</div>
                </div>
                <div className="bg-primary/10 rounded-xl p-3 border border-primary/20">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{en ? 'Protein' : 'Белок'}</div>
                  <div className="text-lg font-bold text-primary">{proteinTarget > 0 ? `${proteinTarget}` : '—'}</div>
                  <div className="text-[10px] text-muted-foreground">{en ? 'g/day' : 'г/день'}</div>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      {/* Data sources */}
      <Section icon={<Info className="w-4 h-4" />} title={t.sources}>
        <div className="space-y-2">
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Ruler className="w-2.5 h-2.5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">{en ? 'Profile' : 'Профиль'}</p>
              <p className="text-[11px] text-muted-foreground">{en ? 'Height, age, gender, nutrition goal' : 'Рост, возраст, пол, цель питания'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Scale className="w-2.5 h-2.5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">{en ? 'Body Measurements' : 'Замеры тела'}</p>
              <p className="text-[11px] text-muted-foreground">{en ? 'Latest weight and waist/hips dynamics' : 'Актуальный вес и динамика талии/бёдер'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <UtensilsCrossed className="w-2.5 h-2.5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">{en ? 'Nutrition Diary' : 'Дневник питания'}</p>
              <p className="text-[11px] text-muted-foreground">{en ? 'Food photos and manual entries' : 'Фото еды и ручные записи'}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* 1. BMR */}
      <Section icon={<Flame className="w-4 h-4" />} title={t.bmrTitle}>
        <p>{t.bmrText}</p>
        <FormulaBox label={en ? 'Formula' : 'Формула'}>
          <div className="space-y-1">
            <p>{en ? 'Men: BMR = 10×weight(kg) + 6.25×height(cm) − 5×age(y) + 5' : 'Мужчины: BMR = 10×вес(кг) + 6,25×рост(см) − 5×возраст(л) + 5'}</p>
            <p>{en ? 'Women: BMR = 10×weight(kg) + 6.25×height(cm) − 5×age(y) − 161' : 'Женщины: BMR = 10×вес(кг) + 6,25×рост(см) − 5×возраст(л) − 161'}</p>
          </div>
        </FormulaBox>
      </Section>

      {/* 2. TDEE */}
      <Section icon={<Activity className="w-4 h-4" />} title={t.tdeeTitle}>
        <p>{t.tdeeText}</p>
        <FormulaBox label={en ? 'Formula' : 'Формула'}>
          TDEE = BMR × {activityFactor}
        </FormulaBox>
      </Section>

      {/* 3. Target */}
      <Section icon={<Target className="w-4 h-4" />} title={t.targetTitle}>
        <p>{t.targetText}</p>
        <FormulaBox label={en ? 'Formula' : 'Формула'}>
          <div className="space-y-1">
            <p>{en ? 'Fat loss: Target = TDEE × 0.85' : 'Похудение: Цель = СДП × 0,85'}</p>
            <p>{en ? 'Muscle gain: Target = TDEE × 1.10' : 'Набор мышц: Цель = СДП × 1,10'}</p>
          </div>
        </FormulaBox>
      </Section>

      {/* 4. Macros */}
      <Section icon={<Scale className="w-4 h-4" />} title={t.macrosTitle}>
        <p>{t.macrosText}</p>
        <FormulaBox label={en ? 'Example split' : 'Пример распределения'}>
          <div className="space-y-1">
            <p>{en ? 'Protein = weight × 1.6 / 1.8' : 'Белок = вес × 1,6 / 1,8'}</p>
            <p>{en ? 'Carbs = (kcal − protein × 4 − fat × 9) ÷ 4' : 'Углеводы = (ккал − белок × 4 − жиры × 9) ÷ 4'}</p>
            <p>{en ? 'Fat = 28% of target kcal ÷ 9' : 'Жиры = 28% целевых ккал ÷ 9'}</p>
          </div>
        </FormulaBox>
      </Section>

      {/* 5. Analysis */}
      <Section icon={<Calculator className="w-4 h-4" />} title={t.analysisTitle}>
        <p>{t.analysisText}</p>
        <div className="bg-secondary/30 rounded-xl p-3 border border-border/30 space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-foreground">
            <ChevronRight className="w-3.5 h-3.5 text-primary" />
            {en ? 'Photo → AI detects food, portions and macros' : 'Фото → ИИ распознаёт еду, порции и БЖУ'}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-foreground">
            <ChevronRight className="w-3.5 h-3.5 text-primary" />
            {en ? 'Manual entries are merged with photo data' : 'Ручные записи объединяются с данными фото'}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-foreground">
            <ChevronRight className="w-3.5 h-3.5 text-primary" />
            {en ? 'Day score is built from meal scores (breakfast 30%, lunch 35%, dinner 25%, snacks 10%)' : 'Оценка дня складывается из приёмов пищи (завтрак 30%, обед 35%, ужин 25%, перекусы 10%)'}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-foreground">
            <ChevronRight className="w-3.5 h-3.5 text-primary" />
            {en ? 'Recommendations use your calorie target, protein target and body data' : 'Советы используют вашу цель по калориям, белку и данные тела'}
          </div>
        </div>
      </Section>

      {/* 6. Sync */}
      <Section icon={<CalendarDays className="w-4 h-4" />} title={t.syncTitle}>
        <p>{t.syncText}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
          <Droplets className="w-3.5 h-3.5 text-primary" />
          {en ? `Water target example: ${weightKg > 0 ? waterTargetMl : '—'} ml/day` : `Пример нормы воды: ${weightKg > 0 ? waterTargetMl : '—'} мл/день`}
        </div>
      </Section>

      <p className="text-[10px] text-muted-foreground italic text-center px-2">{t.disclaimer}</p>
    </div>
  );
}
