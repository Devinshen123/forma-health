import { createHash } from 'node:crypto';
import { openGymExercises } from '../src/catalog/opengym';
import type { Exercise, SetLog, Workout } from '../src/types';
import { dateSchema } from './validation-primitives';
import { workoutSchema } from './training-validation';

export interface WorkbenchProjectionWarning { id: string; code: string }
export interface WorkbenchProjection { workouts: Workout[]; warnings: WorkbenchProjectionWarning[] }

type ObjectValue = Record<string, unknown>;
const catalogue = new Map(openGymExercises.map(exercise => [exercise.sourceId!, exercise]));
function invalid(): never { throw new Error('Invalid training workbench data'); }
class Unrepresentable extends Error { constructor(readonly code: string) { super(code); } }
function unavailable(code: string): never { throw new Unrepresentable(code); }
const object = (value: unknown): ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : invalid();
const list = (value: unknown, limit: number): unknown[] => Array.isArray(value) && value.length <= limit ? value : invalid();
const text = (value: unknown, max: number, fallback?: string): string => {
  if (value === undefined || value === null || value === '') return fallback ?? invalid();
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value)) return invalid();
  return value.trim() || fallback || invalid();
};
const title = (value: unknown, max: number, fallback?: string): string => {
  const result = text(value, max, fallback);
  return /[\u0000-\u001f\u007f-\u009f]/u.test(result) ? invalid() : result;
};
const number = (value: unknown, integer = false): number | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || integer && !Number.isInteger(value)) return invalid();
  return value;
};
const instant = (value: unknown): string | undefined => {
  const stamp = number(value);
  if (stamp === null) return undefined;
  const date = new Date(stamp);
  if (!Number.isFinite(date.getTime())) return invalid();
  return date.toISOString();
};
const done = (row: ObjectValue): boolean => {
  if (row.done !== undefined && typeof row.done !== 'boolean') return invalid();
  return row.done === true;
};

