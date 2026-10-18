import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectWorkbenchWorkouts } from './training-workbench-projection';
import { workoutSchema } from './training-validation';
import { trainingStats } from '../src/training/domain';

const START = Date.parse('2026-10-18T10:00:00.000Z');
const OWNER = 'synthetic-owner';
const row = (overrides: Record<string, unknown> = {}) => ({ w: 60, r: 8, done: true, ...overrides });
const entry = (sets: unknown[] = [row()], overrides: Record<string, unknown> = {}) => ({ id: '0009', sets, ...overrides });
const workout = (overrides: Record<string, unknown> = {}) => ({ id: 'source-session-1', d: '2026-10-18', start: START, end: START + 45 * 60000, name: 'Synthetic completed session', entries: [entry()], ...overrides });
const state = (workouts: unknown[] = [workout()], overrides: Record<string, unknown> = {}) => ({ unit: 'kg', customEx: [], workouts, ...overrides });

test('projects the real completed shape, preserving warm-ups, effort, timestamps and notes without planned values', () => {
  const source = state([workout({
    end: START + 45.25 * 60000, note: 'Synthetic session note', rpe: 8,
    entries: [entry([
      row({ w: 20, r: 5, warmup: true, at: START + 30000 }),
      row({ w: 60, r: 8, rpe: 7.5, rir: 2.5, phase: 'work', at: START + 90000 }),
      row({ w: 999, r: 999, done: false }),
    ], { target: { weight: 777, reps: 555, mode: 'reps' }, topW: 888, note: 'Synthetic exercise note', sg: 'A' })],
  })]);
  const before = structuredClone(source);
  const projection = projectWorkbenchWorkouts(source, OWNER);
  assert.deepEqual(source, before, 'projection never mutates source state');
  assert.deepEqual(projection.warnings, []);
  const completed = projection.workouts[0], exercise = completed.exercises[0], sets = exercise.setLogs!;
  assert.equal(completed.duration, 45.25);
  assert.equal(completed.rpe, 8);
  assert.equal(completed.createdAt, new Date(START).toISOString());
  assert.equal(completed.source, 'forma');
  assert.equal(completed.importFingerprint, 'opengym:source-session-1');
  assert.equal(exercise.exerciseId, 'opengym-0009');
  assert.equal(exercise.supersetGroup, 'A');
  assert.equal(sets.length, 2);
  assert.deepEqual(sets.map(set => set.kind), ['warmup', 'work']);
  assert.deepEqual(sets.map(set => [set.reps, set.weight]), [[5, 20], [8, 60]]);
  assert.equal(sets[1].rpe, 7.5); assert.equal(sets[1].rir, 2.5);
  assert.equal(sets[1].completedAt, new Date(START + 90000).toISOString());
  assert.equal(exercise.reps, 8); assert.equal(exercise.weight, 60);
  assert.equal(completed.notes.includes('Synthetic session note'), true);
  assert.equal(completed.notes.includes('Synthetic exercise note'), true);
  assert.equal(workoutSchema.safeParse(completed).success, true);
});

test('converts actual pounds with the exact SI factor and preserves explicit zero load', () => {
  const projection = projectWorkbenchWorkouts(state([workout({ entries: [entry([row({ w: 100 }), row({ w: 0, r: 12 })])] })], { unit: 'lb' }), OWNER);
  assert.deepEqual(projection.warnings, []);
  const sets = projection.workouts[0].exercises[0].setLogs!;
  assert.equal(sets[0].weight, 100 * 0.45359237);
  assert.equal(sets[1].weight, 0);
});

test('keeps missing timed/cardio values null, actual fractional minutes, and does not invent distance from speed', () => {
  const projection = projectWorkbenchWorkouts(state([workout({
    end: START + 30000,
    entries: [
      entry([{ sec: 20, done: true }], { id: 'synthetic-hold', n: 'Synthetic hold', target: { mode: 'time', weight: 99, sec: 600 } }),
      entry([{ min: 12, speed: 8, done: true }], { id: 'synthetic-run', n: 'Synthetic run', target: { mode: 'cardio', min: 30, speed: 15 } }),
    ],
  })]), OWNER);
  assert.deepEqual(projection.warnings, []);
  assert.equal(projection.workouts[0].duration, 0.5);
  const [hold, run] = projection.workouts[0].exercises;
  assert.equal(hold.reps, null); assert.equal(hold.weight, null);
  assert.equal(run.reps, null); assert.equal(run.weight, null);
  assert.equal(hold.setLogs![0].durationSeconds, 20);
  assert.equal(run.setLogs![0].durationSeconds, 720);
  for (const action of [hold, run]) {
    const actual = action.setLogs![0];
    assert.equal(actual.reps, null); assert.equal(actual.weight, null);
    assert.equal(actual.distanceMeters, null); assert.equal(actual.rpe, null); assert.equal(actual.rir, null);
  }
  assert.equal(workoutSchema.safeParse(projection.workouts[0]).success, true);
});

