import { mealTotals, uid, type Meal } from '../types';

export type MealDraft = {
  id: string; existing?: boolean; date: string; name: string; type: Meal['type'];
  grams: string; referenceGrams: string; kcal: string; protein: string; carbs: string; fat: string;
  source: Meal['source']; assetId?: string; aiDraftId?: string; aiItemIndex?: number; createdAt: string;
};

export const newMealDraft = (date: string): MealDraft => ({
  id: uid(), createdAt: new Date().toISOString(), date, name: '', type: 'lunch',
  grams: '100', referenceGrams: '100', kcal: '', protein: '', carbs: '', fat: '', source: 'manual',
});

/** Reuse reviewed label/manual values, never another meal's photo or AI provenance. */
export function reuseMealDraft(meal: Meal, date: string): MealDraft {
  if (meal.source === 'ai_estimate') throw Error('Reopen the AI record to review its original estimate.');
  return { ...newMealDraft(date), name: meal.name, type: meal.type, source: meal.source,
    grams: String(meal.grams), referenceGrams: String(meal.referenceGrams), kcal: String(meal.kcal),
    protein: String(meal.protein), carbs: String(meal.carbs), fat: String(meal.fat) };
}

export function recentReusableMeals(meals: Meal[]): Meal[] {
  const seen = new Set<string>();
  return [...meals].filter(meal => meal.source !== 'ai_estimate')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter(meal => {
      const key = JSON.stringify([meal.name, meal.source, meal.type, meal.grams, meal.referenceGrams, meal.kcal, meal.protein, meal.carbs, meal.fat]);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 8);
}

export function mealDraftTotals(draft: MealDraft) {
  const values = [draft.grams, draft.referenceGrams, draft.kcal, draft.protein, draft.carbs, draft.fat];
  if (values.some(value => !value.trim() || !Number.isFinite(Number(value)))) return null;
  const [grams, referenceGrams, kcal, protein, carbs, fat] = values.map(Number);
  if (grams <= 0 || grams > 10000 || referenceGrams <= 0 || referenceGrams > 10000 ||
    [kcal, protein, carbs, fat].some(value => value < 0) || kcal > 100000 ||
    [protein, carbs, fat].some(value => value > 10000) || kcal > referenceGrams * 12 ||
    protein + carbs + fat > referenceGrams * 1.1 + 1) return null;
  return mealTotals({ ...draft, grams, referenceGrams, kcal, protein, carbs, fat });
}
