import assert from "node:assert/strict";
import { test } from "node:test";
import {
  gramsToOunces,
  kcalToKj,
  kgToPounds,
  kjToKcal,
  macroEnergyConsistency,
  mealNutrients,
  ouncesToGrams,
  poundsToKg,
  roundTo,
  scaleNutrients,
  sumNutrients,
} from "./nutrition";

test("scaling by eaten grams is proportional and keeps unknown values unknown", () => {
  const scaled = scaleNutrients({ kcal: 200, protein: 10, carbs: null, fat: 5 }, 100, 150);
  assert.deepEqual(scaled, { kcal: 300, protein: 15, carbs: null, fat: 7.5 });
});

test("scaling rejects impossible inputs instead of producing NaN or Infinity", () => {
  const ref = { kcal: 100, protein: 1, carbs: 1, fat: 1 };
  assert.throws(() => scaleNutrients(ref, 0, 100), RangeError);
  assert.throws(() => scaleNutrients(ref, 100, -1), RangeError);
  assert.throws(() => scaleNutrients(ref, Number.NaN, 100), RangeError);
  assert.throws(() => scaleNutrients({ ...ref, kcal: -5 }, 100, 100), RangeError);
});

test("meal intake follows the stored reference weight", () => {
  const meal = { grams: 250, referenceGrams: 500, kcal: 800, protein: 40, carbs: 90, fat: 30 };
  assert.deepEqual(mealNutrients(meal), { kcal: 400, protein: 20, carbs: 45, fat: 15 });
});

test("an empty day sums to unknown, never to zero", () => {
  const totals = sumNutrients([]);
  assert.deepEqual(totals.values, { kcal: null, protein: null, carbs: null, fat: null });
  assert.equal(totals.itemCount, 0);
  assert.deepEqual(totals.partial, []);
});

test("a nutrient missing on some items is summed from known items and flagged partial", () => {
  const totals = sumNutrients([
    { kcal: 300, protein: 20, carbs: null, fat: 10 },
    { kcal: 200, protein: null, carbs: null, fat: 5 },
  ]);
  assert.deepEqual(totals.values, { kcal: 500, protein: 20, carbs: null, fat: 15 });
  assert.deepEqual(totals.partial, ["protein"]);
});

test("unit conversions round-trip", () => {
  assert.ok(Math.abs(kjToKcal(kcalToKj(523)) - 523) < 1e-9);
  assert.ok(Math.abs(ouncesToGrams(gramsToOunces(100)) - 100) < 1e-9);
  assert.ok(Math.abs(poundsToKg(kgToPounds(80)) - 80) < 1e-9);
  assert.equal(roundTo(kcalToKj(100), 1), 418);
  assert.equal(roundTo(gramsToOunces(28.349523125), 0.1), 1);
});

test("display rounding uses the requested step without float noise", () => {
  assert.equal(roundTo(12.345, 0.1), 12.3);
  assert.equal(roundTo(7.25, 0.5), 7.5);
  assert.equal(roundTo(1234, 5), 1235);
  assert.throws(() => roundTo(1, 0), RangeError);
});

test("decimal halfway rounding is stable and retains ties toward positive infinity", () => {
  for (const [value, expected] of [[1.005, 1.01], [2.675, 2.68], [10.075, 10.08], [9.995, 10], [-1.005, -1]]) {
    assert.equal(roundTo(value, 0.01), expected, String(value));
  }
  assert.equal(roundTo(1.0049999999999997, 0.01), 1);
  assert.equal(roundTo(1.0050000000000001, 0.01), 1.01);
});

test("display rounding preserves all digits in quarter and other decimal steps", () => {
  assert.equal(roundTo(1.13, 0.25), 1.25);
  assert.equal(roundTo(1.125, 0.25), 1.25);
  assert.equal(roundTo(-1.125, 0.25), -1);
  assert.equal(roundTo(1.18, 0.125), 1.125);
  assert.equal(roundTo(1.0375, 0.025), 1.05);
  assert.equal(roundTo(6.3, 2.5), 7.5);
  assert.equal(roundTo(6.3e-7, 2.5e-7), 7.5e-7);
  assert.equal(roundTo(1.25e-200, 0.25e-200), 1.25e-200);
});

test("display rounding rejects non-finite values and non-positive or non-finite steps", () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(() => roundTo(value, 0.25), RangeError);
  }
  for (const step of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -0.25]) {
    assert.throws(() => roundTo(1, step), RangeError);
  }
  assert.throws(() => roundTo(Number.MAX_VALUE, 1e308), RangeError);
});

test("macro energy check flags implausible drafts and stays silent when data is missing", () => {
  assert.equal(macroEnergyConsistency({ kcal: 520, protein: 40, carbs: 55, fat: 15 }), "consistent");
  assert.equal(macroEnergyConsistency({ kcal: 900, protein: 40, carbs: 55, fat: 15 }), "inconsistent");
  assert.equal(macroEnergyConsistency({ kcal: 10, protein: 0, carbs: 0, fat: 0 }), "consistent");
  assert.equal(macroEnergyConsistency({ kcal: 520, protein: null, carbs: 55, fat: 15 }), "unknown");
});
