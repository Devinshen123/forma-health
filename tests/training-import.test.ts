import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseCsv, parseTrainingImport, workoutFingerprint, type ImportOptions } from '../src/training/import';
import { trainingStats } from '../src/training/domain';
import type { CatalogExercise, SetLog, Workout } from '../src/types';

// Synthetic headers/records exercise the supported compatibility profiles.
// These fixtures are not official vendor exports or personal user data.
const catalog: CatalogExercise[] = [{ id: 'bench', name: 'Bench press', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'], equipment: 'barbell', category: 'strength', level: 'beginner', instructions: [] }];
const options: ImportOptions = { timezone: 'UTC', weightUnit: 'kg', existing: [], catalog };
const csv = (headers: string[], rows: unknown[][], delimiter = ',') => [headers, ...rows].map(row => row.map(value => { const text = String(value ?? ''); return /[",;\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }).join(delimiter)).join('\r\n');
const strongHeaders = ['Date', 'Workout Name', 'Exercise Name', 'Set Order', 'Weight', 'Reps', 'Duration', 'RPE'];
const strong = (patch: Partial<{ date: string; name: string; order: string; weight: unknown; reps: unknown; duration: string; rpe: unknown }> = {}) => csv(strongHeaders, [[patch.date ?? '2026-10-14 12:00:00', patch.name ?? 'Strength', 'Bench press', patch.order ?? '1', patch.weight ?? 60, patch.reps ?? 8, patch.duration ?? '45m', patch.rpe ?? 7]]);
const saved = (): Workout => ({ id: randomUUID(), date: '2026-10-14', name: 'Saved', duration: 45, rpe: null, exercises: [{ id: randomUUID(), name: 'Bench press', sets: 1, reps: 8, weight: 60, setLogs: [{ id: randomUUID(), kind: 'work', reps: 8, weight: 60, durationSeconds: null, distanceMeters: null, rpe: 7, rir: null, completed: true }] }], notes: '', createdAt: '2026-10-14T12:00:00Z' });

test('RFC quoting preserves commas, escaped quotes and multiline text; malformed rows do not recover silently', () => {
  assert.deepEqual(parseCsv('one,two\r\n"a,b","quote ""two""\r\nlines"\r\n'), [['one', 'two'], ['a,b', 'quote "two"\r\nlines']]);
  assert.throws(() => parseCsv('one,two\n"unfinished,two'), /Unterminated/);
  assert.throws(() => parseCsv('one,two\n"quoted"garbage,two'), /Unexpected text/);
  const rows = csv([...strongHeaders, 'Notes'], [['2026-10-14 12:00:00', 'A, "B"', 'Bench press', 1, 60, 8, '45m', '', 'first\nsecond']]);
  const preview = parseTrainingImport(rows, 'strong', options);
  assert.deepEqual(preview.issues, []); assert.equal(preview.workouts[0].name, 'A, "B"'); assert.ok(preview.workouts[0].notes.includes('first\nsecond'));
});

test('Strong preview groups set rows, recognizes metadata and excludes warmups from real totals', () => {
  const text = csv([...strongHeaders, 'Seconds'], [['2026-10-14 12:00:00', 'Strength', 'Bench press', 'W1', 30, 10, '45m', '', 0], ['2026-10-14 12:00:00', 'Strength', 'Bench press', '1', 60, 8, '45m', 7, 0], ['2026-10-14 12:00:00', 'Strength', 'Bench press', 'Rest Timer', '', '', '45m', '', 90]], ';');
  const preview = parseTrainingImport('\ufeff' + text, 'strong', options);
  assert.deepEqual(preview.issues, []); assert.equal(preview.workouts.length, 1); assert.equal(preview.workouts[0].exercises[0].setLogs?.length, 2); assert.equal(preview.workouts[0].exercises[0].restSeconds, 90);
  assert.equal(trainingStats(preview.workouts, catalog).completedSets, 1);
});

test('units prefer explicit kg/lb headers; absent units use the user selection and conflicting units fail', () => {
  const pounds = parseTrainingImport(strong({ weight: 220 }), 'strong', { ...options, weightUnit: 'lb' });
  assert.ok(Math.abs(pounds.workouts[0].exercises[0].setLogs![0].weight! - 99.7903214) < 1e-9);
  const text = csv(['Date', 'Workout Name', 'Exercise Name', 'Set Order', 'Weight (kg)', 'Reps', 'Duration (sec)'], [['2026-10-14 12:00:00', 'Strength', 'Bench press', 1, 60, 8, 2700]]);
  const kilos = parseTrainingImport(text, 'strong', { ...options, weightUnit: 'lb' });
  assert.equal(kilos.workouts[0].duration, 45); assert.equal(kilos.workouts[0].exercises[0].setLogs![0].weight, 60);
  const conflict = csv(['Date', 'Workout Name', 'Exercise Name', 'Set Order', 'Weight (kg)', 'Weight Unit', 'Reps'], [['2026-10-14', 'Strength', 'Bench press', 1, 60, 'lb', 8]]);
  assert.equal(parseTrainingImport(conflict, 'strong', options).workouts.length, 0);
});

test('unknown values survive preview as null; zero remains explicit and missing duration demands UI correction', () => {
  const unknown = parseTrainingImport(strong({ weight: '', reps: '', rpe: '', duration: '' }), 'strong', options);
  assert.deepEqual(unknown.issues, []); const workout = unknown.workouts[0], set = workout.exercises[0].setLogs![0];
  assert.equal(workout.duration, 0); assert.equal(workout.rpe, null); assert.equal(set.reps, null); assert.equal(set.weight, null); assert.equal(set.rpe, null); assert.equal(set.completed, false);
  const zero = parseTrainingImport(strong({ weight: 0 }), 'strong', options).workouts[0];
  assert.equal(zero.exercises[0].setLogs![0].weight, 0); assert.equal(zero.exercises[0].setLogs![0].completed, true);
  assert.equal(trainingStats([zero], catalog).personalRecords[0].bestEstimated1RMKg, null);
});

test('Hevy preserves supersets, drop parent relations, actual cross-midnight date and UTC offset', () => {
  const headers = ['title', 'start_time', 'end_time', 'description', 'exercise_title', 'superset_id', 'exercise_notes', 'set_index', 'set_type', 'weight_kg', 'reps', 'distance_meters', 'duration_seconds', 'rpe'];
  const text = csv(headers, [['Session', '2026-10-14T23:45:00-07:00', '2026-10-15T00:30:00-07:00', '', 'Bench press', 'A', 'slow', 0, 'normal', 60, 8, '', '', 7], ['Session', '2026-10-14T23:45:00-07:00', '2026-10-15T00:30:00-07:00', '', 'Bench press', 'A', 'slow', 1, 'dropset', 45, 8, '', '', 8]]);
  const preview = parseTrainingImport(text, 'hevy', { ...options, timezone: 'America/Los_Angeles', weightUnit: 'lb' });
  assert.deepEqual(preview.issues, []); const workout = preview.workouts[0], exercise = workout.exercises[0];
  assert.equal(workout.date, '2026-10-14'); assert.equal(workout.duration, 45); assert.equal(workout.createdAt, '2026-10-15T06:45:00.000Z'); assert.equal(exercise.supersetGroup, 'A');
  assert.equal(exercise.setLogs![0].weight, 60); assert.equal(exercise.setLogs![1].dropParentId, exercise.setLogs![0].id);
  assert.ok(workout.notes.includes('slow')); assert.equal(trainingStats([workout], catalog).completedSets, 2);
});

test('FitNotes keeps timed/cardio records separate from unknown load and never makes an e1RM from time', () => {
  const text = csv(['Date', 'Exercise', 'Category', 'Weight (kg)', 'Reps', 'Distance (km)', 'Time', 'Comment'], [['2026-10-14', 'Custom run', 'Cardio', '', '', 2.5, '0:20:00', 'steady'], ['2026-10-14', 'Bench press', 'Chest', 0, 10, '', '', '']]);
  const preview = parseTrainingImport(text, 'fitnotes', options);
  assert.deepEqual(preview.issues, []); assert.equal(preview.workouts[0].duration, 0);
  const run = preview.workouts[0].exercises[0].setLogs![0];
  assert.equal(run.distanceMeters, 2500); assert.equal(run.durationSeconds, 1200); assert.equal(run.weight, null); assert.equal(run.completed, true);
  const stats = trainingStats(preview.workouts, catalog);
  assert.equal(stats.completedSets, 2); assert.equal(stats.unknownMuscleSets, 1); assert.equal(stats.unknownLoadSets, 1); assert.equal(stats.personalRecords.length, 1);
});

test('DST nonexistent and ambiguous local times fail; offset ISO and unambiguous local dates resolve explicitly', () => {
  const opts = { ...options, timezone: 'America/Los_Angeles' };
  for (const date of ['2026-03-08 02:30:00', '2026-11-01 01:30:00']) {
    const result = parseTrainingImport(strong({ date }), 'strong', opts);
    assert.equal(result.workouts.length, 0); assert.equal(result.issues.length, 1);
  }
  const offset = parseTrainingImport(strong({ date: '2026-11-01T01:30:00-07:00' }), 'strong', opts);
  assert.deepEqual(offset.issues, []); assert.equal(offset.workouts[0].createdAt, '2026-11-01T08:30:00.000Z');
  assert.equal(parseTrainingImport(strong({ date: '2026-03-08 03:30:00' }), 'strong', opts).workouts[0].createdAt, '2026-03-08T10:30:00.000Z');
  assert.equal(parseTrainingImport(strong({ date: '14 Oct 2026, 12:00' }), 'strong', options).workouts[0].date, '2026-10-14');
  assert.equal(parseTrainingImport(strong(), 'strong', { ...options, timezone: 'Definitely/Invalid' }).workouts.length, 0);
});

test('invalid days, locale-ambiguous dates, values and later bad rows reject the entire preview', () => {
  for (const patch of [{ date: '2026-02-30 12:00:00' }, { date: '10/11/2026 12:00:00' }, { date: '2026-10-14T12:00:00+14:30' }, { reps: -1 }, { reps: 'eight' }, { reps: 2.5 }, { weight: '-5' }, { rpe: 0 }, { duration: '45' }]) {
    const result = parseTrainingImport(strong(patch), 'strong', options);
    assert.equal(result.workouts.length, 0, JSON.stringify(patch)); assert.ok(result.issues.length);
  }
  const bad = csv(strongHeaders, [['2026-10-14', 'Valid', 'Bench press', 1, 60, 8, '45m', 7], ['bad', 'Private name sentinel', 'Bench press', 1, 60, 8, '45m', 7]]);
  const result = parseTrainingImport(bad, 'strong', options);
  assert.equal(result.workouts.length, 0); assert.match(result.issues[0], /Row 3/); assert.ok(!result.issues[0].includes('Private name sentinel'));
});

test('unknown headers, duplicate indices and unsupported set types report errors instead of discarding information', () => {
  const unknown = csv([...strongHeaders, 'user_id'], [['2026-10-14', 'S', 'Bench press', 1, 60, 8, '45m', '', 'forged']]);
  assert.ok(parseTrainingImport(unknown, 'strong', options).issues.length);
  assert.ok(parseTrainingImport(strong({ order: 'magic' }), 'strong', options).issues.length);
  const repeated = csv(strongHeaders, [['2026-10-14', 'S', 'Bench press', 1, 60, 8, '45m', ''], ['2026-10-14', 'S', 'Bench press', 1, 50, 8, '45m', '']]);
  assert.ok(parseTrainingImport(repeated, 'strong', options).issues.length);
  const missingUnit = csv([...strongHeaders, 'Distance'], [['2026-10-14', 'S', 'Bench press', 1, 60, 8, '45m', '', 2]]);
  assert.ok(parseTrainingImport(missingUnit, 'strong', options).issues.length);
});

test('import deduplication is deterministic across new IDs and preserves a manually edited previous import', () => {
  const first = parseTrainingImport(strong(), 'strong', options), second = parseTrainingImport(strong(), 'strong', options);
  assert.notEqual(first.workouts[0].id, second.workouts[0].id); assert.equal(first.workouts[0].importFingerprint, second.workouts[0].importFingerprint);
  const previous = { ...first.workouts[0], duration: 50, notes: 'manually edited' };
  const again = parseTrainingImport(strong(), 'strong', { ...options, existing: [previous] });
  assert.equal(again.workouts.length, 0); assert.equal(again.duplicates, 1); assert.equal(previous.notes, 'manually edited');
  assert.notEqual(workoutFingerprint(first.workouts[0]), workoutFingerprint(previous));
});

test('Forma exports import only training, retain legacy summaries and regenerate identities without AI or account data', () => {
  const workout = saved(), before = JSON.stringify(workout);
  const preview = parseTrainingImport(JSON.stringify({ format: 'forma-export', schemaVersion: 1, user: { id: 'untrusted' }, assets: [{ id: 'private' }], aiDrafts: [{ id: 'private' }], state: { workouts: [workout, { ...workout, id: randomUUID(), exercises: [{ name: 'Legacy', sets: 3, reps: 8, weight: 60 }] }] } }), 'forma', options);
  assert.deepEqual(preview.issues, []); assert.equal(preview.workouts.length, 2); assert.notEqual(preview.workouts[0].id, workout.id);
  assert.equal(preview.workouts[0].exercises[0].exerciseId, 'bench'); assert.equal(preview.workouts[0].source, 'forma'); assert.equal(preview.workouts[1].exercises[0].setLogs, undefined);
  assert.ok(!JSON.stringify(preview).includes('untrusted')); assert.equal(JSON.stringify(workout), before);
  assert.equal(trainingStats(preview.workouts, catalog).legacyWorkouts, 1);
});

test('Forma refuses forged permissions/provenance fields at each imported nesting level', () => {
  for (const location of ['workout', 'exercise', 'set']) {
    const workout = saved();
    const target = location === 'workout' ? workout : location === 'exercise' ? workout.exercises[0] : workout.exercises[0].setLogs![0];
    Object.assign(target, { aiDraftId: 'forged', user_id: 'another-account', assetId: 'private-asset' });
    const preview = parseTrainingImport(JSON.stringify({ workouts: [workout] }), 'forma', options);
    assert.equal(preview.workouts.length, 0); assert.ok(preview.issues.length);
  }
  const unsupported = { ...saved(), source: 'ai_estimate' };
  assert.ok(parseTrainingImport(JSON.stringify({ workouts: [unsupported] }), 'forma', options).issues.length);
});

test('Forma rejects impossible completion and drop relationships and preserves null unknown logs', () => {
  const workout = saved();
  const parent = workout.exercises[0].setLogs![0];
  const unknown: SetLog = { ...parent, id: randomUUID(), reps: null, weight: null, rpe: null, completed: false };
  workout.exercises[0].setLogs!.push(unknown);
  const result = parseTrainingImport(JSON.stringify({ workouts: [workout] }), 'forma', options);
  assert.equal(result.workouts[0].exercises[0].setLogs![1].weight, null);
  unknown.completed = true;
  assert.ok(parseTrainingImport(JSON.stringify({ workouts: [workout] }), 'forma', options).issues.length);
  unknown.completed = false; unknown.kind = 'drop'; unknown.dropParentId = randomUUID();
  assert.ok(parseTrainingImport(JSON.stringify({ workouts: [workout] }), 'forma', options).issues.length);
  unknown.dropParentId = parent.id; unknown.weight = 100; unknown.reps = 5;
  assert.ok(parseTrainingImport(JSON.stringify({ workouts: [workout] }), 'forma', options).issues.length);
});

test('file byte and record limits apply before data is accepted, including UTF-8 multibyte input', () => {
  assert.match(parseTrainingImport('中'.repeat(2_000_000), 'strong', options).issues[0], /5 MiB/);
  const text = 'Date,Workout Name,Exercise Name,Set Order\n' + '2026-10-14,S,Bench press,1\n'.repeat(20001);
  assert.match(parseTrainingImport(text, 'strong', options).issues[0], /20,000/);
  assert.ok(parseTrainingImport('{}', 'forma', options).issues.length);
});
