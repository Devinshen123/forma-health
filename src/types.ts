export type Language = "zh" | "en";
export type Page =
  | "today"
  | "nutrition"
  | "training"
  | "sleep"
  | "trends"
  | "reports"
  | "companion"
  | "settings"
  | "plan";
export interface Profile {
  name: string;
  goal: "performance" | "strength" | "habits";
  experience: "new" | "regular";
  trainingDays: number;
  timeMinutes: number;
  equipment: "gym" | "home" | "bodyweight";
  allergies: string;
  restrictions: string;
  language: Language;
  units: "metric" | "imperial";
  timezone: string;
  sleepGoal: number;
  cloudConsent: boolean;
  aiConsent: boolean;
}
export interface Meal {
  id: string;
  date: string;
  name: string;
  type: "breakfast" | "lunch" | "dinner" | "snack";
  grams: number;
  referenceGrams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "manual" | "label" | "ai_estimate";
  assetId?: string;
  aiDraftId?: string;
  aiItemIndex?: number;
  createdAt: string;
}
export interface FoodPhotoItem {
  name: string;
  grams: number | null;
  per100g: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null };
}
export interface FoodPhotoAnalysisEngine {
  id: "fud-ai";
  sourceCommit: string;
}
export interface FoodPhotoDraft {
  analysisEngine?: FoodPhotoAnalysisEngine;
  id: string;
  assetId: string;
  provider: "openai";
  model: string;
  createdAt: string;
  isFood: boolean;
  consent: { acceptedAt: string; version: "food-photo-v1"; language: Language };
  items: FoodPhotoItem[];
  warnings: string[];
}
export interface Capabilities {
  ai: boolean;
  apple: boolean;
  healthkit: boolean;
  mode: "local";
  foodPhoto: { analysisEngine?: FoodPhotoAnalysisEngine; available: boolean; provider: "openai"; reason: "ready" | "not_configured" | "invalid_config" };
}
export interface Exercise {
  name: string;
  sets: number;
  reps: number | null; // Legacy summary only; timed entries may have no repetition/load observation.
  weight: number | null;
  id?: string;
  exerciseId?: string;
  primaryMuscles?: string[];
  setLogs?: SetLog[];
  supersetGroup?: string | null;
  restSeconds?: number;
}
export interface Workout {
  id: string;
  date: string;
  name: string;
  duration: number;
  rpe: number | null;
  exercises: Exercise[];
  notes: string;
  createdAt: string;
  routineId?: string;
  source?: "manual" | "strong" | "hevy" | "fitnotes" | "forma";
  importFingerprint?: string;
}
export interface SetLog {
  id: string;
  kind: "work" | "warmup" | "drop";
  reps: number | null;
  weight: number | null; // kg, null means unrecorded, 0 means explicitly unweighted
  durationSeconds: number | null;
  distanceMeters: number | null;
  rpe: number | null;
  rir: number | null;
  completed: boolean;
  completedAt?: string;
  dropParentId?: string;
}
export interface SessionExercise {
  id: string;
  exerciseId?: string;
  name: string;
  primaryMuscles: string[];
  setLogs: SetLog[];
  supersetGroup: string | null;
  restSeconds: number;
  notes: string;
}
export interface ActiveWorkout {
  id: string;
  date: string;
  name: string;
  startedAt: string;
  routineId?: string;
  exercises: SessionExercise[];
  restEndsAt: string | null;
  restRemainingSeconds?: number | null;
  notes: string;
  rpe: number | null;
}
export interface RoutineExercise {
  id: string;
  exerciseId?: string;
  name: string;
  primaryMuscles: string[];
  setCount: number;
  repsMin: number;
  repsMax: number;
  weight: number | null;
  restSeconds: number;
  supersetGroup: string | null;
  progression: { enabled: boolean; incrementKg: number };
}
export interface TrainingRoutine {
  id: string;
  supersedesId?: string;
  name: string;
  exercises: RoutineExercise[];
  createdAt: string;
  updatedAt: string;
}
export interface TrainingSchedule {
  id: string;
  name: string;
  mode: "weekly" | "rotation";
  anchorDate: string;
  slots: { id: string; routineId: string | null; weekday?: number }[];
  createdAt: string;
  updatedAt: string;
}
export interface CatalogExercise {
  id: string;
  name: string;
  nameZh?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string | null;
  category: string;
  level: string;
  instructions: string[];
  instructionsZh?: string[];
  animation?: "squat" | "pushup" | "row" | "press" | "curl" | "hinge" | "lunge" | "plank";
  source?: "forma" | "free-exercise-db" | "opengym";
  sourceId?: string;
  instructionUrl?: string;
  video?: { src: string; poster: string; credit: string };
}
export interface Sleep {
  id: string;
  date: string;
  start: string;
  end: string;
  quality: number;
  energy: number;
  source: "manual";
  timezone: string;
  createdAt: string;
}
export interface Marker {
  name: string;
  value: string;
  unit: string;
  range: string;
  notes: string;
}
export interface Report {
  id: string;
  name: string;
  date: string;
  assetId?: string;
  markers: Marker[];
  extractionStatus: "manual";
  createdAt: string;
}
export interface PlanVersion {
  id: string;
  parentId: string | null;
  createdAt: string;
  reason: string;
  trainingMinutes: number;
  trainingDays: number;
  sleepHours: number;
  calorieTarget: number | null;
  proteinTarget: number | null;
}
export interface Suggestion {
  id: string;
  baseVersionId: string;
  createdAt: string;
  reason: string;
  status: "proposed" | "accepted" | "undone" | "rejected";
  patch: Partial<
    Pick<PlanVersion, "trainingMinutes" | "sleepHours" | "trainingDays">
  >;
  acceptedVersionId?: string;
}
export interface AppState {
  profile: Profile | null;
  meals: Meal[];
  workouts: Workout[];
  sleeps: Sleep[];
  reports: Report[];
  planVersions: PlanVersion[];
  currentPlanId: string | null;
  suggestions: Suggestion[];
  completedActions: Record<string, string[]>;
  routines?: TrainingRoutine[];
  schedules?: TrainingSchedule[];
  activeWorkouts?: ActiveWorkout[];
}
export interface User {
  id: string;
  email: string;
  name: string;
}
export interface FeatureProps {
  state: AppState;
  lang: Language;
  save: (next: AppState) => Promise<void>;
  notify: (zh: string, en?: string) => void;
  demo: boolean;
  accountId?: string;
  onTrainingRefresh?: () => Promise<void>;
  onUnsavedChange?: (dirty:boolean,busy:boolean) => void;
}
export type SyncCollection = "meals" | "workouts" | "sleeps" | "reports" | "planVersions" | "suggestions" | "routines" | "schedules" | "activeWorkouts" | "profile" | "currentPlanId" | "completedActions";
export interface SyncChange { collection: SyncCollection; id: string; baseVersion: number; kind: "upsert" | "delete"; value?: unknown }
export interface SyncSnapshot { state: AppState; revision: number; entityVersions: Record<string, number> }
export interface SyncMutation { mutationId: string; changes: SyncChange[] }
export const emptyState = (): AppState => ({
  profile: null,
  meals: [],
  workouts: [],
  sleeps: [],
  reports: [],
  planVersions: [],
  currentPlanId: null,
  suggestions: [],
  completedActions: {},
  routines: [],
  schedules: [],
  activeWorkouts: [],
});
export const localDate = (date = new Date()) =>
  (() => { const parts=new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    calendar: "gregory", numberingSystem: "latn",
  }).formatToParts(date); const get=(key:string)=>parts.find(p=>p.type===key)?.value;return `${get('year')}-${get('month')}-${get('day')}`; })();
export const mealTotals = (m: Meal) => {
  const factor = m.grams / m.referenceGrams;
  return {
    kcal: Math.round(m.kcal * factor),
    protein: Math.round(m.protein * factor * 10) / 10,
    carbs: Math.round(m.carbs * factor * 10) / 10,
    fat: Math.round(m.fat * factor * 10) / 10,
  };
};
export const sleepHours = (s: Sleep) =>
  (new Date(s.end).getTime() - new Date(s.start).getTime()) / 3600000;
export const currentPlan = (s: AppState) =>
  s.planVersions.find((p) => p.id === s.currentPlanId);
export const uid = () => crypto.randomUUID();
