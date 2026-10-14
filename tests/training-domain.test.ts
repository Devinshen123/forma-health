import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { civilDay, estimated1RM, kilograms, progressionSuggestions, scheduledRoutine, trainingStats } from '../src/training/domain';
import type { CatalogExercise, Exercise, SetLog, TrainingRoutine, TrainingSchedule, Workout } from '../src/types';

const catalog: CatalogExercise[] = [{ id: 'bench', name: 'Bench press', nameZh: '卧推', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'], equipment: 'barbell', category: 'strength', level: 'beginner', instructions: [] }];
const set = (patch: Partial<SetLog> = {}): SetLog => ({ id: randomUUID(), kind: 'work', reps: 8, weight: 60, durationSeconds: null, distanceMeters: null, rpe: 7, rir: null, completed: true, ...patch });
const exercise = (logs?: SetLog[], patch: Partial<Exercise> = {}): Exercise => ({ name: 'Bench press', sets: 3, reps: 8, weight: 60, ...(logs ? { setLogs: logs } : {}), ...patch });
const workout = (logs?: SetLog[], patch: Partial<Workout> = {}): Workout => ({ id: randomUUID(), date: '2026-10-14', name: 'Session', duration: 45, rpe: null, exercises: [exercise(logs)], notes: '', createdAt: '2026-10-14T12:00:00Z', ...patch });
const routine = (): TrainingRoutine => ({ id: randomUUID(), name: 'Bench day', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', exercises: [{ id: randomUUID(), name: 'Bench press', exerciseId: 'bench', primaryMuscles: ['chest'], setCount: 2, repsMin: 6, repsMax: 8, weight: 60, restSeconds: 90, supersetGroup: null, progression: { enabled: true, incrementKg: 2.5 } }] });
const achieved = (date: string, patch: Partial<Workout> = {}) => workout([set(), set()], { date, createdAt: `${date}T12:00:00Z`, exercises: [exercise([set(), set()], { exerciseId: 'bench' })], ...patch });

test('bounded e1RM preserves one-rep load, converts pounds and refuses missing or out-of-scope estimates', () => {
  assert.equal(estimated1RM(100, 1), 100);
  assert.equal(estimated1RM(90, 10), 120);
  assert.ok(Math.abs(kilograms(220, 'lb') - 99.7903214) < 1e-9);
  for (const [weight, reps] of [[null, 5], [0, 5], [-1, 5], [NaN, 5], [Infinity, 5], [100, null], [100, 0], [100, 11], [100, 2.5]]) assert.equal(estimated1RM(weight, reps), null);
});

test('stats distinguish legacy summaries from real performed sets without inventing PRs', () => {
  const legacy = workout();
  const detailed = workout([set(), set({ kind: 'warmup', weight: 200 }), set({ completed: false, weight: 200 }), set({ weight: null, reps: null, durationSeconds: 45 }), set({ weight: 0, reps: 12 }), set({ weight: 100, reps: null, distanceMeters: 500 }), set({ weight: null, reps: 8 })]);
  const before = JSON.stringify([legacy, detailed]);
  const stats = trainingStats([legacy, detailed], catalog);
  assert.equal(stats.loggedWorkouts, 2); assert.equal(stats.legacyWorkouts, 1); assert.equal(stats.detailedWorkouts, 1);
  assert.equal(stats.completedSets, 3); assert.equal(stats.volumeKg, 480); assert.equal(stats.unknownLoadSets, 1);
  assert.deepEqual(stats.muscleSets, { chest: 3 }); assert.equal(Object.hasOwn(stats.muscleSets, 'triceps'), false);
  assert.equal(stats.personalRecords[0].bestWeightKg, 60); assert.equal(stats.personalRecords[0].bestReps, 12);
  assert.equal(stats.personalRecords[0].bestEstimated1RMKg, 76);
  assert.equal(JSON.stringify([legacy, detailed]), before);
});

test('known zero volume differs from absent volume and ambiguous names do not manufacture muscle coverage', () => {
  assert.equal(trainingStats([], catalog).volumeKg, null);
  assert.equal(trainingStats([workout([set({ weight: 0 })])], catalog).volumeKg, 0);
  const unknown = workout([set()], { exercises: [exercise([set()], { name: 'Custom lift', primaryMuscles: ['invented muscle'] })] });
  const stats = trainingStats([unknown], catalog);
  assert.deepEqual(stats.muscleSets, {}); assert.equal(stats.unknownMuscleSets, 1);
  const ambiguous = trainingStats([workout([set()])], [...catalog, { ...catalog[0], id: 'different-bench' }]);
  assert.equal(ambiguous.unknownMuscleSets, 1);
  const knownId = trainingStats([workout([set()], { exercises: [exercise([set()], { name: 'My own name', exerciseId: 'bench' })] })], catalog);
  assert.equal(knownId.muscleSets.chest, 1);
});

test('PR comparisons use completed loads; drop sets count while high-rep estimates remain unknown', () => {
  const first = workout([set({ weight: 60, reps: 10 })], { date: '2026-10-10' });
  const parent = set({ weight: 80, reps: 5 }), drop = set({ kind: 'drop', weight: 65, reps: 8, dropParentId: parent.id });
  const second = workout([parent, drop, set({ weight: 100, reps: 12 })]);
  const stats = trainingStats([second, first], catalog);
  assert.equal(stats.completedSets, 4);
  assert.equal(stats.personalRecords[0].bestWeightKg, 100);
  assert.ok(Math.abs(stats.personalRecords[0].bestEstimated1RMKg! - 80 * (1 + 5 / 30)) < 1e-8);
  assert.equal(stats.personalRecords[0].setId, parent.id);
});

test('progression is a reversible proposal after two distinct recent sessions, never a mutation', () => {
  const plan = routine(), history = [achieved('2026-10-10'), achieved('2026-10-14')];
  const before = JSON.stringify([plan, history]);
  const proposals = progressionSuggestions(plan, history);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].exerciseId, plan.exercises[0].id); assert.equal(proposals[0].fromWeight, 60); assert.equal(proposals[0].toWeight, 62.5);
  assert.deepEqual(proposals[0].evidenceWorkoutIds, [history[0].id, history[1].id]);
  assert.equal(JSON.stringify([plan, history]), before);
  assert.equal(progressionSuggestions(plan, [history[1]]).length, 0);
  assert.equal(progressionSuggestions(plan, [history[1], history[1]]).length, 0);
});

test('one bad latest attempt blocks progression; older successes are not cherry-picked', () => {
  const history = [achieved('2026-10-01'), achieved('2026-10-05')];
  for (const patch of [{ completed: false }, { reps: null }, { reps: 7 }, { weight: null }, { weight: 59 }, { rpe: 9 }, { rpe: null, rir: null }, { rpe: 7, rir: 1 }]) {
    const latest = achieved('2026-10-14', { exercises: [exercise([set(), set(patch)], { exerciseId: 'bench' })] });
    assert.equal(progressionSuggestions(routine(), [...history, latest]).length, 0, JSON.stringify(patch));
  }
  assert.equal(progressionSuggestions(routine(), [...history, achieved('2026-10-14', { rpe: 9 })]).length, 0);
  const legacy = achieved('2026-10-14', { exercises: [exercise(undefined, { exerciseId: 'bench' })] });
  assert.equal(progressionSuggestions(routine(), [...history, legacy]).length, 0);
});

test('progression excludes warmups and drops from the prescribed work-set count and requires recorded effort', () => {
  const plan = routine();
  const reps = (date: string) => achieved(date, { exercises: [exercise([set(), set({ kind: 'warmup' }), set({ kind: 'drop' })], { exerciseId: 'bench' })] });
  assert.equal(progressionSuggestions(plan, [reps('2026-10-10'), reps('2026-10-14')]).length, 0);
  const rirOnly = (date: string) => achieved(date, { exercises: [exercise([set({ rpe: null, rir: 3 }), set({ rpe: null, rir: 2 })], { exerciseId: 'bench' })] });
  assert.equal(progressionSuggestions(plan, [rirOnly('2026-10-10'), rirOnly('2026-10-14')]).length, 1);
  plan.exercises[0].weight = 0;
  assert.equal(progressionSuggestions(plan, [rirOnly('2026-10-10'), rirOnly('2026-10-14')]).length, 0);
});

test('a new routine version cannot reuse old qualifying sessions to repeatedly increase its target', () => {
  const original = routine(), newer = { ...structuredClone(original), id: randomUUID(), supersedesId: original.id };
  const highLoad = (date: string, routineId?: string) => achieved(date, { routineId, exercises: [exercise([set({ weight: 100 }), set({ weight: 100 })], { exerciseId: 'bench' })] });
  const previous = [highLoad('2026-10-10', original.id), highLoad('2026-10-11', original.id)];
  const before = JSON.stringify(previous);
  assert.equal(progressionSuggestions(original, previous).length, 1);
  assert.equal(progressionSuggestions(newer, previous).length, 0);
  const oneNew = highLoad('2026-10-12', newer.id);
  assert.equal(progressionSuggestions(newer, [...previous, oneNew]).length, 0);
  assert.equal(progressionSuggestions(newer, [...previous, oneNew, highLoad('2026-10-14', newer.id)]).length, 1);
  const next = { ...newer, id: randomUUID(), supersedesId: newer.id };
  assert.equal(progressionSuggestions(next, [...previous, oneNew, highLoad('2026-10-14', newer.id)]).length, 0);
  assert.equal(JSON.stringify(previous), before);
});

test('civil dates validate actual leap days, rotation advances by date across DST and weekly uses Sunday zero', () => {
  assert.equal(civilDay('2026-02-29'), null); assert.notEqual(civilDay('2024-02-29'), null); assert.equal(civilDay('2026-13-01'), null);
  const schedule: TrainingSchedule = { id: randomUUID(), name: 'Rotation', mode: 'rotation', anchorDate: '2026-03-07', slots: [{ id: randomUUID(), routineId: 'A' }, { id: randomUUID(), routineId: null }, { id: randomUUID(), routineId: 'B' }], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
  assert.equal(scheduledRoutine(schedule, '2026-03-06'), null); assert.equal(scheduledRoutine(schedule, '2026-03-07'), 'A'); assert.equal(scheduledRoutine(schedule, '2026-03-08'), null); assert.equal(scheduledRoutine(schedule, '2026-03-09'), 'B'); assert.equal(scheduledRoutine(schedule, '2026-03-10'), 'A');
  schedule.mode = 'weekly'; schedule.slots = [{ id: randomUUID(), routineId: 'Sunday', weekday: 0 }, { id: randomUUID(), routineId: 'Monday', weekday: 1 }];
  assert.equal(scheduledRoutine(schedule, '2026-03-08'), 'Sunday'); assert.equal(scheduledRoutine(schedule, '2026-03-09'), 'Monday'); assert.equal(scheduledRoutine(schedule, '2026-03-10'), null);
  schedule.slots.push({ id: randomUUID(), routineId: 'ambiguous', weekday: 1 }); assert.equal(scheduledRoutine(schedule, '2026-03-09'), null);
  schedule.mode = 'rotation'; assert.equal(scheduledRoutine(schedule, '2026-03-09'), null);
});
