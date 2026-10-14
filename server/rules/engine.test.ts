import assert from "node:assert/strict";
import { test } from "node:test";
import type { Meal, PlanVersion, Sleep, Suggestion, Workout } from "../../src/types";
import { addDays } from "./days";
import { evaluate, toSuggestion, type EngineInput } from "./engine";
import { placeholders, renderReason, RULE_MESSAGES } from "./messages";

const TODAY = "2026-10-14";
const TZ = "America/Los_Angeles";
const day = (offset: number) => addDays(TODAY, offset);

const plan = (over: Partial<PlanVersion> = {}): PlanVersion => ({
  id: "v1",
  parentId: null,
  createdAt: "2026-09-20T16:00:00Z",
  reason: "onboarding",
  trainingMinutes: 60,
  trainingDays: 4,
  sleepHours: 8,
  calorieTarget: null,
  proteinTarget: 140,
  ...over,
});
let seq = 0;
const workout = (offset: number, duration = 60): Workout => ({
  id: `w${++seq}`,
  date: day(offset),
  name: "Strength",
  duration,
  rpe: 7,
  exercises: [],
  notes: "",
  createdAt: `${day(offset)}T18:00:00Z`,
});
const meal = (offset: number, protein: number | null): Meal =>
  ({
    id: `m${++seq}`,
    date: day(offset),
    name: "Meal",
    type: "lunch",
    grams: 100,
    referenceGrams: 100,
    kcal: 500,
    protein,
    carbs: 50,
    fat: 15,
    source: "manual",
    createdAt: `${day(offset)}T19:00:00Z`,
  }) as unknown as Meal;
/** A night ending at 07:00 local time on `offset`, lasting `hours`. */
const sleep = (offset: number, hours: number, energy = 3): Sleep => {
  const end = new Date(`${day(offset)}T07:00:00-07:00`);
  return {
    id: `s${++seq}`,
    date: day(offset),
    start: new Date(end.getTime() - hours * 3600_000).toISOString(),
    end: end.toISOString(),
    quality: 3,
    energy,
    source: "manual",
    timezone: TZ,
    createdAt: end.toISOString(),
  };
};
const input = (over: Partial<EngineInput> = {}): EngineInput => ({
  today: TODAY,
  timeZone: TZ,
  plan: plan(),
  meals: [],
  workouts: [],
  sleeps: [],
  suggestions: [],
  conservative: false,
  ...over,
});
const skipOf = (result: ReturnType<typeof evaluate>, ruleId: string) =>
  result.skipped.find((skip) => skip.ruleId === ruleId)?.code;
const ruleIds = (items: { ruleId: string }[]) => items.map((item) => item.ruleId);

test("without a plan, nothing is proposed and only the logging nudge appears", () => {
  const result = evaluate(input({ plan: null }));
  assert.deepEqual(result.proposals, []);
  assert.equal(skipOf(result, "training.minutes"), "no_plan");
  assert.deepEqual(ruleIds(result.actions), ["logging.meals_insufficient"]);
  assert.equal(skipOf(result, "recovery.lighter_option"), "insufficient_data");
});

test("a plan younger than the settle period is left alone", () => {
  const result = evaluate(input({ plan: plan({ createdAt: `${day(-3)}T16:00:00Z` }), workouts: [workout(-1, 20), workout(-2, 20), workout(-3, 20)] }));
  assert.deepEqual(result.proposals, []);
  assert.equal(skipOf(result, "training.minutes"), "plan_too_new");
});

test("consistently shorter workouts produce a reasoned, evidenced proposal to shorten the plan", () => {
  const workouts = [workout(-1, 30), workout(-4, 35), workout(-8, 40), workout(-20, 10)];
  const [proposal] = evaluate(input({ workouts })).proposals;
  assert.equal(proposal.ruleId, "training.minutes_down");
  assert.deepEqual(proposal.patch, { trainingMinutes: 35 });
  assert.deepEqual(proposal.changes, [{ field: "trainingMinutes", before: 60, after: 35 }]);
  assert.equal(proposal.baseVersionId, "v1");
  assert.deepEqual(proposal.reason.params, { days: 14, count: 3, median: 35, planned: 60, proposed: 35 });
  assert.equal(proposal.evidence.length, 3, "the workout outside the 14-day window is not cited");
  assert.deepEqual(proposal.completeness, { loggedDays: 3, totalDays: 14 });
});

