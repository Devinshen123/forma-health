// Deterministic nutrition arithmetic. AI may draft values; only these functions compute totals.
import { NUTRIENT_KEYS, type NutrientKey, type Nutrients, type Totals } from "./types";

export const KJ_PER_KCAL = 4.184;
export const GRAMS_PER_OUNCE = 28.349523125;
export const KG_PER_POUND = 0.45359237;
/** Atwater general factors (kcal per gram). */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

const isFiniteNonNegative = (value: number) => Number.isFinite(value) && value >= 0;

/** Scale values stated for `referenceGrams` to an eaten amount of `grams`. Unknown stays unknown. */
export function scaleNutrients(reference: Nutrients, referenceGrams: number, grams: number): Nutrients {
  if (!isFiniteNonNegative(referenceGrams) || referenceGrams === 0)
    throw new RangeError("referenceGrams must be a positive finite number");
  if (!isFiniteNonNegative(grams)) throw new RangeError("grams must be a non-negative finite number");
  const factor = grams / referenceGrams;
  const scaled = {} as Nutrients;
  for (const key of NUTRIENT_KEYS) {
    const value = reference[key];
    if (value !== null && !isFiniteNonNegative(value))
      throw new RangeError(`${key} must be null or a non-negative finite number`);
    scaled[key] = value === null ? null : value * factor;
  }
  return scaled;
}

export interface MealAmounts {
  grams: number;
  referenceGrams: number;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

/** Intake for one logged meal: reference values scaled by eaten grams. */
export const mealNutrients = (meal: MealAmounts): Nutrients =>
  scaleNutrients(
    { kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat },
    meal.referenceGrams,
    meal.grams,
  );

/**
 * Sum items without turning unknown into zero. An empty list has unknown totals (nothing logged),
 * not zero totals; a key known for only some items is summed and flagged `partial`.
 */
export function sumNutrients(items: readonly Nutrients[]): Totals {
  const values: Nutrients = { kcal: null, protein: null, carbs: null, fat: null };
  const partial: NutrientKey[] = [];
  for (const key of NUTRIENT_KEYS) {
    let known = 0;
    let sum = 0;
    for (const item of items) {
      const value = item[key];
      if (value !== null) {
        known++;
        sum += value;
      }
    }
    if (known > 0) values[key] = sum;
    if (known > 0 && known < items.length) partial.push(key);
  }
  return { values, partial, itemCount: items.length };
}

export const kcalToKj = (kcal: number) => kcal * KJ_PER_KCAL;
export const kjToKcal = (kj: number) => kj / KJ_PER_KCAL;
export const gramsToOunces = (grams: number) => grams / GRAMS_PER_OUNCE;
export const ouncesToGrams = (ounces: number) => ounces * GRAMS_PER_OUNCE;
export const kgToPounds = (kg: number) => kg / KG_PER_POUND;
export const poundsToKg = (pounds: number) => pounds * KG_PER_POUND;

/** Presentation rounding only; store unrounded values. */
export function roundTo(value: number, step: number): number {
  if (!Number.isFinite(value)) throw new RangeError("value must be finite");
  if (!Number.isFinite(step) || !(step > 0)) throw new RangeError("step must be positive and finite");
  // Use the canonical decimal inputs as integers at a shared scale. Binary
  // division loses decimal ties (1.005 / .01); log10 also drops digits in .25.
  const decimal = (input: number) => {
    const [mantissa, exponent = "0"] = String(input).split("e");
    return {
      coefficient: BigInt(mantissa.replace(".", "")),
      exponent: Number(exponent) - (mantissa.split(".")[1]?.length ?? 0),
    };
  };
  const number = decimal(value), increment = decimal(step);
  const exponent = Math.min(number.exponent, increment.exponent);
  const numerator = number.coefficient * 10n ** BigInt(number.exponent - exponent);
  const denominator = increment.coefficient * 10n ** BigInt(increment.exponent - exponent);
  let multiples = numerator / denominator;
  const twiceRemainder = (numerator % denominator) * 2n;
  // Preserve Math.round's ties toward positive infinity, including negatives.
  if (twiceRemainder >= denominator) multiples++;
  else if (twiceRemainder < -denominator) multiples--;
  const rounded = Number(`${multiples * increment.coefficient}e${increment.exponent}`);
  if (!Number.isFinite(rounded)) throw new RangeError("rounded value must be finite");
  return rounded;
}

/**
 * Does stated energy roughly match 4/4/9 kcal per gram of protein/carbs/fat?
 * Fibre, alcohol and polyols legitimately shift this, so the result is a review hint, not an error.
 */
export function macroEnergyConsistency(
  n: Nutrients,
  tolerance = 0.2,
  slackKcal = 15,
): "consistent" | "inconsistent" | "unknown" {
  if (n.kcal === null || n.protein === null || n.carbs === null || n.fat === null) return "unknown";
  const computed = n.protein * KCAL_PER_GRAM.protein + n.carbs * KCAL_PER_GRAM.carbs + n.fat * KCAL_PER_GRAM.fat;
  const gap = Math.abs(n.kcal - computed);
  if (gap <= slackKcal) return "consistent";
  return gap / Math.max(n.kcal, computed) <= tolerance ? "consistent" : "inconsistent";
}
