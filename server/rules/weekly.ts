// Weekly review: adherence, completeness, careful week-over-week comparison and a few proposals.
// Comparisons are only made when both weeks have enough logged days; otherwise they are marked
// not comparable instead of showing a misleading trend.
import type { Meal, PlanVersion, Sleep, Suggestion, Workout } from "../../src/types";
import { addDays, dailyNutrition, dateWindow, sleepNights } from "./days";
import { evaluate, type ProposalCandidate } from "./engine";
import type { Completeness, NutrientKey, Reason } from "./types";

export const REVIEW_DAYS = 7;
/** Minimum logged days in *each* week before a mean is compared. */
export const MIN_DAYS_TO_COMPARE = 3;
/** Minimum workout days in each week before training volume is compared. */
export const MIN_WORKOUT_DAYS_TO_COMPARE = 2;
/** Every highlight kind can appear once; the cap only guards against future additions. */
const MAX_HIGHLIGHTS = 6;

export interface WeeklyInput {
  /** Last local date of the review week (inclusive). */
  weekEnd: string;
  timeZone: string;
  plan: PlanVersion | null;
  meals: readonly Meal[];
  workouts: readonly Workout[];
  sleeps: readonly Sleep[];
  suggestions: readonly Suggestion[];
  completedActions: Readonly<Record<string, readonly string[]>>;
  conservative: boolean;
}

export interface MetricComparison {
  current: number | null;
  previous: number | null;
  /** current − previous, only when `comparable`. */
  change: number | null;
  comparable: boolean;
  currentDays: number;
  previousDays: number;
}

export interface WeeklyReview {
  period: { start: string; end: string };
  completeness: { nutrition: Completeness; training: Completeness; sleep: Completeness };
  adherence: {
    trainingDays: { done: number; planned: number | null };
    actionDays: Completeness;
  };
  metrics: {
    kcal: MetricComparison;
    protein: MetricComparison;
    sleepHours: MetricComparison;
    trainingMinutes: MetricComparison;
  };
  highlights: Reason[];
  proposals: ProposalCandidate[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

function compare(current: number[], previous: number[], minDays: number, aggregate: (values: number[]) => number | null): MetricComparison {
  const c = aggregate(current);
  const p = aggregate(previous);
  const comparable = current.length >= minDays && previous.length >= minDays && c !== null && p !== null;
  return {
    current: c,
    previous: p,
    change: comparable ? (c as number) - (p as number) : null,
    comparable,
    currentDays: current.length,
    previousDays: previous.length,
  };
}

/** Daily values of a nutrient on well-logged days (2+ meals, value fully known). */
function wellLoggedValues(meals: readonly Meal[], dates: string[], key: NutrientKey): number[] {
  return dailyNutrition(meals, dates)
    .filter((day) => day.mealCount >= 2 && day.totals?.values[key] != null && !day.totals.partial.includes(key))
    .map((day) => day.totals?.values[key] as number);
}

export function weeklyReview(input: WeeklyInput): WeeklyReview {
  const current = dateWindow(input.weekEnd, REVIEW_DAYS);
  const previous = dateWindow(addDays(input.weekEnd, -REVIEW_DAYS), REVIEW_DAYS);
  const inWeek = (dates: string[]) => new Set(dates);
  const cur = inWeek(current);
  const prev = inWeek(previous);

  const nights = sleepNights(input.sleeps).nights;
  const nightHours = (dates: Set<string>) => nights.filter((night) => dates.has(night.date)).map((night) => night.minutes / 60);
  const workoutDays = (dates: Set<string>) => {
    const byDate = new Map<string, number>();
    for (const workout of input.workouts)
      if (dates.has(workout.date)) byDate.set(workout.date, (byDate.get(workout.date) ?? 0) + workout.duration);
    return [...byDate.values()];
  };
  const mealDays = dailyNutrition(input.meals, current).filter((day) => day.logged).length;
  const curWorkouts = workoutDays(cur);
  const curNights = nightHours(cur);
  const actionDays = current.filter((date) => (input.completedActions[date]?.length ?? 0) > 0).length;

  const metrics: WeeklyReview["metrics"] = {
    kcal: compare(wellLoggedValues(input.meals, current, "kcal"), wellLoggedValues(input.meals, previous, "kcal"), MIN_DAYS_TO_COMPARE, mean),
    protein: compare(
      wellLoggedValues(input.meals, current, "protein"),
      wellLoggedValues(input.meals, previous, "protein"),
      MIN_DAYS_TO_COMPARE,
      mean,
    ),
    sleepHours: compare(curNights, nightHours(prev), MIN_DAYS_TO_COMPARE, mean),
    trainingMinutes: compare(curWorkouts, workoutDays(prev), MIN_WORKOUT_DAYS_TO_COMPARE, (values) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) : null,
    ),
  };

  const highlights: Reason[] = [
    {
      key: "weekly.data_completeness",
      params: { totalDays: REVIEW_DAYS, nutritionDays: mealDays, trainingDays: curWorkouts.length, sleepNights: curNights.length },
    },
  ];
  if (input.plan)
    highlights.push({ key: "weekly.training_adherence", params: { planned: input.plan.trainingDays, done: curWorkouts.length } });
  if (actionDays > 0) highlights.push({ key: "weekly.actions_completed", params: { days: actionDays, totalDays: REVIEW_DAYS } });
  const { sleepHours, protein } = metrics;
  if (sleepHours.comparable && Math.abs(sleepHours.change ?? 0) >= 0.5)
    highlights.push({ key: "weekly.sleep_trend", params: { current: round1(sleepHours.current ?? 0), previous: round1(sleepHours.previous ?? 0) } });
  if (protein.comparable && protein.previous && Math.abs(protein.change ?? 0) >= protein.previous * 0.1)
    highlights.push({ key: "weekly.protein_trend", params: { current: Math.round(protein.current ?? 0), previous: Math.round(protein.previous) } });
  const someDataNotComparable = Object.values(metrics).some(
    (metric) => !metric.comparable && (metric.currentDays > 0 || metric.previousDays > 0),
  );
  if (someDataNotComparable) highlights.push({ key: "weekly.comparison_limited", params: {} });

  const { proposals } = evaluate({
    today: input.weekEnd,
    timeZone: input.timeZone,
    plan: input.plan,
    meals: input.meals,
    workouts: input.workouts,
    sleeps: input.sleeps,
    suggestions: input.suggestions,
    conservative: input.conservative,
  });

  return {
    period: { start: current[0], end: input.weekEnd },
    completeness: {
      nutrition: { loggedDays: mealDays, totalDays: REVIEW_DAYS },
      training: { loggedDays: curWorkouts.length, totalDays: REVIEW_DAYS },
      sleep: { loggedDays: curNights.length, totalDays: REVIEW_DAYS },
    },
    adherence: {
      trainingDays: { done: curWorkouts.length, planned: input.plan?.trainingDays ?? null },
      actionDays: { loggedDays: actionDays, totalDays: REVIEW_DAYS },
    },
    metrics,
    highlights: highlights.slice(0, MAX_HIGHLIGHTS),
    proposals,
  };
}
