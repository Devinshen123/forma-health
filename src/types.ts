export type Language = "zh" | "en";
export type Page =
  | "today"
  | "nutrition"
  | "training"
  | "sleep"
  | "trends"
  | "reports"
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
  createdAt: string;
}
export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  weight: number;
}
export interface Workout {
  id: string;
  date: string;
  name: string;
  duration: number;
  rpe: number;
  exercises: Exercise[];
  notes: string;
  createdAt: string;
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
}
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
});
export const localDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
