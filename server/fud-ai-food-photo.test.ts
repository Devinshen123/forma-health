import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptFudAiFoodPhoto, FUD_AI_ANALYSIS_ENGINE, fudAiFoodPhotoOutputSchema } from './fud-ai-food-photo';

const rice = () => ({
  isFood: true, name: 'Rice', calories: 260, protein: 5.4, carbs: 56, fat: 0.6,
  serving_size_grams: 200, ingredients: [], warnings: [],
});
const invalid = (value: unknown) => assert.equal(fudAiFoodPhotoOutputSchema.safeParse(value).success, false);

test('Fud whole-serving totals normalize to a reusable per-100g baseline without rounding', () => {
  const value = adaptFudAiFoodPhoto(rice(), 'en');
  assert.deepEqual(value, { isFood: true, items: [{ name: 'Rice', grams: 200, per100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } }], warnings: [] });
  const fractional = adaptFudAiFoodPhoto({ ...rice(), calories: 51, protein: 1.1, carbs: 3.3, fat: 0.1, serving_size_grams: 37 }, 'en').items[0];
  assert.equal(fractional.per100g.kcal, 51 * 100 / 37);
  assert.equal(fractional.per100g.protein, 1.1 * 100 / 37);
  assert.notEqual(fractional.per100g.kcal, Math.round(fractional.per100g.kcal!));
  assert.deepEqual(FUD_AI_ANALYSIS_ENGINE, { id: 'fud-ai', sourceCommit: '6fa160239727a6ab275d0ff302acd191160fce20' });
});

test('Fud ingredient rows replace the complete meal, never duplicate it', () => {
  const value = adaptFudAiFoodPhoto({
    ...rice(), name: 'Rice and chicken', calories: 425, protein: 36.4, carbs: 56, fat: 4.2, serving_size_grams: 300,
    ingredients: [
      { name: 'Rice', grams: 200, calories: 260, protein: 5.4, carbs: 56, fat: 0.6 },
      { name: 'Chicken', grams: 100, calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    ],
  }, 'en');
  assert.equal(value.items.length, 2);
  assert.deepEqual(value.items.map(item => item.name), ['Rice', 'Chicken']);
  assert.equal(value.items.reduce((total, item) => total + item.grams! * item.per100g.kcal! / 100, 0), 425);
  assert.deepEqual(value.items[1].per100g, { kcal: 165, protein: 31, carbs: 0, fat: 3.6 });
});

test('known zeros survive and unknown nutrients do not become zero or energy derived from macros', () => {
  const result = adaptFudAiFoodPhoto({ ...rice(), calories: null, protein: 0, carbs: null, fat: 0 }, 'en');
  assert.deepEqual(result.items[0].per100g, { kcal: null, protein: 0, carbs: null, fat: 0 });
});

test('unknown serving grams never become 1g or a guessed per-100g baseline', () => {
  for (const language of ['zh', 'en'] as const) {
    const result = adaptFudAiFoodPhoto({ ...rice(), serving_size_grams: null }, language);
    assert.equal(result.items[0].grams, null);
    assert.deepEqual(result.items[0].per100g, { kcal: null, protein: null, carbs: null, fat: null });
    assert.match(result.warnings.join(' '), language === 'zh' ? /重量未知/ : /weights are unknown/);
  }
});

test('unknown ingredient weight is not reconstructed from remaining meal calories', () => {
  const result = adaptFudAiFoodPhoto({ ...rice(), ingredients: [
    { name: 'Known rice', grams: 100, calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
    { name: 'Unknown rice', grams: null, calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  ] }, 'en');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].per100g.kcal, 130);
  assert.equal(result.items[1].grams, null);
  assert.deepEqual(result.items[1].per100g, { kcal: null, protein: null, carbs: null, fat: null });
});

test('non-food classification requires an empty, null-valued estimate', () => {
  const empty = { isFood: false, name: null, calories: null, protein: null, carbs: null, fat: null, serving_size_grams: null, ingredients: [], warnings: ['No visible food'] };
  assert.deepEqual(adaptFudAiFoodPhoto(empty, 'en'), { isFood: false, items: [], warnings: ['No visible food'] });
  invalid({ ...empty, calories: 0 });
  invalid({ ...empty, name: 'Rice' });
  invalid({ ...rice(), isFood: false });
  invalid({ ...rice(), name: null });
});

test('raw Fud parser rejects permissive coercion, missing fields and the previous items schema', () => {
  invalid({ isFood: true, items: [{ name: 'Rice', grams: 200, per100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } }], warnings: [] });
  invalid({ ...rice(), calories: '260' });
  invalid({ ...rice(), calories: true });
  invalid({ ...rice(), calories: Infinity });
  invalid({ ...rice(), calories: Number.NaN });
  invalid({ ...rice(), protein: undefined });
  invalid({ ...rice(), unit_options: [] });
  invalid({ ...rice(), name: '  ' });
  invalid({ ...rice(), warnings: ['secret\ncontrol'] });
  invalid({ ...rice(), ingredients: [{ name: 'Rice', grams: 200, calories: 260, protein: '5.4', carbs: 56, fat: 0.6 }] });
});

test('raw quantities and normalized density retain Forma physical bounds', () => {
  for (const weight of [0, -1, 10001, Infinity, '200']) invalid({ ...rice(), serving_size_grams: weight });
  for (const key of ['calories', 'protein', 'carbs', 'fat']) invalid({ ...rice(), [key]: -1 });
  invalid({ ...rice(), calories: 2401 });
  invalid({ ...rice(), calories: 10, protein: 201, carbs: null, fat: null });
  invalid({ ...rice(), calories: 10, protein: 100, carbs: 100, fat: 23 });
  invalid({ ...rice(), ingredients: [{ name: 'Impossible ingredient', grams: 1, calories: 260, protein: 0, carbs: 0, fat: 0 }] });
  assert.equal(fudAiFoodPhotoOutputSchema.safeParse({ ...rice(), calories: 2400, protein: 200, carbs: 0, fat: 0 }).success, true);
});

test('invalid complete ingredient coverage is rejected rather than dropping dishes or counting totals', () => {
  const item = { name: 'Rice', grams: 200, calories: 260, protein: 5.4, carbs: 56, fat: 0.6 };
  invalid({ ...rice(), ingredients: [item, { ...item, name: 'Total' }] });
  invalid({ ...rice(), ingredients: [{ ...item, grams: 50, calories: 60, protein: 1, carbs: 13, fat: 0.1 }] });
  invalid({ ...rice(), ingredients: [{ ...item, grams: 1000 }] });
  // The whole-serving calorie estimate may be unknown while ingredients are known.
  assert.equal(adaptFudAiFoodPhoto({ ...rice(), calories: null, ingredients: [item] }, 'en').items[0].per100g.kcal, 130);
});

test('ingredient and warning caps stay bounded, including the generated unknown-weight warning', () => {
  const item = { name: 'Rice', grams: null, calories: null, protein: null, carbs: null, fat: null };
  invalid({ ...rice(), ingredients: Array.from({ length: 9 }, () => item) });
  invalid({ ...rice(), warnings: Array.from({ length: 9 }, () => 'Warning') });
  const result = adaptFudAiFoodPhoto({ ...rice(), serving_size_grams: null, warnings: Array.from({ length: 8 }, (_value, i) => `Warning ${i + 1}`) }, 'en');
  assert.equal(result.warnings.length, 8);
  assert.match(result.warnings[7], /weights are unknown/);
});
