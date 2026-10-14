import { z } from 'zod';
import { idSchema, dateSchema } from './validation-primitives';

const title = z.string().trim().min(1).max(160).refine(value => !/[\u0000-\u001f\u007f-\u009f]/u.test(value), 'Use visible text');
const instant = z.string().datetime({ offset: true });
const notes = z.string().max(10000);
const exerciseId = z.string().min(1).max(160).refine(value => !/[\u0000-\u001f\u007f-\u009f]/u.test(value), 'Invalid exercise reference');
const muscles = z.array(title).max(30).refine(values => new Set(values).size === values.length, 'Muscles must be unique');
const weight = z.number().min(0).max(2000).nullable();
const restSeconds = z.number().int().min(0).max(7200);
const supersetGroup = z.string().trim().min(1).max(80).nullable();
const rpe = z.number().min(1).max(10).nullable();

export const setLogSchema = z.object({
  id: idSchema,
  kind: z.enum(['work', 'warmup', 'drop']),
  reps: z.number().int().min(0).max(1000).nullable(),
  weight,
  durationSeconds: z.number().positive().max(86400).nullable(),
  distanceMeters: z.number().min(0).max(1000000).nullable(),
  rpe,
  rir: z.number().min(0).max(20).nullable(),
  completed: z.boolean(),
  completedAt: instant.optional(),
  dropParentId: idSchema.optional(),
}).strict().superRefine((set, ctx) => {
  if (set.completed && !((set.reps !== null && set.reps > 0 && set.weight !== null) || (set.durationSeconds !== null && set.durationSeconds > 0)))
    ctx.addIssue({ code: 'custom', message: 'A completed set needs recorded reps and weight or a recorded duration' });
  if (!set.completed && set.completedAt !== undefined)
    ctx.addIssue({ code: 'custom', path: ['completedAt'], message: 'An unfinished set cannot claim a completion time' });
  if (set.kind === 'drop' ? !set.dropParentId : set.dropParentId !== undefined)
    ctx.addIssue({ code: 'custom', path: ['dropParentId'], message: 'Only a drop set must reference its preceding set' });
});

export const setLogsSchema = z.array(setLogSchema).max(100).superRefine((sets, ctx) => {
  const earlier = new Map<string, z.infer<typeof setLogSchema>>();
  for (const [index, set] of sets.entries()) {
    if (earlier.has(set.id)) ctx.addIssue({ code: 'custom', path: [index, 'id'], message: 'Set IDs must be unique within an exercise' });
    if (set.kind === 'drop') {
      const parent = set.dropParentId && earlier.get(set.dropParentId);
      if (!parent) ctx.addIssue({ code: 'custom', path: [index, 'dropParentId'], message: 'A drop set must reference an earlier set of the same exercise' });
      else if (set.completed && set.weight !== null && parent.weight !== null && set.weight > parent.weight)
        ctx.addIssue({ code: 'custom', path: [index, 'weight'], message: 'A drop-set weight cannot exceed its recorded parent weight' });
    }
    earlier.set(set.id, set);
  }
});

export const exerciseSchema = z.object({
  name: title,
  sets: z.number().int().min(1).max(100),
  reps: z.number().int().min(0).max(1000),
  weight: z.number().min(0).max(2000),
  id: idSchema.optional(), exerciseId: exerciseId.optional(),
  primaryMuscles: muscles.optional(), setLogs: setLogsSchema.optional(),
  supersetGroup: supersetGroup.optional(), restSeconds: restSeconds.optional(),
}).strict().refine(value => value.setLogs !== undefined || value.reps >= 1, 'Legacy summaries require recorded positive reps');

const uniqueExerciseAndSetIds = (exercises: { id?: string; setLogs?: { id: string }[] }[], ctx: z.RefinementCtx) => {
  const ids = new Set<string>();
  for (const [index, exercise] of exercises.entries()) {
    const entries = [...(exercise.id ? [{ id: exercise.id, path: [index, 'id'] }] : []), ...(exercise.setLogs ?? []).map((set, i) => ({ id: set.id, path: [index, 'setLogs', i, 'id'] }))];
    for (const entry of entries) {
      if (ids.has(entry.id)) ctx.addIssue({ code: 'custom', path: ['exercises', ...entry.path], message: 'Exercise and set IDs must be unique within a session' });
      ids.add(entry.id);
    }
  }
};

