import { describe, expect, it } from 'vitest';
import { calculateNutritionTargets } from '../../supabase/functions/_shared/nutritionTargets';

const profile = { height_cm: 180, weight_kg: 80, birth_date: '1990-11-16', gender: 'male', nutrition_goal: 'fat_loss', daily_calorie_goal: 2680, calorie_goal_auto: false };
describe('Individual nutrition targets shared by all views and AI', () => {
  it('uses the client weight for protein, not a calorie percentage', () => {
    expect(calculateNutritionTargets(profile, null, null, '2026-11-15').protein).toBe(128);
  });
  it('preserves the trainer personal calorie target and balances macros consistently', () => {
    expect(calculateNutritionTargets(profile, null, null, '2026-11-15')).toMatchObject({ calories: 2680, protein: 128, fat: 83, carbs: 355, fiber: 30 });
  });
  it('prefers the latest nonempty measurement over signup weight', () => {
    expect(calculateNutritionTargets(profile, 90).protein).toBe(144);
  });
  it('uses the selected muscle goal', () => {
    expect(calculateNutritionTargets({ ...profile, nutrition_goal: 'muscle_gain' }).protein).toBe(144);
  });
  it('uses baseline exercise frequency for automatic calorie targets', () => {
    const auto = { ...profile, calorie_goal_auto: true };
    expect(calculateNutritionTargets(auto, null, [0, 0, 0, 0, 0, 0, 0], '2026-11-15').calories).toBe(1790);
    expect(calculateNutritionTargets(auto, null, [0, 0, 0, 0, 0, 0, 2], '2026-11-15').calories).toBe(2310);
  });
  it('accounts for daily walking from the questionnaire without double counting exercise', () => {
    expect(calculateNutritionTargets({ ...profile, calorie_goal_auto: true }, null, [0, 0, 0, 0, 0, 0, 0, 0, 0, 3], '2026-11-15').calories).toBe(2570);
  });
  it('does not manufacture personal targets without body parameters', () => {
    expect(calculateNutritionTargets(null)).toMatchObject({ calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 });
  });
  it('uses Cyprus date for birthday boundaries', () => {
    expect(calculateNutritionTargets(profile, null, null, '2026-11-15').age).toBe(35);
    expect(calculateNutritionTargets(profile, null, null, '2026-11-16').age).toBe(36);
  });
});