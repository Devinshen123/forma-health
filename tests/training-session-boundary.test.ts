import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { actualSet, nextSetBeforeRest, sessionFromRoutine, workoutFromSession } from '../src/features/training/helpers';
import { workoutSchema } from '../server/training-validation';
import { trainingStats } from '../src/training/domain';
import type { ActiveWorkout, SessionExercise, TrainingRoutine } from '../src/types';

const exercise = (name: string): SessionExercise => ({ id: randomUUID(), name, primaryMuscles: [], setLogs: [], supersetGroup: 'A', restSeconds: 90, notes: '' });
const session = (exercises: SessionExercise[]): ActiveWorkout => ({ id: randomUUID(), date: '2026-10-14', name: 'Fixture training', startedAt: '2026-10-14T12:00:00Z', exercises, restEndsAt: null, notes: 'session note', rpe: null });
const completed = () => ({ ...actualSet(), completed: true, reps: 8, weight: 40 });

test('a routine target is never copied into an actual completed set', () => {
  const routine: TrainingRoutine = { id: randomUUID(), name: 'Fixture routine', createdAt: '2026-10-14T00:00:00Z', updatedAt: '2026-10-14T00:00:00Z', exercises: [{ id: randomUUID(), name: 'Row', primaryMuscles: [], setCount: 3, repsMin: 8, repsMax: 10, weight: 100, restSeconds: 90, supersetGroup: null, progression: { enabled: true, incrementKg: 2.5 } }] };
  const active = sessionFromRoutine(routine, '2026-10-14');
  assert.equal(active.exercises[0].setLogs.length, 3);
  for (const set of active.exercises[0].setLogs) { assert.equal(set.completed, false); assert.equal(set.reps, null); assert.equal(set.weight, null); }
});

test('rest follows the actual drop chain and whole superset round, without jumping to the next round', () => {
  const first = exercise('A1'), second = exercise('A2');
  const workA = completed(), dropA = { ...actualSet('drop'), dropParentId: workA.id }, workB = actualSet(), dropB = { ...actualSet('drop'), dropParentId: workB.id };
  first.setLogs = [workA, dropA, actualSet()]; second.setLogs = [workB, dropB, actualSet()];
  const active = session([first, second]);
  assert.equal(nextSetBeforeRest(active, first.id, workA.id)!.setId, dropA.id);
  dropA.completed = true; assert.equal(nextSetBeforeRest(active, first.id, dropA.id)!.setId, workB.id);
  workB.completed = true; assert.equal(nextSetBeforeRest(active, second.id, workB.id)!.setId, dropB.id);
  dropB.completed = true; assert.equal(nextSetBeforeRest(active, second.id, dropB.id), null);
  const warmup = { ...completed(), kind: 'warmup' as const }; first.setLogs.unshift(warmup);
  assert.equal(nextSetBeforeRest(active, first.id, warmup.id), null);
});

test('finish preserves actual completed facts, timed null values, valid drops and notes with stable retry identity', () => {
  const lift = exercise('Row'), timed = exercise('Hold'), untouched = exercise('Untouched');
  const parent = completed(), drop = { ...completed(), kind: 'drop' as const, weight: 30, dropParentId: parent.id };
  lift.setLogs = [parent, drop, actualSet()]; lift.notes = 'Exercise technique note';
  timed.setLogs = [{ ...actualSet(), completed: true, durationSeconds: 45 }]; untouched.setLogs = [actualSet()];
  const active = session([lift, timed, untouched]), before = JSON.stringify(active);
  const first = workoutFromSession(active, 30), second = workoutFromSession(active, 30);
  assert.equal(first.id, active.id); assert.equal(second.id, first.id); assert.equal(first.exercises.length, 2);
  assert.equal(first.exercises[0].setLogs!.length, 2); assert.equal(first.exercises[0].setLogs![1].dropParentId, parent.id);
  assert.equal(first.exercises[1].setLogs![0].reps, null); assert.equal(first.exercises[1].setLogs![0].weight, null);
  assert.ok(first.notes.includes('Exercise technique note')); assert.ok(first.notes.includes('session note'));
  assert.equal(workoutSchema.safeParse(first).success, true); assert.equal(trainingStats([first], []).completedSets, 3);
  assert.equal(JSON.stringify(active), before);
});
