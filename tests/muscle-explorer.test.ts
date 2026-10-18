import { test } from 'node:test';
import assert from 'node:assert/strict';
import muscleIndex from '../src/catalog/opengym-muscles.json';
import { openGymExercises } from '../src/catalog/opengym';
import { matchesMuscle, muscleCounts, MUSCLE_KEYS, muscleName } from '../src/catalog/muscle-explorer';
import type { CatalogExercise } from '../src/types';

const sourceMuscles = muscleIndex as Record<string, { primary: string[]; secondary: string[] }>;

function exercise(id: string, primaryMuscles: string[], secondaryMuscles: string[] = []): CatalogExercise {
  return { id, name: id, primaryMuscles, secondaryMuscles, equipment: null, category: 'strength', level: 'unspecified', instructions: [] };
}

test('muscle matching includes secondary involvement and ignores unknown body regions', () => {
  const action = exercise('synthetic-push', ['chest'], ['shoulders', 'triceps', 'chest']);
  assert.equal(matchesMuscle(action, 'chest'), true);
  assert.equal(matchesMuscle(action, 'deltoids'), true);
  assert.equal(matchesMuscle(action, 'triceps'), true);
  assert.equal(matchesMuscle(action, 'quadriceps'), false);
  assert.equal(matchesMuscle(action, 'not-a-muscle'), false);
  assert.equal(matchesMuscle(action, '__proto__'), false);
  assert.equal(matchesMuscle(action, ''), false);
});

test('muscle totals count one exercise once across duplicate primary, secondary and repeated identities', () => {
  const push = exercise('synthetic-push', ['chest', 'chest'], ['chest', 'triceps']);
  const press = exercise('synthetic-press', ['shoulders'], ['chest', 'unknown']);
  const counts = muscleCounts([push, press, { ...push }]);
  assert.equal(counts.chest, 2);
  assert.equal(counts.deltoids, 1);
  assert.equal(counts.triceps, 1);
  assert.equal(counts.quadriceps, 0);
  assert.deepEqual(Object.keys(counts).sort(), [...MUSCLE_KEYS].sort());
});

test('all 5,632 animated actions use the precise authorized body-region data for matching and totals', () => {
  const counts = muscleCounts(openGymExercises);
  assert.equal(Object.keys(muscleIndex).length, 5632);
  assert.equal(MUSCLE_KEYS.length, 18);
  for (const key of MUSCLE_KEYS) {
    const expected = openGymExercises.filter(action => {
      const metadata = sourceMuscles[action.sourceId!];
      return [...metadata.primary, ...metadata.secondary].includes(key);
    });
    assert.equal(counts[key], expected.length, `${key} count agrees with independent primary + secondary union`);
    assert.equal(openGymExercises.filter(action => matchesMuscle(action, key)).length, expected.length);
  }
  assert.equal(counts.trapezius, 525);
  assert.equal(counts.deltoids, 2348);
  assert.equal(counts.chest, 905);
  assert.equal(counts['upper-back'], 1197);
  assert.equal(counts.serratus, 35);
});

test('every selectable body region has readable Chinese and English labels', () => {
  for (const key of MUSCLE_KEYS) {
    assert.match(muscleName(key, 'zh'), /[\u4e00-\u9fff]/);
    assert.ok(muscleName(key, 'en').trim().length > 0);
  }
  assert.equal(muscleName('chest', 'zh'), '胸部');
  assert.equal(muscleName('chest', 'en'), 'Chest');
});
