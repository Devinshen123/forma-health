import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseTrainingImport } from '../src/training/import';
import { trainingStats } from '../src/training/domain';
import type { Workout } from '../src/types';

test('exported short timed workouts round-trip without inventing repetitions or load', () => {
  const workout: Workout = {
    id: randomUUID(), name: 'Synthetic timed movement', date: '2026-10-18', duration: 0.5,
    rpe: null, notes: '', createdAt: '2026-10-18T10:00:00.000Z',
    exercises: [{ id: randomUUID(), name: 'Synthetic timed movement', sets: 1, reps: null, weight: null,
      setLogs: [{ id: randomUUID(), kind: 'work', completed: true, reps: null, weight: null, durationSeconds: 30, distanceMeters: null, rpe: null, rir: null }],
    }],
  };
  const options = { timezone: 'UTC', weightUnit: 'kg' as const, existing: [], catalog: [] };
  const preview = parseTrainingImport(JSON.stringify({ workouts: [workout] }), 'forma', options);
  assert.deepEqual(preview.issues, []); assert.equal(preview.workouts.length, 1);
  const restored = preview.workouts[0];
  assert.equal(restored.duration, 0.5); assert.equal(restored.exercises[0].reps, null); assert.equal(restored.exercises[0].weight, null);
  assert.equal(restored.exercises[0].setLogs![0].durationSeconds, 30);
  const stats = trainingStats(preview.workouts, []);
  assert.equal(stats.completedSets, 1); assert.equal(stats.volumeKg, null);
  const noFacts = structuredClone(workout); noFacts.exercises[0].setLogs = [];
  assert.ok(parseTrainingImport(JSON.stringify({ workouts: [noFacts] }), 'forma', options).issues.length > 0);
});