test("two workouts are not enough evidence to change the plan", () => {
  const result = evaluate(input({ workouts: [workout(-1, 20), workout(-2, 20)] }));
  assert.equal(skipOf(result, "training.minutes"), "insufficient_data");
});

test("longer workouts raise the plan by at most 15 minutes, and never in conservative mode", () => {
  const workouts = [workout(-1, 50), workout(-3, 55), workout(-5, 60)];
  const [up] = evaluate(input({ plan: plan({ trainingMinutes: 30 }), workouts })).proposals;
  assert.equal(up.ruleId, "training.minutes_up");
  assert.deepEqual(up.patch, { trainingMinutes: 45 });
  const conservative = evaluate(input({ plan: plan({ trainingMinutes: 30 }), workouts, conservative: true }));
  assert.deepEqual(conservative.proposals, []);
  assert.equal(skipOf(conservative, "training.minutes_up"), "blocked_by_safety");
});

test("fewer training days than planned in every logged week proposes fewer days, with an unlogged-training caveat", () => {
  const workouts = [workout(0), workout(-2), workout(-8), workout(-10), workout(-15), workout(-22), workout(-24)];
  const [proposal] = evaluate(input({ workouts })).proposals;
  assert.equal(proposal.ruleId, "training.days_down");
  assert.deepEqual(proposal.patch, { trainingDays: 2 });
  assert.deepEqual(proposal.reason.params, { weeks: 4, average: 1.8, planned: 4, proposed: 2 });
  assert.match(renderReason(proposal.reason, "zh"), /没记录的训练/);
  assert.match(renderReason(proposal.reason, "en"), /without logging/);
});

test("weeks without any logged workout make the days rule abstain", () => {
  const result = evaluate(input({ workouts: [workout(0), workout(-2), workout(-8)] }));
  assert.equal(skipOf(result, "training.days_down"), "insufficient_data");
});

test("a pending suggestion on the same field or a recent rejection suppresses the rule", () => {
  const workouts = [workout(-1, 30), workout(-4, 35), workout(-8, 40)];
  const prior = (status: Suggestion["status"], createdOffset: number, reason = "rule.training.minutes_down"): Suggestion => ({
    id: `x${++seq}`,
    baseVersionId: "v1",
    createdAt: `${day(createdOffset)}T16:00:00Z`,
    reason,
    status,
    patch: { trainingMinutes: 30 },
  });
  assert.equal(skipOf(evaluate(input({ workouts, suggestions: [prior("proposed", -1, "suggestion.time_limited")] })), "training.minutes_down"), "already_pending");
  assert.equal(skipOf(evaluate(input({ workouts, suggestions: [prior("rejected", -5)] })), "training.minutes_down"), "cooldown");
  assert.equal(skipOf(evaluate(input({ workouts, suggestions: [prior("undone", -5)] })), "training.minutes_down"), "cooldown");
  assert.equal(evaluate(input({ workouts, suggestions: [prior("rejected", -20)] })).proposals.length, 1);
});

test("a short night alone or low energy alone never triggers the lighter-session option", () => {
  assert.equal(skipOf(evaluate(input({ sleeps: [sleep(0, 4.5, 4)] })), "recovery.lighter_option"), "not_triggered");
  assert.equal(skipOf(evaluate(input({ sleeps: [sleep(0, 7.5, 1)] })), "recovery.lighter_option"), "not_triggered");
  const both = evaluate(input({ sleeps: [sleep(0, 4.5, 2)] }));
  assert.equal(both.actions[0].ruleId, "recovery.lighter_option");
  assert.deepEqual(both.actions[0].reason.params, { hours: 4.5, energy: 2 });
  assert.match(renderReason(both.actions[0].reason, "zh"), /不会自动取消训练/);
  assert.equal(both.proposals.length, 0, "sleep never changes the plan by itself");
});

