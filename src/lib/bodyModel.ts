export const BODY_PILOT_USER_ID = '44603818-a227-4ccc-a75a-b1b074b84015';

export function canViewBodyPilot(userId: string | undefined, isTrainer: boolean, ownClientView: boolean) {
  return isTrainer && ownClientView && userId === BODY_PILOT_USER_ID;
}

export const BODY_METRICS = [
  { key: 'weight_kg', en: 'Weight', ru: 'Вес', unit: 'kg', unitRu: 'кг', hintEn: 'Total body weight', hintRu: 'Общий вес тела' },
  { key: 'chest_cm', en: 'Chest', ru: 'Грудь', unit: 'cm', unitRu: 'см', hintEn: 'Circumference at the fullest part of the chest', hintRu: 'Обхват по самой широкой части груди' },
  { key: 'waist_cm', en: 'Waist', ru: 'Талия', unit: 'cm', unitRu: 'см', hintEn: 'Circumference at the narrowest part of the waist', hintRu: 'Обхват по самой узкой части талии' },
  { key: 'hips_cm', en: 'Hips', ru: 'Бёдра', unit: 'cm', unitRu: 'см', hintEn: 'Circumference at the fullest part of the hips', hintRu: 'Обхват по самой широкой части бёдер' },
  { key: 'left_arm_cm', en: 'Left arm', ru: 'Левая рука', unit: 'cm', unitRu: 'см', hintEn: 'Upper-arm circumference, arm relaxed', hintRu: 'Обхват плеча, рука расслаблена' },
  { key: 'right_arm_cm', en: 'Right arm', ru: 'Правая рука', unit: 'cm', unitRu: 'см', hintEn: 'Upper-arm circumference, arm relaxed', hintRu: 'Обхват плеча, рука расслаблена' },
  { key: 'left_leg_cm', en: 'Left thigh', ru: 'Левое бедро', unit: 'cm', unitRu: 'см', hintEn: 'Circumference of the upper thigh', hintRu: 'Обхват верхней части бедра' },
  { key: 'right_leg_cm', en: 'Right thigh', ru: 'Правое бедро', unit: 'cm', unitRu: 'см', hintEn: 'Circumference of the upper thigh', hintRu: 'Обхват верхней части бедра' },
] as const;

export type BodyMetric = typeof BODY_METRICS[number]['key'];
export type BodyValues = Record<BodyMetric, number | null>;
export type BodyMeasurement = BodyValues & { id: string; measured_at: string };

// Illustrative history only. Never written to the database or treated as the trainer's measurements.
export const DEMO_BODY_HISTORY: BodyMeasurement[] = [
  { id: 'demo-1', measured_at: '2026-07-18', weight_kg: 94, chest_cm: 110, waist_cm: 102, hips_cm: 108, left_arm_cm: 37, right_arm_cm: 38, left_leg_cm: 64, right_leg_cm: 65 },
  { id: 'demo-2', measured_at: '2026-08-18', weight_kg: 91, chest_cm: 108, waist_cm: 98, hips_cm: 105, left_arm_cm: 37.5, right_arm_cm: 38.5, left_leg_cm: 63, right_leg_cm: 64 },
  { id: 'demo-3', measured_at: '2026-09-18', weight_kg: 87, chest_cm: 106, waist_cm: 92, hips_cm: 102, left_arm_cm: 38, right_arm_cm: 39, left_leg_cm: 61, right_leg_cm: 62 },
  { id: 'demo-4', measured_at: '2026-10-18', weight_kg: 84, chest_cm: 105, waist_cm: 86, hips_cm: 99, left_arm_cm: 38.5, right_arm_cm: 39.5, left_leg_cm: 60, right_leg_cm: 61 },
];

export function interpolateBody(a: BodyValues, b: BodyValues, t: number): BodyValues {
  const fraction = Math.max(0, Math.min(1, t));
  return Object.fromEntries(BODY_METRICS.map(({ key }) => {
    const start = a[key], end = b[key];
    return [key, start == null || end == null ? (fraction < 1 ? start : end) : start + (end - start) * fraction];
  })) as BodyValues;
}

export function bodyRatio(current: number | null, baseline: number | null) {
  if (current == null || baseline == null || baseline <= 0 || current <= 0) return 1;
  return Math.max(0.65, Math.min(1.4, current / baseline));
}

export function bodyRegion(x: number, y: number): BodyMetric | null {
  if (y > 1.76 || y < 0.35) return null;
  if (Math.abs(x) > 0.31 && y > 1.0) return x > 0 ? 'left_arm_cm' : 'right_arm_cm';
  if (y > 1.43) return 'chest_cm';
  if (y > 1.18) return 'waist_cm';
  if (y > 0.98) return 'hips_cm';
  return x > 0 ? 'left_leg_cm' : 'right_leg_cm';
}

export function formatBodyDate(date: string, lang: string) {
  const value = date.includes('T') ? new Date(date) : new Date(`${date}T12:00:00`);
  return value.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Nicosia' });
}