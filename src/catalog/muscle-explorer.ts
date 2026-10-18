import sourceMuscles from './opengym-muscles.json';
import type { CatalogExercise, Language } from '../types';

/** These are the selectable regions of the body diagram, not diagnoses or scores. */
export const MUSCLE_KEYS = [
  'trapezius', 'deltoids', 'chest', 'upper-back', 'serratus', 'biceps',
  'triceps', 'forearm', 'abs', 'obliques', 'lower-back', 'gluteal',
  'quadriceps', 'hamstring', 'adductors', 'hip-flexors', 'calves', 'tibialis',
] as const;

export type MuscleKey = typeof MUSCLE_KEYS[number];
export type MuscleCounts = Record<MuscleKey, number>;

const labels: Record<MuscleKey, { zh: string; en: string }> = {
  trapezius: { zh: '斜方肌', en: 'Trapezius' },
  deltoids: { zh: '肩部', en: 'Shoulders' },
  chest: { zh: '胸部', en: 'Chest' },
  'upper-back': { zh: '上背部', en: 'Upper back' },
  serratus: { zh: '前锯肌', en: 'Serratus anterior' },
  biceps: { zh: '肱二头肌', en: 'Biceps' },
  triceps: { zh: '肱三头肌', en: 'Triceps' },
  forearm: { zh: '前臂', en: 'Forearms' },
  abs: { zh: '腹部', en: 'Abdominals' },
  obliques: { zh: '腹斜肌', en: 'Obliques' },
  'lower-back': { zh: '下背部', en: 'Lower back' },
  gluteal: { zh: '臀部 / 髋外侧', en: 'Glutes / outer hips' },
  quadriceps: { zh: '股四头肌', en: 'Quadriceps' },
  hamstring: { zh: '腘绳肌', en: 'Hamstrings' },
  adductors: { zh: '髋内收肌', en: 'Adductors' },
  'hip-flexors': { zh: '髋屈肌群', en: 'Hip flexors' },
  calves: { zh: '小腿', en: 'Calves' },
  tibialis: { zh: '胫骨前肌', en: 'Tibialis anterior' },
};

/** Fallback for original / synthetic entries which have no precise source metadata. */
const aliases: Record<MuscleKey, readonly string[]> = {
  trapezius: ['traps', 'neck'],
  deltoids: ['shoulders', 'rotator cuff'],
  chest: ['chest'],
  'upper-back': ['middle back', 'lats', 'rhomboids', 'back'],
  serratus: ['serratus anterior'],
  biceps: ['biceps', 'brachialis'],
  triceps: ['triceps'],
  forearm: ['forearms', 'wrists', 'wrist flexors', 'wrist extensors', 'grip muscles'],
  abs: ['abdominals', 'core'],
  obliques: ['obliques'],
  'lower-back': ['lower back'],
  gluteal: ['glutes', 'abductors'],
  quadriceps: ['quadriceps'],
  hamstring: ['hamstrings'],
  adductors: ['adductors', 'groin'],
  'hip-flexors': ['hip flexors'],
  calves: ['calves', 'soleus'],
  tibialis: ['shins'],
};

const sourceIndex = sourceMuscles as Record<string, { primary: string[]; secondary: string[] }>;

export function isMuscleKey(key: string): key is MuscleKey {
  return Object.prototype.hasOwnProperty.call(labels, key);
}

export function muscleName(key: string, lang: Language): string {
  return isMuscleKey(key) ? labels[key][lang] : key;
}

/** Preserve the strongest positive involvement from the precise source metadata. */
export function muscleRole(exercise: CatalogExercise, key: string): 'primary' | 'secondary' | undefined {
  if (!isMuscleKey(key)) return undefined;
  const precise = exercise.sourceId && Object.prototype.hasOwnProperty.call(sourceIndex, exercise.sourceId)
    ? sourceIndex[exercise.sourceId] : undefined;
  if (precise) return precise.primary.includes(key) ? 'primary' : precise.secondary.includes(key) ? 'secondary' : undefined;
  const matches = (muscles: readonly string[]) => muscles.some(muscle => muscle === key || aliases[key].includes(muscle));
  return matches(exercise.primaryMuscles) ? 'primary' : matches(exercise.secondaryMuscles) ? 'secondary' : undefined;
}

/** Match positive primary or secondary involvement. Never infer a missing muscle. */
export function matchesMuscle(exercise: CatalogExercise, key: string): boolean {
  return muscleRole(exercise, key) !== undefined;
}

/** Count unique action IDs once in each region, even if both primary and secondary match. */
export function muscleCounts(exercises: readonly CatalogExercise[]): MuscleCounts {
  return Object.fromEntries(MUSCLE_KEYS.map(key => [
    key,
    new Set(exercises.filter(exercise => matchesMuscle(exercise, key)).map(exercise => exercise.id)).size,
  ])) as MuscleCounts;
}