test('unilateral completed limbs keep their own loads and never copy the aggregate or the unfinished limb', () => {
  const projection = projectWorkbenchWorkouts(state([workout({ entries: [entry([
    row({ w: 1000, r: 1000, done: true, sides: { L: row({ w: 10, r: 8 }), R: row({ w: 12, r: 6 }) } }),
    row({ w: 1000, r: 1000, done: false, sides: { L: row({ w: 14, r: 4 }), R: row({ w: 999, r: 999, done: false }) } }),
  ])] })]), OWNER);
  assert.deepEqual(projection.warnings, []);
  const [left, right] = projection.workouts[0].exercises;
  assert.match(left.name, /\(left\)$/); assert.match(right.name, /\(right\)$/);
  assert.deepEqual(left.setLogs!.map(set => [set.weight, set.reps]), [[10, 8], [14, 4]]);
  assert.deepEqual(right.setLogs!.map(set => [set.weight, set.reps]), [[12, 6]]);
  assert.equal(trainingStats(projection.workouts, []).volumeKg, 10 * 8 + 14 * 4 + 12 * 6);
});

test('projects completed drop children with their parent and does not double-count rest-pause bursts', () => {
  const projection = projectWorkbenchWorkouts(state([workout({ entries: [entry([
    row({ type: 'dropset', drops: [{ w: 40, r: 6 }, { w: 30, r: 5 }] }),
    row({ type: 'restpause', w: 40, r: 15, clusters: [{ r: 5, restSec: 15 }, { r: 3, restSec: 15 }] }),
    row({ done: false, type: 'dropset', drops: [{ w: 999, r: 999 }] }),
  ])] })]), OWNER);
  assert.deepEqual(projection.warnings, []);
  const sets = projection.workouts[0].exercises[0].setLogs!;
  assert.deepEqual(sets.map(set => set.kind), ['work', 'drop', 'drop', 'work']);
  assert.equal(sets[1].dropParentId, sets[0].id);
  assert.equal(sets[2].dropParentId, sets[0].id);
  assert.equal(sets[3].reps, 15);
  assert.equal(trainingStats(projection.workouts, []).volumeKg, 60 * 8 + 40 * 6 + 30 * 5 + 40 * 15);
});

test('uses only finished history and warns about incomplete actual evidence instead of importing targets', () => {
  const active = { ...workout(), entries: [entry([row({ w: 999, r: 999 })])] };
  assert.deepEqual(projectWorkbenchWorkouts({ unit: 'kg', active, routines: [{ ex: [{ weight: 999, reps: 999 }] }] }, OWNER), { workouts: [], warnings: [] });
  const source = state([workout({ entries: [entry([{ r: 8, done: true }], { target: { weight: 100, reps: 12 }, topW: 100 })] })], { active });
  const result = projectWorkbenchWorkouts(source, OWNER);
  assert.deepEqual(result.workouts, []);
  assert.deepEqual(result.warnings.map(warning => warning.code), ['incomplete_measurements']);
  assert.equal(JSON.stringify(result).includes('999'), false);
});

