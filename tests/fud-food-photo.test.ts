import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asReviewItem,
  completeReviewItem,
  reviewTotals,
  reviewBatchTotals,
  setReviewGrams,
  setReviewPortions,
} from '../src/features/foodPhotoReview';
import type { FoodPhotoItem } from '../src/types';

const rice = (): FoodPhotoItem => ({
  name: 'Fixture rice', grams: 150,
  per100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
});
const reviewRice = () => asReviewItem(rice(), 0, 'qa-reviewed-rice');

test('FUD-04: a pictured serving is one editable portion, while nutrition remains per 100 g', () => {
  const item = reviewRice();
  assert.equal(item.mealId, 'qa-reviewed-rice');
  assert.equal(item.index, 0);
  assert.equal(item.servingGrams, 150);
  assert.equal(item.portions, '1');
  assert.equal(item.grams, '150');
  assert.equal(item.kcal, '130');
  assert.deepEqual(reviewTotals(item), { kcal: 195, protein: 4.1, carbs: 42, fat: 0.5 });
  assert.equal(completeReviewItem(item), true);
});

test('FUD-04: portion and gram edits share the original serving basis without cumulative scaling', () => {
  const original = reviewRice();
  const half = setReviewPortions(original, '0.5');
  assert.equal(Number(half.grams), 75);
  assert.equal(half.servingGrams, 150);
  assert.deepEqual(reviewTotals(half), { kcal: 98, protein: 2, carbs: 21, fat: 0.2 });
  const oneAndHalf = setReviewPortions(half, '1.5');
  assert.equal(Number(oneAndHalf.grams), 225, 'a new portion count replaces the old multiplier');
  const doubled = setReviewGrams(oneAndHalf, '300');
  assert.equal(Number(doubled.portions), 2);
  assert.equal(doubled.servingGrams, 150);
  const restored = setReviewPortions(doubled, '1');
  assert.equal(Number(restored.grams), 150);
  assert.equal(restored.kcal, '130');
  assert.deepEqual(reviewTotals(restored), reviewTotals(original));
  assert.equal(original.grams, '150', 'pure edit helpers must leave the original review draft untouched');
  assert.equal(original.portions, '1');
});

test('FUD-04: corrected names and per-100-g nutrients survive portion edits and drive the saved totals once', () => {
  const corrected = { ...reviewRice(), name: 'Corrected fixture food', kcal: '160', protein: '5', carbs: '25', fat: '3' };
  const two = setReviewPortions(corrected, '2');
  assert.equal(two.name, 'Corrected fixture food');
  assert.equal(two.grams, '300');
  assert.equal(two.kcal, '160');
  assert.equal(two.protein, '5');
  assert.equal(two.carbs, '25');
  assert.equal(two.fat, '3');
  assert.deepEqual(reviewTotals(two), { kcal: 480, protein: 15, carbs: 75, fat: 9 });
  assert.deepEqual(reviewBatchTotals([two]), { kcal: 480, protein: 15, carbs: 75, fat: 9 }, 'one reviewed item must not be counted both as a meal and as a portion multiplier');
});

test('FUD-04: an unknown weight never creates a serving; the first reviewed weight establishes one', () => {
  const item = asReviewItem({ ...rice(), grams: null }, 1, 'qa-unknown-portion');
  assert.equal(item.grams, '');
  assert.equal(item.portions, '');
  assert.equal(item.servingGrams, null);
  assert.equal(completeReviewItem(item), false);
  assert.equal(reviewTotals(item), null);
  const noBasis = setReviewPortions(item, '2');
  assert.equal(noBasis.grams, '', 'a portion count alone cannot invent an unknown serving weight');
  assert.equal(completeReviewItem(noBasis), false);
  const weighed = setReviewGrams(item, '200');
  assert.equal(weighed.servingGrams, 200);
  assert.equal(weighed.portions, '1');
  assert.deepEqual(reviewTotals(setReviewPortions(weighed, '0.5')), { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 });
});

test('FUD-04: unknown nutrients remain blank and block saving while known zero remains a real zero', () => {
  const item = asReviewItem({ name: 'Uncertain fixture', grams: 100, per100g: { kcal: null, protein: 0, carbs: null, fat: null } }, 0, 'qa-null-nutrients');
  assert.equal(item.kcal, '');
  assert.equal(item.protein, '0');
  assert.equal(item.carbs, '');
  assert.equal(item.fat, '');
  assert.equal(completeReviewItem(item), false);
  assert.equal(reviewTotals(item), null);
  assert.equal(reviewBatchTotals([reviewRice(), item]), null, 'an incomplete batch must not publish a misleading partial total');
  const reviewedZero = { ...item, kcal: '0', carbs: '0', fat: '0' };
  assert.equal(completeReviewItem(reviewedZero), true);
  assert.deepEqual(reviewTotals(reviewedZero), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  assert.equal(reviewBatchTotals([]), null, 'no reviewed food is missing, not a logged zero meal');
});

test('FUD-04: invalid portions and gram weights cannot be saved or silently converted into zero food', () => {
  for (const raw of ['', ' ', '0', '-1', 'NaN', 'Infinity', 'abc']) {
    const item = setReviewPortions(reviewRice(), raw);
    assert.equal(item.grams, '', `invalid portion ${JSON.stringify(raw)} must clear usable weight`);
    assert.equal(completeReviewItem(item), false);
    assert.equal(reviewTotals(item), null);
  }
  for (const raw of ['', ' ', '0', '-1', 'NaN', 'Infinity', '10001']) {
    const item = setReviewGrams(reviewRice(), raw);
    assert.equal(completeReviewItem(item), false, `invalid grams ${JSON.stringify(raw)} must block save`);
    assert.equal(reviewTotals(item), null);
  }
  const tooManyPortions = setReviewPortions(reviewRice(), '100');
  assert.equal(completeReviewItem(tooManyPortions), false, 'a finite multiplier still cannot bypass the 10 kg per-food safety bound');
});

test('FUD-04: reviewed names and nutrition obey the same portion safety limits as the API', () => {
  for (const change of [
    { name: ' ' }, { name: 'x'.repeat(161) }, { kcal: '' }, { kcal: '-1' }, { kcal: '1201' },
    { protein: '101' }, { protein: '70', carbs: '70', fat: '70' }, { fat: 'Infinity' },
  ]) {
    const item = { ...reviewRice(), ...change };
    assert.equal(completeReviewItem(item), false, `invalid review ${JSON.stringify(change)} must block save`);
    assert.equal(reviewTotals(item), null);
  }
});

test('FUD-04: independent foods contribute exactly their reviewed intake to a batch', () => {
  const riceItem = setReviewPortions(reviewRice(), '2');
  const second = asReviewItem({ name: 'Fixture egg', grams: 50, per100g: { kcal: 150, protein: 12, carbs: 2, fat: 10 } }, 1, 'qa-reviewed-egg');
  assert.deepEqual(reviewBatchTotals([riceItem, second]), { kcal: 465, protein: 14.1, carbs: 85, fat: 5.9 });
  assert.deepEqual(reviewBatchTotals([second]), { kcal: 75, protein: 6, carbs: 1, fat: 5 }, 'removing a food removes its contribution rather than keeping the original photo total');
});
