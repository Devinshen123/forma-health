import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ageEligibility,
  allergenWarnings,
  conservativeMode,
  guardEnginePatch,
  parseDeclaredAllergens,
} from "./safety";

const base = { trainingMinutes: 45, trainingDays: 4, sleepHours: 8, calorieTarget: 2400, proteinTarget: 120 };

test("age gate only admits users who are certainly 18+, and asks for a date in the borderline year", () => {
  assert.equal(ageEligibility(1990, "2026-10-14"), "eligible");
  assert.equal(ageEligibility(2007, "2026-10-14"), "eligible");
  assert.equal(ageEligibility(2008, "2026-10-14"), "needs_birth_date");
  assert.equal(ageEligibility(2010, "2026-10-14"), "ineligible");
  assert.equal(ageEligibility(null, "2026-10-14"), "needs_birth_date");
  assert.equal(ageEligibility(2030, "2026-10-14"), "needs_birth_date");
});

test("conservative mode lists every reason that triggered it", () => {
  assert.deepEqual(conservativeMode({}), { active: false, reasons: [] });
  assert.deepEqual(conservativeMode({ kidney_disease: true, eating_disorder_history: false }), {
    active: true,
    reasons: ["kidney_disease"],
  });
});

test("the engine can never change energy or protein targets on its own", () => {
  const { allowed, blocked } = guardEnginePatch(base, { calorieTarget: 2000, proteinTarget: 150, trainingMinutes: 30 }, { conservative: false });
  assert.deepEqual(allowed, { trainingMinutes: 30 });
  assert.deepEqual(blocked, [
    { field: "calorieTarget", code: "user_only_field" },
    { field: "proteinTarget", code: "user_only_field" },
  ]);
});

test("automated increases are small, and none are allowed in conservative mode", () => {
  assert.deepEqual(guardEnginePatch(base, { trainingMinutes: 60 }, { conservative: false }).allowed, { trainingMinutes: 60 });
  assert.deepEqual(guardEnginePatch(base, { trainingMinutes: 75 }, { conservative: false }).blocked, [
    { field: "trainingMinutes", code: "step_too_large" },
  ]);
  assert.deepEqual(guardEnginePatch(base, { trainingDays: 6 }, { conservative: false }).blocked, [
    { field: "trainingDays", code: "step_too_large" },
  ]);
  assert.deepEqual(guardEnginePatch(base, { trainingDays: 5 }, { conservative: true }).blocked, [
    { field: "trainingDays", code: "conservative_no_increase" },
  ]);
  assert.deepEqual(guardEnginePatch(base, { trainingDays: 2 }, { conservative: true }).allowed, { trainingDays: 2 });
});

test("declared allergens parse from mixed Chinese and English separators; 'none' means none", () => {
  assert.deepEqual(parseDeclaredAllergens("花生、Shrimp，乳糖不耐; sesame"), ["花生", "shrimp", "乳糖不耐", "sesame"]);
  assert.deepEqual(parseDeclaredAllergens("无"), []);
  assert.deepEqual(parseDeclaredAllergens(" none "), []);
});

test("allergen warnings cover synonyms across languages", () => {
  assert.deepEqual(allergenWarnings("peanut", "宫保鸡丁（含花生）"), [{ declared: "peanut", matched: "花生" }]);
  assert.deepEqual(allergenWarnings("乳糖不耐", "Greek yogurt bowl"), [{ declared: "乳糖不耐", matched: "yogurt" }]);
  assert.deepEqual(allergenWarnings("shellfish", "Garlic prawns"), [{ declared: "shellfish", matched: "prawn" }]);
  assert.deepEqual(allergenWarnings("海鲜贝类", "清蒸扇贝"), [{ declared: "海鲜贝类", matched: "扇贝" }]);
  assert.deepEqual(allergenWarnings("fish", "Garlic prawns"), []);
  assert.deepEqual(allergenWarnings("贝类", "全麦贝果"), []);
});

test("known false friends do not trigger: protein is not egg, buckwheat is not wheat, coconut milk is not dairy", () => {
  assert.deepEqual(allergenWarnings("鸡蛋", "蛋白质能量棒"), []);
  assert.deepEqual(allergenWarnings("egg", "Grilled eggplant"), []);
  assert.deepEqual(allergenWarnings("wheat", "Soba (100% buckwheat)"), []);
  assert.deepEqual(allergenWarnings("milk", "Thai curry with coconut milk"), []);
});

test("unknown allergens still match literally, and no match returns an empty list (not 'safe')", () => {
  assert.deepEqual(allergenWarnings("kiwi", "Kiwi smoothie"), [{ declared: "kiwi", matched: "kiwi" }]);
  assert.deepEqual(allergenWarnings("peanut", "Plain rice"), []);
});
