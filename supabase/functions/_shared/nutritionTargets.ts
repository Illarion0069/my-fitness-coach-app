export interface NutritionParameters {
  height_cm?: number | null;
  weight_kg?: number | null;
  birth_date?: string | null;
  gender?: string | null;
  nutrition_goal?: string | null;
  daily_calorie_goal?: number | null;
  calorie_goal_auto?: boolean;
}

/** Shared by the browser and AI: never infer missing body data. */
export function calculateNutritionTargets(profile: NutritionParameters | null, latestWeight?: number | null, baselineAnswers?: number[] | null, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Nicosia' })) {
  const positive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;
  const weightKg = positive(latestWeight) || positive(profile?.weight_kg);
  const heightCm = positive(profile?.height_cm);
  const gender = profile?.gender === 'male' || profile?.gender === 'female' ? profile.gender : '';
  const goal = profile?.nutrition_goal === 'muscle_gain' ? 'muscle_gain' : 'fat_loss';
  let age = 0;
  if (profile?.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(profile.birth_date)) {
    const [year, month, day] = profile.birth_date.split('-').map(Number);
    const [currentYear, currentMonth, currentDay] = today.split('-').map(Number);
    age = currentYear - year - (currentMonth < month || (currentMonth === month && currentDay < day) ? 1 : 0);
    if (age < 18 || age > 100) age = 0;
  }
  // Baseline questions 6 and 9 record exercise frequency and daily steps.
  const exercise = baselineAnswers?.[6];
  const steps = baselineAnswers?.[9];
  const exerciseFactor = exercise === 0 ? 1.2 : exercise === 1 ? 1.375 : exercise === 2 ? 1.55 : exercise === 3 ? 1.725 : 0;
  const stepsFactor = steps === 0 ? 1.2 : steps === 1 ? 1.375 : steps === 2 ? 1.55 : steps === 3 ? 1.725 : 0;
  const activityFactor = Math.max(exerciseFactor, stepsFactor) || 1.5;
  const activityEstimated = !exerciseFactor || !stepsFactor;
  const bmi = weightKg && heightCm ? Math.round(weightKg / (heightCm / 100) ** 2 * 10) / 10 : 0;
  const bmr = weightKg && heightCm && age && gender
    ? Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (gender === 'male' ? 5 : -161)) : 0;
  const tdee = bmr ? Math.round(bmr * activityFactor) : 0;
  const estimatedCalories = tdee ? Math.round(tdee * (goal === 'muscle_gain' ? 1.1 : 0.85) / 10) * 10 : 0;
  const manualCalories = profile?.calorie_goal_auto === false ? positive(profile.daily_calorie_goal) : 0;
  const calories = manualCalories || estimatedCalories;
  const protein = weightKg ? Math.round(weightKg * (goal === 'muscle_gain' ? 1.8 : 1.6)) : 0;
  const fat = calories ? Math.round(calories * 0.28 / 9) : 0;
  const carbs = calories && protein && fat ? Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4)) : 0;
  const water = weightKg ? Math.round(weightKg * 33 / 50) * 50 : 0;
  return { calories, protein, fat, carbs, fiber: 30, water, weightKg, heightCm, gender, age, goal, bmi, bmr, tdee, activityFactor, activityEstimated, manualCalories: Boolean(manualCalories) };
}