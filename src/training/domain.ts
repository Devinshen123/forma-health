import type { CatalogExercise, Exercise, RoutineExercise, SetLog, TrainingRoutine, TrainingSchedule, Workout } from '../types';

export interface PersonalRecord {
  exerciseKey: string;
  name: string;
  bestWeightKg: number | null;
  bestEstimated1RMKg: number | null;
  bestReps: number | null;
  workoutId: string;
  date: string;
  setId: string;
}
export interface TrainingStats {
  loggedWorkouts: number;
  detailedWorkouts: number;
  legacyWorkouts: number;
  completedSets: number;
  volumeKg: number | null;
  unknownLoadSets: number;
  muscleSets: Record<string, number>;
  unknownMuscleSets: number;
  personalRecords: PersonalRecord[];
}
export interface ProgressionSuggestion {
  exerciseId: string;
  name: string;
  fromWeight: number;
  toWeight: number;
  incrementKg: number;
  evidenceWorkoutIds: [string, string];
  reasonCode: 'two_sessions_top_range';
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
// Manual load entry stores six decimal places in kg. Match imported loads at
// that same precision for eligibility, without changing the recorded values.
const loadAtInputPrecision = (weight: number) => Math.round(weight * 1e6);
export const normalizedExerciseName = (name: string) => name.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
export const kilograms = (weight: number, unit: 'kg' | 'lb') => weight * (unit === 'lb' ? 0.45359237 : 1);

/** A bounded Epley estimate, never an observed maximum or a recommendation to test it. */
export function estimated1RM(weightKg: number | null, reps: number | null): number | null {
  if (!finite(weightKg) || weightKg <= 0 || !finite(reps) || !Number.isInteger(reps) || reps < 1 || reps > 10) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/** Mirrors the product's completion evidence, including explicit unweighted repetitions. */
export function hasCompletedEvidence(set: SetLog): boolean {
  return set.completed && (
    (finite(set.reps) && set.reps > 0 && finite(set.weight) && set.weight >= 0) ||
    (finite(set.durationSeconds) && set.durationSeconds > 0)
  );
}

function identifiedExercise(exercise: Exercise, catalog: CatalogExercise[]): CatalogExercise | undefined {
  if (exercise.exerciseId) return catalog.find(item => item.id === exercise.exerciseId);
  const name = normalizedExerciseName(exercise.name);
  const matches = catalog.filter(item => normalizedExerciseName(item.name) === name || (item.nameZh && normalizedExerciseName(item.nameZh) === name));
  return matches.length === 1 ? matches[0] : undefined;
}

export function trainingStats(workouts: Workout[], catalog: CatalogExercise[]): TrainingStats {
  const stats: TrainingStats = { loggedWorkouts: workouts.length, detailedWorkouts: 0, legacyWorkouts: 0, completedSets: 0, volumeKg: null, unknownLoadSets: 0, muscleSets: {}, unknownMuscleSets: 0, personalRecords: [] };
  const records = new Map<string, PersonalRecord>();
  let volume = 0, knownVolumeSets = 0;
  for (const workout of [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
    if (!workout.exercises.some(exercise => exercise.setLogs !== undefined)) { stats.legacyWorkouts++; continue; }
    stats.detailedWorkouts++;
    for (const exercise of workout.exercises) {
      const identified = identifiedExercise(exercise, catalog);
      const key = identified?.id ?? (exercise.exerciseId ? `custom-id:${exercise.exerciseId}` : `custom:${normalizedExerciseName(exercise.name)}`);
      const muscles = [...new Set(identified?.primaryMuscles ?? [])];
      for (const set of exercise.setLogs ?? []) {
        if (set.kind === 'warmup' || !hasCompletedEvidence(set)) continue;
        stats.completedSets++;
        if (muscles.length) for (const muscle of muscles) stats.muscleSets[muscle] = (stats.muscleSets[muscle] ?? 0) + 1;
        else stats.unknownMuscleSets++;
        if (finite(set.weight) && set.weight >= 0 && finite(set.reps) && set.reps > 0) { volume += set.weight * set.reps; knownVolumeSets++; }
        else stats.unknownLoadSets++;
        // A timed set can be complete without evidence of a performed repetition.
        if (!finite(set.reps) || !Number.isInteger(set.reps) || set.reps < 1) continue;
        const estimate = estimated1RM(set.weight, set.reps);
        const weight = finite(set.weight) && set.weight > 0 ? set.weight : null;
        const existing = records.get(key);
        if (!existing) records.set(key, { exerciseKey: key, name: exercise.name, bestWeightKg: weight, bestEstimated1RMKg: estimate, bestReps: set.reps, workoutId: workout.id, date: workout.date, setId: set.id });
        else {
          if (weight !== null && (existing.bestWeightKg === null || weight > existing.bestWeightKg)) existing.bestWeightKg = weight;
          if (set.reps > (existing.bestReps ?? 0)) existing.bestReps = set.reps;
          if (estimate !== null && (existing.bestEstimated1RMKg === null || estimate > existing.bestEstimated1RMKg)) {
            existing.bestEstimated1RMKg = estimate;
            existing.workoutId = workout.id; existing.date = workout.date; existing.setId = set.id;
          }
        }
      }
    }
  }
  stats.volumeKg = knownVolumeSets ? volume : null;
  stats.personalRecords = [...records.values()];
  return stats;
}

function matchesRoutine(exercise: Exercise, target: RoutineExercise): boolean {
  if (target.exerciseId) return exercise.exerciseId === target.exerciseId;
  return !exercise.exerciseId && normalizedExerciseName(exercise.name) === normalizedExerciseName(target.name);
}
function manageableEffort(set: SetLog, sessionRpe: number | null): boolean {
  if (finite(sessionRpe) && sessionRpe >= 9) return false;
  if (finite(set.rpe) && set.rpe >= 9) return false;
  if (finite(set.rir) && set.rir < 2) return false;
  // Missing effort is not evidence that the target was comfortably achieved.
  return (finite(set.rpe) && set.rpe >= 1 && set.rpe < 9) || (finite(set.rir) && set.rir >= 2) || (finite(sessionRpe) && sessionRpe >= 1 && sessionRpe < 9);
}

/** Returns proposals only. The UI must confirm an appended routine version. */
export function progressionSuggestions(routine: TrainingRoutine, workouts: Workout[]): ProgressionSuggestion[] {
  const proposals: ProgressionSuggestion[] = [];
  const ordered = [...workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  for (const target of routine.exercises) {
    if (!target.progression.enabled || !finite(target.weight) || target.weight <= 0 || !finite(target.progression.incrementKg) || target.progression.incrementKg <= 0) continue;
    if (!Number.isInteger(target.setCount) || target.setCount < 1 || !Number.isInteger(target.repsMax) || target.repsMax < target.repsMin) continue;
    const recent = ordered.filter(workout => (!routine.supersedesId || workout.routineId === routine.id) && workout.exercises.some(exercise => matchesRoutine(exercise, target))).slice(0, 2);
    if (recent.length !== 2 || recent[0].id === recent[1].id || recent[0].date === recent[1].date) continue;
    if (!recent.every(workout => {
      const exercises = workout.exercises.filter(exercise => matchesRoutine(exercise, target));
      if (exercises.length !== 1) return false; // Duplicated exercise blocks need human interpretation.
      const sets = (exercises[0].setLogs ?? []).filter(set => set.kind === 'work');
      return sets.length >= target.setCount && sets.every(set => hasCompletedEvidence(set) && finite(set.reps) && set.reps >= target.repsMax && finite(set.weight) && loadAtInputPrecision(set.weight) >= loadAtInputPrecision(target.weight!) && manageableEffort(set, workout.rpe));
    })) continue;
    const toWeight = Math.round((target.weight + target.progression.incrementKg) * 1e6) / 1e6;
    if (!finite(toWeight) || toWeight <= target.weight || toWeight > 2000) continue;
    proposals.push({ exerciseId: target.id, name: target.name, fromWeight: target.weight, toWeight, incrementKg: target.progression.incrementKg, evidenceWorkoutIds: [recent[1].id, recent[0].id], reasonCode: 'two_sessions_top_range' });
  }
  return proposals;
}

/** Gregorian civil-day index: independent of the browser timezone and DST. */
export function civilDay(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return null;
  return value.getTime() / 86400000;
}

export function scheduledRoutine(schedule: TrainingSchedule, date: string): string | null {
  const day = civilDay(date), anchor = civilDay(schedule.anchorDate);
  if (day === null || anchor === null || day < anchor || !schedule.slots.length) return null;
  if (schedule.mode === 'rotation') {
    if (schedule.slots.some(slot => slot.weekday !== undefined)) return null;
    return schedule.slots[(day - anchor) % schedule.slots.length].routineId;
  }
  if (schedule.mode !== 'weekly') return null;
  const weekdays = schedule.slots.map(slot => slot.weekday);
  if (weekdays.some(value => value === undefined || !Number.isInteger(value) || value < 0 || value > 6) || new Set(weekdays).size !== weekdays.length) return null;
  return schedule.slots.find(slot => slot.weekday === new Date(day * 86400000).getUTCDay())?.routineId ?? null;
}