// Account identity comes from the session caller. Source-supplied owner fields are ignored.
function stableId(userId: string, workoutId: string, ...path: (string | number)[]): string {
  const bytes = createHash('sha256').update(JSON.stringify(['forma-workbench-v1', userId, workoutId, ...path])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sourceWorkoutId(workout: ObjectValue): string {
  if (workout.id != null) return title(workout.id, 140);
  // Preserve the source's exact pre-ID key, including null / missing start. Its date
  // editor can later promote this same key to id; that must not duplicate a Forma fact.
  number(workout.start);
  if (workout.d != null && workout.d !== '' && !dateSchema.safeParse(workout.d).success) return invalid();
  return `${workout.d}|${workout.start}`;
}

function phase(row: ObjectValue): SetLog['kind'] {
  if (row.phase === undefined || row.phase === null || row.phase === '') return row.warmup === true ? 'warmup' : 'work';
  if (typeof row.phase !== 'string') return invalid();
  const normalized = row.phase.trim().toLowerCase();
  if (['warmup', 'warm-up', 'warm_up'].includes(normalized)) return 'warmup';
  if (normalized === 'work') return 'work';
  return invalid();
}

function rowMode(row: ObjectValue, target: ObjectValue): 'reps' | 'time' | 'cardio' {
  const explicit = (value: unknown) => value === 'reps' || value === 'time' || value === 'cardio' ? value : undefined;
  if (row.mode !== undefined && !explicit(row.mode) && row.mode !== 'amrap') return invalid();
  return explicit(row.mode) ?? explicit(target.mode) ?? (row.min != null || row.speed != null ? 'cardio' : row.sec != null || row.seconds != null || row.durationSec != null ? 'time' : 'reps');
}

function actualSet(row: ObjectValue, target: ObjectValue, id: string, unit: 'kg' | 'lb', kind: SetLog['kind'], parent?: string, at?: unknown): SetLog {
  const mode = rowMode(row, target);
  const repetitions = number(row.r ?? row.reps ?? row.actualReps, true);
  const load = number(row.w);
  const seconds = number(row.sec ?? row.seconds ?? row.durationSec);
  const minutes = number(row.min);
  const rpe = number(row.rpe), rir = number(row.rir);
  if (rpe !== null && (rpe < 1 || rpe > 10) || rir !== null && rir > 20) return invalid();
  const result: SetLog = {
    id, kind,
    reps: mode === 'reps' ? repetitions : null,
    weight: load === null ? null : load * (unit === 'lb' ? 0.45359237 : 1),
    durationSeconds: mode === 'cardio' ? minutes === null || minutes === 0 ? null : minutes * 60 : mode === 'time' ? seconds === 0 ? null : seconds : null,
    // Source speed is a rate, not an observed distance. Do not manufacture distance from it.
    distanceMeters: null,
    rpe, rir, completed: true,
    ...(parent ? { dropParentId: parent } : {}),
  };
  const completedAt = instant(row.at ?? at);
  if (completedAt) result.completedAt = completedAt;
  if (!((result.reps !== null && result.reps > 0 && result.weight !== null) || (result.durationSeconds !== null && result.durationSeconds > 0))) unavailable('incomplete_measurements');
  return result;
}

// Validate recorded values before compatibility checks, so an unsupported session never
// hides a malformed row elsewhere in that same raw record.
function validateRow(value: unknown): void {
  const row = object(value);
  done(row); phase(row);
  if (row.type !== undefined && !['straight', 'dropset', 'restpause'].includes(String(row.type))) return invalid();
  if (row.sides !== undefined && row.sides !== null) {
    const sides = object(row.sides);
    validateRow(sides.L); validateRow(sides.R);
  } else if (done(row)) {
    number(row.w); number(row.r ?? row.reps ?? row.actualReps, true);
    number(row.sec ?? row.seconds ?? row.durationSec); number(row.min); instant(row.at);
    const rpe = number(row.rpe), rir = number(row.rir);
    if (rpe !== null && (rpe < 1 || rpe > 10) || rir !== null && rir > 20) return invalid();
  }
  if (row.drops !== undefined) for (const value of list(row.drops, 1000)) {
    const drop = object(value); done(drop); number(drop.w); number(drop.r, true);
  }
  if (row.clusters !== undefined) for (const value of list(row.clusters, 1000)) {
    const cluster = object(value); number(cluster.r, true); number(cluster.restSec);
  }
}

function validateWorkout(workout: ObjectValue): void {
  title(workout.name, 160, 'Training workbench session');
  instant(workout.start); instant(workout.end);
  if (workout.d != null && workout.d !== '' && !dateSchema.safeParse(workout.d).success) return invalid();
  if (workout.start != null && workout.end != null && (workout.end as number) < (workout.start as number)) return invalid();
  if (workout.note != null && workout.note !== '') text(workout.note, 10000);
  const rpe = number(workout.rpe);
  if (rpe !== null && (rpe < 1 || rpe > 10)) return invalid();
  for (const value of list(workout.entries, 1000)) {
    const entry = object(value);
    title(entry.id, 160);
    if (entry.name != null && entry.name !== '') title(entry.name, 160);
    if (entry.n != null && entry.n !== '') title(entry.n, 160);
    if (entry.note != null && entry.note !== '') text(entry.note, 10000);
    if (entry.target != null) object(entry.target);
    if (entry.sets !== undefined) for (const row of list(entry.sets, 1000)) validateRow(row);
  }
}

function projectOne(source: ObjectValue, userId: string, id: string, unit: 'kg' | 'lb', customNames: Map<string, string>): Workout {
  const start = number(source.start), end = number(source.end);
  if (start === null || end === null || start === end) unavailable('missing_duration');
  if (end < start) return invalid();
  const duration = (end - start) / 60000;
  if (duration > 1440) unavailable('duration_out_of_range');
  const createdAt = instant(start)!;
  if (source.d === undefined || source.d === null || source.d === '') unavailable('missing_date');
  if (!dateSchema.safeParse(source.d).success) return invalid();
  const entries = list(source.entries, 1000);
  const notes: string[] = [];
  if (source.note !== undefined && source.note !== null && source.note !== '') notes.push(text(source.note, 10000));
  const exercises: Exercise[] = [];

  for (const [entryIndex, value] of entries.entries()) {
    const entry = object(value);
    const exerciseId = title(entry.id, 160);
    if (entry.sets === undefined) unavailable('legacy_entry_without_sets');
    const rows = list(entry.sets, 1000);
    const target = entry.target === undefined || entry.target === null ? {} : object(entry.target);
    const known = catalogue.get(exerciseId);
    const name = title(entry.n ?? entry.name, 160, customNames.get(exerciseId) ?? known?.name ?? `Unknown exercise (${exerciseId})`);
    if (entry.note !== undefined && entry.note !== null && entry.note !== '') notes.push(`${name}: ${text(entry.note, 10000)}`);
    const buckets = new Map<string, SetLog[]>();
    const collect = (row: ObjectValue, rowIndex: number, side: string, parentRow?: ObjectValue) => {
      if (!done(row)) return;
      const path = ['entry', entryIndex, 'set', rowIndex, side];
      const kind = phase(parentRow ?? row);
      const main = actualSet(row, target, stableId(userId, id, ...path), unit, kind, undefined, parentRow?.at);
      const logs = buckets.get(side) ?? [];
      logs.push(main);
      const type = row.type ?? parentRow?.type;
      if (type !== undefined && !['straight', 'dropset', 'restpause'].includes(String(type))) return invalid();
      if (row.clusters !== undefined) for (const burst of list(row.clusters, 1000)) {
        const cluster = object(burst);
        number(cluster.r, true); number(cluster.restSec);
      }
      // Rest-pause r already contains every burst. Splitting or adding clusters double-counts.
      if (type === 'dropset' && row.drops !== undefined) for (const [dropIndex, value] of list(row.drops, 1000).entries()) {
        const drop = object(value);
        if (drop.done !== undefined && !done(drop)) continue;
        logs.push(actualSet(drop, { mode: 'reps' }, stableId(userId, id, ...path, 'drop', dropIndex), unit, 'drop', main.id));
      }
      buckets.set(side, logs);
      if (row.failure === true) notes.push(`${name}${side ? ` (${side})` : ''}, set ${rowIndex + 1}: marked to failure`);
    };
    for (const [rowIndex, value] of rows.entries()) {
      const row = object(value);
      if (row.sides !== undefined && row.sides !== null) {
        const sides = object(row.sides);
        collect(object(sides.L), rowIndex, 'left', row);
        collect(object(sides.R), rowIndex, 'right', row);
      } else {
        if (row.side !== undefined && row.side !== 'L' && row.side !== 'R') return invalid();
        collect(row, rowIndex, row.side === 'L' ? 'left' : row.side === 'R' ? 'right' : '');
      }
    }
    // Forma has no 'each bell' load semantics. Keep those detailed facts in the raw workbench.
    if (buckets.size && target.dbLoad === 'each' && !target.side) unavailable('unsupported_load_semantics');
    for (const [side, setLogs] of buckets) {
      const first = setLogs.find(set => set.kind !== 'warmup') ?? setLogs[0];
      exercises.push({
        id: stableId(userId, id, 'entry', entryIndex, side),
        name: name + (side ? ` (${side})` : ''),
        ...(known ? { exerciseId: known.id, primaryMuscles: [...known.primaryMuscles] } : { exerciseId: `opengym-custom:${exerciseId}`, primaryMuscles: [] }),
        sets: setLogs.length, reps: first.reps, weight: first.weight,
        setLogs,
        ...(entry.sg !== undefined && entry.sg !== null && entry.sg !== '' ? { supersetGroup: text(entry.sg, 80) } : {}),
      });
    }
  }
  if (!exercises.length) unavailable('no_completed_sets');
  const workout: Workout = {
    id: stableId(userId, id), date: source.d as string,
    name: title(source.name, 160, 'Training workbench session'), duration,
    rpe: source.rpe == null ? null : number(source.rpe),
    exercises, notes: notes.join('\n'), createdAt,
    source: 'forma', importFingerprint: `opengym:${id}`,
  };
  if (!workoutSchema.safeParse(workout).success) unavailable('unsupported_forma_limits');
  return workout;
}

/** Pure projection. The caller persists all raw state, warnings and these facts atomically. */
export function projectWorkbenchWorkouts(source: unknown, userId: string): WorkbenchProjection {
  const state = object(source);
  title(userId, 160);
  const unit = state.unit ?? 'kg';
  if (unit !== 'kg' && unit !== 'lb') return invalid();
  const customNames = new Map<string, string>();
  const customIds = new Set<string>();
  for (const item of state.customEx === undefined ? [] : list(state.customEx, 10000)) {
    const custom = object(item), id = title(custom.id, 160);
    if (customIds.has(id)) return invalid();
    customIds.add(id);
    if (custom.n != null && custom.n !== '') customNames.set(id, title(custom.n, 160));
  }
  const result: WorkbenchProjection = { workouts: [], warnings: [] };
  const ids = new Set<string>();
  for (const value of state.workouts === undefined ? [] : list(state.workouts, 10000)) {
    const workout = object(value), id = sourceWorkoutId(workout);
    if (ids.has(id)) return invalid();
    ids.add(id);
    validateWorkout(workout);
    try { result.workouts.push(projectOne(workout, userId, id, unit, customNames)); }
    catch (error) {
      if (!(error instanceof Unrepresentable)) throw error;
      result.warnings.push({ id: stableId(userId, id), code: error.code });
    }
  }
  return result;
}
