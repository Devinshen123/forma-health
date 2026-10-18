import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalog, foundationExercises, equipmentLabel, muscleLabel } from '../src/catalog/exercises';
import { openGymExercises } from '../src/catalog/opengym';
import { parseExerciseContent } from '../src/catalog/content';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

test('all 5,632 primary openGym exercises coexist with the unchanged 884 legacy identities', () => {
  const legacy = json('src/catalog/exercises.json');
  assert.equal(openGymExercises.length, 5632);
  assert.equal(catalog.length, 6516);
  assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
  for (const previous of [...foundationExercises, ...legacy]) {
    const current = catalog.find(item => item.id === previous.id);
    assert.ok(current);
    const { source: _source, ...fields } = current;
    assert.deepEqual(fields, previous, 'existing records keep the same exercise identities and teaching data');
  }
  assert.equal(catalog.filter(item => item.animation).length, 8);
  assert.equal(catalog.filter(item => item.video).length, 5632);
});

test('catalogue animation and instruction references are namespaced local files covered by the import manifest', () => {
  const manifest = json('src/catalog/opengym-manifest.json');
  const files = new Set(manifest.files.map((item: { path: string }) => '/' + item.path));
  assert.equal(manifest.primaryCount, 5632);
  assert.equal(manifest.excludedVariantCount, 922);
  assert.equal(manifest.videoCount, 5632);
  assert.equal(manifest.files.length, 5632 * 2 + 64);
  for (const exercise of openGymExercises) {
    assert.match(exercise.id, /^opengym-\d{4,5}$/);
    assert.ok(exercise.name && exercise.nameZh);
    assert.equal(exercise.level, 'unspecified');
    assert.ok(exercise.video && files.has(exercise.video.src) && files.has(exercise.video.poster));
    assert.ok(exercise.instructionUrl && files.has(exercise.instructionUrl));
    assert.equal(exercise.instructions.length, 0, 'the full instruction text is loaded on demand');
    assert.ok(exercise.primaryMuscles.every(muscle => typeof muscle === 'string'));
  }
});

test('every primary action resolves its own English instructions and existing Chinese translations', () => {
  const buckets = new Map<string, unknown>();
  let translated = 0;
  for (const exercise of openGymExercises) {
    const path = exercise.instructionUrl!;
    if (!buckets.has(path)) buckets.set(path, json('public' + path));
    const content = parseExerciseContent(buckets.get(path), exercise.sourceId!);
    assert.equal(content.id, exercise.sourceId);
    assert.ok(content.instructions.length > 0);
    if (content.instructionsZh) translated++;
  }
  assert.equal(buckets.size, 64);
  assert.equal(translated, 1324, 'missing translations remain an explicit English fallback');
});

test('content loading rejects another exercise, invalid steps and unsupported content versions', () => {
  const valid = { id: '0001', description: 'Synthetic description', instructions: ['Synthetic instruction'] };
  assert.equal(parseExerciseContent({ schemaVersion: 1, exercises: { '0001': valid } }, '0001').id, '0001');
  for (const entry of [{ ...valid, id: '0002' }, { ...valid, instructions: [] }, { ...valid, instructions: [null] }, { ...valid, instructionsZh: [''] }, { ...valid, description: 'x'.repeat(4001) }]) {
    assert.throws(() => parseExerciseContent({ schemaVersion: 1, exercises: { '0001': entry } }, '0001'));
  }
  assert.throws(() => parseExerciseContent({ schemaVersion: 2, exercises: { '0001': valid } }, '0001'));
  assert.throws(() => parseExerciseContent({ schemaVersion: 1, exercises: {} }, '0001'));
});

test('source muscle and equipment names share Forma filters without treating cardio as a muscle', () => {
  const cardio = openGymExercises.find(item => item.category === 'cardio' && item.primaryMuscles.length === 0)!;
  assert.equal(cardio.category, 'cardio');
  assert.deepEqual(cardio.primaryMuscles, []);
  assert.equal(openGymExercises.find(item => item.sourceId === '0001')!.primaryMuscles[0], 'abdominals');
  assert.equal(openGymExercises.find(item => item.sourceId === '0001')!.equipment, 'body only');
  for (const exercise of openGymExercises) {
    for (const muscle of exercise.primaryMuscles) assert.notEqual(muscleLabel(muscle, 'zh'), muscle);
    if (exercise.equipment) assert.notEqual(equipmentLabel(exercise.equipment, 'zh'), exercise.equipment);
  }
});