test('returns explicit compatibility warnings for retained raw histories without making up duration or summaries', () => {
  const records = [
    workout({ id: 'unknown-duration', end: START }),
    workout({ id: 'missing-date', d: undefined }),
    workout({ id: 'empty-session', entries: [] }),
    workout({ id: 'legacy-summary', entries: [{ id: '0009', topW: 100 }] }),
    workout({ id: 'too-large', entries: [entry([row({ w: 2001 })])] }),
    workout({ id: 'each-bell', entries: [entry([row()], { target: { dbLoad: 'each' } })] }),
  ];
  const source = state(records), before = structuredClone(source);
  const result = projectWorkbenchWorkouts(source, OWNER);
  assert.deepEqual(source, before);
  assert.deepEqual(result.workouts, []);
  assert.deepEqual(result.warnings.map(warning => warning.code), ['missing_duration', 'missing_date', 'no_completed_sets', 'legacy_entry_without_sets', 'unsupported_forma_limits', 'unsupported_load_semantics']);
  assert.equal(new Set(result.warnings.map(warning => warning.id)).size, records.length);
  for (const warning of result.warnings) assert.match(warning.id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('keeps custom and deleted exercise facts under distinct names without guessing catalog identities', () => {
  const result = projectWorkbenchWorkouts(state([workout({ entries: [
    entry([row()], { id: 'custom-1' }),
    entry([row()], { id: 'deleted-1', name: 'Provided deleted exercise name' }),
    entry([row()], { id: 'deleted-2' }),
  ] })], { customEx: [{ id: 'custom-1', n: 'Synthetic custom movement' }] }), OWNER);
  assert.deepEqual(result.warnings, []);
  const [custom, named, deleted] = result.workouts[0].exercises;
  assert.equal(custom.name, 'Synthetic custom movement');
  assert.equal(named.name, 'Provided deleted exercise name');
  assert.equal(deleted.name, 'Unknown exercise (deleted-2)');
  assert.equal(custom.exerciseId, 'opengym-custom:custom-1');
  assert.deepEqual(custom.primaryMuscles, []);
});

test('projection identities are stable per account, idempotent across calls and isolated from source ownership claims', () => {
  const source = state([workout({ user_id: 'another-owner' })], { userId: 'another-owner' });
  const first = projectWorkbenchWorkouts(source, OWNER);
  const second = projectWorkbenchWorkouts(structuredClone(source), OWNER);
  assert.deepEqual(first, second);
  const otherAccount = projectWorkbenchWorkouts(source, 'another-owner');
  assert.notEqual(first.workouts[0].id, otherAccount.workouts[0].id);
  assert.notEqual(first.workouts[0].exercises[0].id, otherAccount.workouts[0].exercises[0].id);
  assert.notEqual(first.workouts[0].exercises[0].setLogs![0].id, otherAccount.workouts[0].exercises[0].setLogs![0].id);
  const edit = projectWorkbenchWorkouts(state([workout({ note: 'Changed synthetic note' })]), OWNER);
  assert.equal(edit.workouts[0].id, first.workouts[0].id);
  assert.equal(edit.workouts[0].exercises[0].setLogs![0].id, first.workouts[0].exercises[0].setLogs![0].id);
});

test('valid source history predating workout IDs uses its own civil-day/start stable identity', () => {
  const legacy = workout({ id: undefined });
  const first = projectWorkbenchWorkouts(state([legacy]), OWNER);
  const second = projectWorkbenchWorkouts(state([structuredClone(legacy)]), OWNER);
  assert.deepEqual(first.warnings, []);
  assert.deepEqual(first, second);
  const sourceKey = `2026-10-18|${START}`;
  assert.equal(first.workouts[0].importFingerprint, `opengym:${sourceKey}`);
  const promoted = projectWorkbenchWorkouts(state([workout({ id: sourceKey })]), OWNER);
  assert.equal(promoted.workouts[0].id, first.workouts[0].id, 'source date editor promotes the old key to id without changing identity');
  const missing = projectWorkbenchWorkouts(state([workout({ id: undefined, start: undefined })]), OWNER);
  const explicitNull = projectWorkbenchWorkouts(state([workout({ id: undefined, start: null })]), OWNER);
  assert.equal(missing.warnings[0].code, 'missing_duration');
  assert.equal(explicitNull.warnings[0].code, 'missing_duration');
  assert.notEqual(missing.warnings[0].id, explicitNull.warnings[0].id, 'undefined and null source keys stay distinct');
  assert.throws(() => projectWorkbenchWorkouts(state([legacy, legacy]), OWNER), { message: 'Invalid training workbench data' });
});

test('malformed history fails atomically with one generic error and never echoes recorded content', () => {
  const malformed: unknown[] = [
    [], null, state([], { unit: 'stone' }),
    state([workout({ d: '2026-02-30' })]),
    state([workout({ end: START - 1 })]),
    state([workout({ entries: [entry([row({ w: 'private recorded content' })])] })]),
    state([workout({ entries: [entry([row({ w: -1 })])] })]),
    state([workout({ entries: [entry([row({ r: 2.5 })])] })]),
    state([workout({ entries: [entry([row({ done: 'true' })])] })]),
    state([workout({ entries: [entry([row({ sides: { L: row(), R: null } })])] })]),
    state([workout({ entries: [entry([row({ rpe: 11 })])] })]),
    state([workout({ entries: [entry([row({ type: 'dropset', drops: [{ w: -5, r: 5 }] })])] })]),
    state([workout(), workout()]),
    state([workout({ end: START, entries: [entry([row({ w: NaN })])] })]),
  ];
  for (const input of malformed) assert.throws(() => projectWorkbenchWorkouts(input, OWNER), error => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'Invalid training workbench data');
    return true;
  });
});
