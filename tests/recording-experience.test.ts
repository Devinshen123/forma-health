import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordingToday, shiftRecordingDay } from '../src/features/recordingDates';
import { createSleepDraft, sleepEntryFromDraft } from '../src/features/sleepEditor';
import { mealDraftTotals, newMealDraft, recentReusableMeals, reuseMealDraft } from '../src/features/mealEditor';
import type { Meal } from '../src/types';

const meal = (patch: Partial<Meal> = {}): Meal => ({
  id: crypto.randomUUID(), createdAt: '2026-10-18T12:00:00.000Z', date: '2026-10-18',
  name: 'Synthetic label meal', type: 'lunch', grams: 150, referenceGrams: 100,
  kcal: 120, protein: 8, carbs: 10, fat: 4, source: 'label', ...patch,
});

test('record calendar navigation follows dates across leap days, year boundaries and DST days', () => {
  for (const [day, offset, expected] of [
    ['2026-03-08', 1, '2026-03-09'], ['2026-11-01', -1, '2026-10-31'],
    ['2028-03-01', -1, '2028-02-29'], ['2026-01-01', -1, '2025-12-31'],
    ['2026-12-31', 1, '2027-01-01'],
  ] as const) assert.equal(shiftRecordingDay(day, offset), expected);
  for (const day of ['', '2026-02-30', '2026-2-01', 'not-a-date']) assert.equal(shiftRecordingDay(day, 1), day);
  assert.equal(shiftRecordingDay('2026-10-19', Number.MAX_SAFE_INTEGER), '2026-10-19');
  const now = new Date('2026-10-19T06:30:00.000Z');
  assert.equal(recordingToday('America/Los_Angeles', now), '2026-10-18');
  assert.equal(recordingToday('Asia/Shanghai', now), '2026-10-19');
});

test('sleep backfill supplies calendar dates without inventing times or subjective ratings', () => {
  const draft = createSleepDraft('Etc/UTC', undefined, '2028-03-01');
  assert.equal(draft.start, '2028-02-29T');
  assert.equal(draft.end, '2028-03-01T');
  assert.equal(draft.quality, ''); assert.equal(draft.energy, '');
  const saved = sleepEntryFromDraft({ ...draft, quality: '4', energy: '3' }, '2028-02-29T23:10:00.000Z', '2028-03-01T07:20:00.000Z');
  const edit = createSleepDraft('Asia/Shanghai', saved, '2030-01-01');
  assert.equal(edit.id, saved.id); assert.equal(edit.timezone, saved.timezone);
  assert.equal(edit.originalStart, saved.start); assert.equal(edit.originalEnd, saved.end);
  assert.equal(edit.createdAt, saved.createdAt, 'backfill defaults never redate an existing record');
});

test('meal reuse creates a distinct reviewed entry and preserves its reference basis without copying attachments', () => {
  const original = meal({ assetId: crypto.randomUUID() });
  const before = structuredClone(original);
  const first = reuseMealDraft(original, '2026-10-15'), second = reuseMealDraft(original, '2026-10-15');
  assert.notEqual(first.id, original.id); assert.notEqual(first.id, second.id);
  assert.equal(first.date, '2026-10-15'); assert.equal(first.existing, undefined);
  assert.equal(first.source, 'label'); assert.equal(first.referenceGrams, '100'); assert.equal(first.grams, '150');
  assert.equal(first.assetId, undefined); assert.equal(first.aiDraftId, undefined); assert.equal(first.aiItemIndex, undefined);
  assert.deepEqual(original, before);
  assert.deepEqual(mealDraftTotals(first), { kcal: 180, protein: 12, carbs: 15, fat: 6 });
  assert.throws(() => reuseMealDraft(meal({ source: 'ai_estimate' }), '2026-10-15'), /AI/);
});

test('recent reusable foods exclude AI estimates, deduplicate values and leave saved history untouched', () => {
  const saved = Array.from({ length: 10 }, (_, i) => meal({ name: `Synthetic food ${i}`, createdAt: `2026-10-${String(i + 1).padStart(2, '0')}T12:00:00.000Z` }));
  const source = [...saved, { ...saved[9], id: crypto.randomUUID() }, meal({ source: 'ai_estimate' })];
  const before = structuredClone(source), recent = recentReusableMeals(source);
  assert.equal(recent.length, 8); assert.equal(recent[0].name, 'Synthetic food 9');
  assert.equal(recent.filter(item => item.name === 'Synthetic food 9').length, 1);
  assert.equal(recent.some(item => item.source === 'ai_estimate'), false);
  assert.deepEqual(source, before);
});

test('portion preview keeps unknowns blank, preserves explicit zero and rejects invalid portions or macros', () => {
  const draft = newMealDraft('2026-10-19');
  assert.equal(mealDraftTotals(draft), null);
  const zero = { ...draft, kcal: '0', protein: '0', carbs: '0', fat: '0' };
  assert.deepEqual(mealDraftTotals(zero), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  assert.equal(mealDraftTotals({ ...zero, protein: '' }), null);
  assert.equal(mealDraftTotals({ ...zero, kcal: '-1' }), null);
  assert.equal(mealDraftTotals({ ...zero, grams: '0' }), null);
  assert.equal(mealDraftTotals({ ...zero, referenceGrams: '0' }), null);
  assert.equal(mealDraftTotals({ ...zero, protein: '500' }), null);
  assert.equal(mealDraftTotals({ ...zero, referenceGrams: '10000', protein: '10001' }), null);
  assert.equal(mealDraftTotals({ ...zero, referenceGrams: '10000', kcal: '100001' }), null);
});