test("protein gap needs four well-logged days and ignores sparse or unknown days", () => {
  const meals = [-1, -2, -3, -4].flatMap((offset) => [meal(offset, 40), meal(offset, 40)]);
  const gap = evaluate(input({ meals })).actions.find((action) => action.ruleId === "nutrition.protein_gap");
  assert.deepEqual(gap?.reason.params, { days: 4, totalDays: 7, average: 80, target: 140 });
  assert.deepEqual(gap?.completeness, { loggedDays: 4, totalDays: 7 });

  const sparse = [-1, -2, -3].flatMap((offset) => [meal(offset, 40), meal(offset, 40)]).concat(meal(-4, 40));
  assert.equal(skipOf(evaluate(input({ meals: sparse })), "nutrition.protein_gap"), "insufficient_data");

  const unknown = [-1, -2, -3].flatMap((offset) => [meal(offset, 40), meal(offset, 40)]).concat(meal(-4, 40), meal(-4, null));
  assert.equal(skipOf(evaluate(input({ meals: unknown })), "nutrition.protein_gap"), "insufficient_data");

  const enough = [-1, -2, -3, -4].flatMap((offset) => [meal(offset, 70), meal(offset, 60)]);
  assert.equal(skipOf(evaluate(input({ meals: enough })), "nutrition.protein_gap"), "not_triggered");
  assert.equal(skipOf(evaluate(input({ meals, plan: plan({ proteinTarget: null }) })), "nutrition.protein_gap"), "not_triggered");
});

test("sleep wind-down needs four logged nights and compares only logged nights", () => {
  const four = [0, -1, -2, -3].map((offset) => sleep(offset, 6));
  const action = evaluate(input({ sleeps: four })).actions.find((item) => item.ruleId === "sleep.wind_down");
  assert.deepEqual(action?.reason.params, { nights: 4, totalDays: 7, average: 6, target: 8 });
  assert.equal(skipOf(evaluate(input({ sleeps: four.slice(0, 3) })), "sleep.wind_down"), "insufficient_data");
});

test("at most three actions are returned, highest priority first, the rest reported", () => {
  const result = evaluate(
    input({
      sleeps: [sleep(0, 4, 1), sleep(-1, 6), sleep(-2, 6), sleep(-3, 6)],
      meals: [-1, -2, -3, -4].flatMap((offset) => [meal(offset, 30), meal(offset, 30)]),
    }),
  );
  assert.deepEqual(ruleIds(result.actions), ["recovery.lighter_option", "training.session_today", "nutrition.protein_gap"]);
  assert.equal(skipOf(result, "sleep.wind_down"), "limit_reached");
});

test("evaluation is deterministic and every produced reason renders in both languages", () => {
  const scenario = input({
    workouts: [workout(0, 30), workout(-2, 30), workout(-8, 30), workout(-15, 30), workout(-22, 30)],
    sleeps: [sleep(0, 4, 2), sleep(-1, 6), sleep(-2, 6), sleep(-3, 6)],
    meals: [-1, -2, -3, -4].flatMap((offset) => [meal(offset, 30), meal(offset, 30)]),
  });
  const first = evaluate(scenario);
  assert.deepEqual(evaluate(scenario), first);
  assert.ok(first.proposals.length >= 1);
  for (const item of [...first.proposals, ...first.actions])
    for (const lang of ["zh", "en"] as const) assert.doesNotMatch(renderReason(item.reason, lang), /\{\w+\}/);
});

test("zh and en templates use the same placeholders", () => {
  for (const [key, text] of Object.entries(RULE_MESSAGES))
    assert.deepEqual(placeholders(text.zh).sort(), placeholders(text.en).sort(), key);
  assert.throws(() => renderReason({ key: "rule.unknown", params: {} }, "en"));
  assert.throws(() => renderReason({ key: "rule.sleep.wind_down", params: {} }, "zh"));
});

test("proposals convert to the current Suggestion contract with the reason key", () => {
  const [proposal] = evaluate(input({ workouts: [workout(-1, 30), workout(-4, 35), workout(-8, 40)] })).proposals;
  assert.deepEqual(toSuggestion(proposal, { id: "s-1", createdAt: "2026-10-14T19:00:00Z" }), {
    id: "s-1",
    baseVersionId: "v1",
    createdAt: "2026-10-14T19:00:00Z",
    reason: "rule.training.minutes_down",
    status: "proposed",
    patch: { trainingMinutes: 35 },
  });
});
