import { mealTotals, type FoodPhotoItem } from '../types';

/** Editable strings retain unknown values; servingGrams is the fixed one-serving basis. */
export type ReviewItem = {
  index: number;
  mealId: string;
  name: string;
  grams: string;
  portions: string;
  servingGrams: number | null;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
};

const knownString = (value: number | null) => value === null ? '' : String(value);
const positiveNumber = (raw: string) => raw.trim() && Number.isFinite(Number(raw)) && Number(raw) > 0 ? Number(raw) : null;
const validGrams = (raw: string) => {
  const value = positiveNumber(raw);
  return value !== null && value <= 10000 ? value : null;
};
const numericString = (value: number) => String(Number(value.toPrecision(12)));

/** IDs are supplied by the caller so this conversion stays deterministic. */
export function asReviewItem(item: FoodPhotoItem, index: number, mealId: string): ReviewItem {
  const grams = knownString(item.grams);
  const servingGrams = validGrams(grams);
  return {
    index, mealId, name: item.name, grams, servingGrams,
    portions: servingGrams === null ? '' : '1',
    kcal: knownString(item.per100g.kcal),
    protein: knownString(item.per100g.protein),
    carbs: knownString(item.per100g.carbs),
    fat: knownString(item.per100g.fat),
  };
}

/** First known weight establishes one serving; subsequent changes keep that basis. */
export function setReviewGrams(item: ReviewItem, raw: string): ReviewItem {
  const grams = validGrams(raw);
  const servingGrams = item.servingGrams ?? grams;
  return {
    ...item, grams: raw, servingGrams,
    portions: grams !== null && servingGrams !== null ? numericString(grams / servingGrams) : '',
  };
}

/** Portion changes scale weight once. Per-100-g nutrition is never scaled or replaced. */
export function setReviewPortions(item: ReviewItem, raw: string): ReviewItem {
  const portions = positiveNumber(raw);
  const grams = portions !== null && item.servingGrams !== null ? portions * item.servingGrams : null;
  return {
    ...item, portions: raw,
    grams: grams !== null && Number.isFinite(grams) && grams > 0 && grams <= 10000 ? numericString(grams) : '',
  };
}

export function completeReviewItem(item: ReviewItem): boolean {
  const values = [item.grams, item.kcal, item.protein, item.carbs, item.fat];
  if (!item.name.trim() || item.name.trim().length > 160 ||
    item.servingGrams === null || positiveNumber(item.portions) === null ||
    values.some(value => !value.trim() || !Number.isFinite(Number(value)))) return false;
  const [grams, kcal, protein, carbs, fat] = values.map(Number);
  return grams > 0 && grams <= 10000 && kcal >= 0 && kcal <= 1200 &&
    [protein, carbs, fat].every(value => value >= 0 && value <= 100) && protein + carbs + fat <= 111;
}

export function reviewTotals(item: ReviewItem) {
  return completeReviewItem(item) ? mealTotals({
    id: item.mealId, date: '', type: 'lunch', name: item.name, grams: Number(item.grams), referenceGrams: 100,
    kcal: Number(item.kcal), protein: Number(item.protein), carbs: Number(item.carbs), fat: Number(item.fat),
    source: 'ai_estimate', createdAt: '',
  }) : null;
}

/** Incomplete retained foods make a total unknown, never a partial or fabricated zero. */
export function reviewBatchTotals(items: ReviewItem[]) {
  if (!items.length) return null;
  let total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const item of items) {
    const value = reviewTotals(item);
    if (!value) return null;
    total = {
      kcal: total.kcal + value.kcal,
      protein: total.protein + value.protein,
      carbs: total.carbs + value.carbs,
      fat: total.fat + value.fat,
    };
  }
  return total;
}