export const workoutSchema = z.object({
  id: idSchema, date: dateSchema, name: title,
  duration: z.number().int().min(1).max(1440), rpe,
  exercises: z.array(exerciseSchema).min(1).max(100), notes, createdAt: instant,
  routineId: idSchema.optional(), source: z.enum(['manual', 'strong', 'hevy', 'fitnotes', 'forma']).optional(),
  importFingerprint: z.string().min(1).max(160).optional(),
}).strict().superRefine((workout, ctx) => {
  uniqueExerciseAndSetIds(workout.exercises, ctx);
  if (workout.exercises.some(exercise => exercise.setLogs !== undefined) && !workout.exercises.some(exercise => exercise.setLogs?.some(set => set.completed)))
    ctx.addIssue({ code: 'custom', path: ['exercises'], message: 'A detailed workout needs at least one recorded completed set' });
});

const sessionExerciseSchema = z.object({
  id: idSchema, exerciseId: exerciseId.optional(), name: title, primaryMuscles: muscles,
  setLogs: setLogsSchema.min(1), supersetGroup, restSeconds, notes,
}).strict();
export const activeWorkoutSchema = z.object({
  id: idSchema, date: dateSchema, name: title, startedAt: instant, routineId: idSchema.optional(),
  exercises: z.array(sessionExerciseSchema).min(1).max(100), restEndsAt: instant.nullable(), notes, rpe,
  restRemainingSeconds: z.number().min(0).max(7200).nullable().optional(),
}).strict().superRefine((workout, ctx) => uniqueExerciseAndSetIds(workout.exercises, ctx));

const routineExerciseSchema = z.object({
  id: idSchema, exerciseId: exerciseId.optional(), name: title, primaryMuscles: muscles,
  setCount: z.number().int().min(1).max(100), repsMin: z.number().int().min(1).max(1000),
  repsMax: z.number().int().min(1).max(1000), weight, restSeconds, supersetGroup,
  progression: z.object({ enabled: z.boolean(), incrementKg: z.number().positive().max(100) }).strict(),
}).strict().refine(value => value.repsMin <= value.repsMax, 'Minimum reps cannot exceed maximum reps');
export const routineSchema = z.object({
  id: idSchema, supersedesId: idSchema.optional(), name: title,
  exercises: z.array(routineExerciseSchema).min(1).max(100), createdAt: instant, updatedAt: instant,
}).strict().superRefine((routine, ctx) => {
  const ids = routine.exercises.map(exercise => exercise.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['exercises'], message: 'Routine exercise IDs must be unique' });
  if (Date.parse(routine.updatedAt) < Date.parse(routine.createdAt)) ctx.addIssue({ code: 'custom', path: ['updatedAt'], message: 'Update time cannot precede creation' });
});

export const scheduleSchema = z.object({
  id: idSchema, name: title, mode: z.enum(['weekly', 'rotation']), anchorDate: dateSchema,
  slots: z.array(z.object({ id: idSchema, routineId: idSchema.nullable(), weekday: z.number().int().min(0).max(6).optional() }).strict()).min(1).max(60),
  createdAt: instant, updatedAt: instant,
}).strict().superRefine((schedule, ctx) => {
  if (new Set(schedule.slots.map(slot => slot.id)).size !== schedule.slots.length) ctx.addIssue({ code: 'custom', path: ['slots'], message: 'Schedule slot IDs must be unique' });
  if (schedule.mode === 'weekly') {
    if (schedule.slots.length > 7 || schedule.slots.some(slot => slot.weekday === undefined) || new Set(schedule.slots.map(slot => slot.weekday)).size !== schedule.slots.length)
      ctx.addIssue({ code: 'custom', path: ['slots'], message: 'A weekly schedule needs unique weekdays' });
  } else if (schedule.slots.some(slot => slot.weekday !== undefined))
    ctx.addIssue({ code: 'custom', path: ['slots'], message: 'A rotation follows slot order rather than weekdays' });
  if (Date.parse(schedule.updatedAt) < Date.parse(schedule.createdAt)) ctx.addIssue({ code: 'custom', path: ['updatedAt'], message: 'Update time cannot precede creation' });
});
