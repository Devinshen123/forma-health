import assert from "node:assert/strict";
import { test } from "node:test";
import type { Meal, PlanVersion, Sleep, Workout } from "../../src/types";
import { addDays } from "./days";
import { renderReason } from "./messages";
import { weeklyReview, type WeeklyInput } from "./weekly";

const END = "2026-10-14";
const TZ = "Asia/Shanghai";
const day = (offset: number) => addDays(END, offset);
let seq = 0;

const plan: PlanVersion = {
  id: "v1",
  parentId: null,
  createdAt: "2026-09-01T00:00:00Z",
  reason: "onboarding",
  trainingMinutes: 45,
  trainingDays: 3,
  sleepHours: 8,
  calorieTarget: null,
  proteinTarget: 120,
};
const workout = (offset: number, duration = 45): Workout => ({
  id: `w${++seq}`,
  date: day(offset),
  name: "Strength",
  duration,
  rpe: 7,
  exercises: [],
  notes: "",
  createdAt: `${day(offset)}T10:00:00Z`,
});
const meal = (offset: number, protein: number): Meal => ({
  id: `m${++seq}`,
  date: day(offset),
  name: "Meal",
  type: "lunch",
  grams: 100,
  referenceGrams: 100,
  kcal: 600,
  protein,
  carbs: 60,
  fat: 20,
  source: "manual",
  createdAt: `${day(offset)}T04:00:00Z`,
});
const sleep = (offset: number, hours: number): Sleep => {
  const end = new Date(`${day(offset)}T07:00:00+08:00`);
  return {
    id: `s${++seq}`,
    date: day(offset),
    start: new Date(end.getTime() - hours * 3600_000).toISOString(),
    end: end.toISOString(),
    quality: 3,
    energy: 3,
    source: "manual",
    timezone: TZ,
    createdAt: end.toISOString(),
  };
};
const input = (over: Partial<WeeklyInput> = {}): WeeklyInput => ({
  weekEnd: END,
  timeZone: TZ,
  plan,
  meals: [],
  workouts: [],
  sleeps: [],
  suggestions: [],
  completedActions: {},
  conservative: false,
  ...over,
});
const keys = (review: ReturnType<typeof weeklyReview>) => review.highlights.map((h) => h.key);

test("an empty week reports zero logged days, unknown metrics and no fake trend", () => {
  const review = weeklyReview(input());
  assert.deepEqual(review.period, { start: day(-6), end: END });
  assert.deepEqual(review.completeness.nutrition, { loggedDays: 0, totalDays: 7 });
  assert.equal(review.metrics.sleepHours.current, null);
  assert.equal(review.metrics.trainingMinutes.current, null, "no logged workouts is unknown, not 0 minutes");
  assert.equal(review.metrics.kcal.comparable, false);
  assert.deepEqual(keys(review), ["weekly.data_completeness", "weekly.training_adherence"]);
  assert.deepEqual(review.proposals, []);
});

test("adherence counts distinct training days and days with a completed action", () => {
  const review = weeklyReview(
    input({
      workouts: [workout(0), workout(0, 20), workout(-3), workout(-9)],
      completedActions: { [day(0)]: ["training"], [day(-1)]: [], [day(-2)]: ["sleep", "nutrition"], [day(-8)]: ["x"] },
    }),
  );
  assert.deepEqual(review.adherence.trainingDays, { done: 2, planned: 3 });
  assert.deepEqual(review.adherence.actionDays, { loggedDays: 2, totalDays: 7 });
  assert.equal(review.metrics.trainingMinutes.current, 110);
  assert.ok(keys(review).includes("weekly.actions_completed"));
});

test("trends appear only when both weeks have enough logged days", () => {
  const sleeps = [0, -1, -2].map((o) => sleep(o, 6)).concat([-7, -8, -9].map((o) => sleep(o, 7.5)));
  const review = weeklyReview(input({ sleeps }));
  assert.equal(review.metrics.sleepHours.comparable, true);
  assert.equal(review.metrics.sleepHours.change, -1.5);
  const trend = review.highlights.find((h) => h.key === "weekly.sleep_trend");
  assert.deepEqual(trend?.params, { current: 6, previous: 7.5 });

  const sparse = weeklyReview(input({ sleeps: sleeps.slice(0, 2).concat(sleeps.slice(3)) }));
  assert.equal(sparse.metrics.sleepHours.comparable, false);
  assert.equal(sparse.metrics.sleepHours.change, null);
  assert.ok(keys(sparse).includes("weekly.comparison_limited"));
  assert.ok(!keys(sparse).includes("weekly.sleep_trend"));
});

test("nutrition means use only well-logged days, so a single snack does not drag the average down", () => {
  const meals = [0, -1, -2]
    .flatMap((o) => [meal(o, 50), meal(o, 50)])
    .concat(meal(-3, 5))
    .concat([-7, -8, -9].flatMap((o) => [meal(o, 30), meal(o, 30)]));
  const review = weeklyReview(input({ meals }));
  assert.equal(review.completeness.nutrition.loggedDays, 4);
  assert.equal(review.metrics.protein.currentDays, 3);
  assert.equal(review.metrics.protein.current, 100);
  assert.equal(review.metrics.protein.previous, 60);
  assert.deepEqual(review.highlights.find((h) => h.key === "weekly.protein_trend")?.params, { current: 100, previous: 60 });
});

test("weekly proposals come from the same engine and every highlight renders in both languages", () => {
  const review = weeklyReview(
    input({
      workouts: [workout(0, 20), workout(-2, 20), workout(-5, 20)],
      sleeps: [0, -1, -2, -7, -8, -9].map((o) => sleep(o, o > -3 ? 6 : 8)),
      completedActions: { [day(0)]: ["training"] },
    }),
  );
  assert.equal(review.proposals[0]?.ruleId, "training.minutes_down");
  for (const reason of review.highlights)
    for (const lang of ["zh", "en"] as const) assert.doesNotMatch(renderReason(reason, lang), /\{\w+\}/);
});

test("without a plan the review still summarises records but skips adherence and proposals", () => {
  const review = weeklyReview(input({ plan: null, workouts: [workout(0)] }));
  assert.deepEqual(review.adherence.trainingDays, { done: 1, planned: null });
  assert.ok(!keys(review).includes("weekly.training_adherence"));
  assert.deepEqual(review.proposals, []);
});
