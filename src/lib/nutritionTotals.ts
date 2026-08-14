/**
 * Single source of truth for computing daily nutrition totals from a nutrition_logs row.
 *
 * Deduplication rules (must match what the AI analyzer produces):
 *  - If AI analysis is present and not invalidated, its `total_*` fields already include:
 *      a) all foods detected from photos
 *      b) any manual text entries whose IDs are listed in `included_manual_ids`
 *  - Manual entries linked to a photo (`photo_id` set) are also implicitly included by the AI.
 *  - All other manual entries are added on top.
 *
 * Keep this in sync with supabase/functions/analyze-nutrition (writer) and NutritionDiary UI.
 */

export interface ManualEntryLike {
  id?: string;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  photo_id?: string | null;
  [k: string]: any;
}

export interface NutritionLogLike {
  ai_analysis?: any;
  manual_entries?: ManualEntryLike[] | any;
}

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Calories coming from logged liquids.
 * Assumptions (kept in sync with supabase/functions/analyze-nutrition):
 *  - water: 0 kcal
 *  - coffee: 20 kcal / cup (allows for a splash of milk)
 *  - tea: 5 kcal / cup
 *  - alcohol: 0.6 kcal / ml (average of wine/beer/spirits mixes)
 */
export const LIQUID_KCAL = { coffeeCup: 20, teaCup: 5, alcoholMl: 0.6 } as const;

export function computeLiquidCalories(log: any): number {
  if (!log) return 0;
  const coffee = Number(log.coffee_cups) || 0;
  const tea = Number(log.tea_cups) || 0;
  const alcohol = Number(log.alcohol_ml) || 0;
  return Math.round(coffee * LIQUID_KCAL.coffeeCup + tea * LIQUID_KCAL.teaCup + alcohol * LIQUID_KCAL.alcoholMl);
}

export function computeNutritionTotals(log: NutritionLogLike | null | undefined): NutritionTotals {
  let calories = 0, protein = 0, carbs = 0, fat = 0;


  const analysis: any = log?.ai_analysis;
  const aiActive = analysis && !analysis.invalidated;

  if (aiActive) {
    if (Number(analysis.total_calories) > 0) {
      calories += Number(analysis.total_calories) || 0;
      protein  += Number(analysis.total_protein_g) || 0;
      carbs    += Number(analysis.total_carbs_g)   || 0;
      fat      += Number(analysis.total_fat_g)     || 0;
    } else if (Array.isArray(analysis.meals)) {
      for (const m of analysis.meals) {
        calories += Number(m?.estimated_calories) || 0;
        protein  += Number(m?.protein_g) || 0;
        carbs    += Number(m?.carbs_g)   || 0;
        fat      += Number(m?.fat_g)     || 0;
      }
    }
  }

  const hasIncludedList = aiActive && Array.isArray(analysis.included_manual_ids);
  const includedIds = new Set<string>(hasIncludedList ? analysis.included_manual_ids : []);
  const manual: ManualEntryLike[] = Array.isArray(log?.manual_entries) ? log!.manual_entries : [];

  for (const e of manual) {
    // AI already counted this manual entry in its totals
    if (e?.id && includedIds.has(e.id)) continue;
    // Legacy analyses without included_manual_ids: assume all photo-detected items were counted
    if (aiActive && !hasIncludedList && e?.photo_id) continue;
    // New entries (photo or manual) added AFTER the last analysis are counted immediately
    calories += Number(e?.calories) || 0;
    protein  += Number(e?.protein_g) || 0;
    carbs    += Number(e?.carbs_g)   || 0;
    fat      += Number(e?.fat_g)     || 0;
  }

  // Liquids (coffee / tea / alcohol) always count toward the day's calories.
  // AI totals are food-only (totals_source = "manual_entries"), so no double counting.
  calories += computeLiquidCalories(log);

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };

}
