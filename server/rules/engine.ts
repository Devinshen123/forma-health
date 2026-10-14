// Deterministic suggestion engine. It reads confirmed records only, cites them as evidence,
// reports how complete the data was, and stays silent when data is insufficient.
// Plan changes are proposals for the user to accept; daily actions are always optional.
import type { Meal, PlanVersion, Sleep, Suggestion, Workout } from "../../src/types";
import { addDays, dailyNutrition, dateWindow, localDateOf, sleepNights } from "./days";
import { applyPatch, PlanRuleError, planValues } from "./plan";
import { guardEnginePatch } from "./safety";
import type { Completeness, EvidenceRef, FieldChange, PlanField, PlanPatch, Reason } from "./types";

export const ENGINE_VERSION = 1;
export const MAX_PROPOSALS = 2;
export const MAX_ACTIONS = 3;
/** A new plan gets this many days before the engine proposes changing it. */
export const PLAN_SETTLE_DAYS = 7;
/** After a rule's proposal is rejected or undone, that rule stays quiet this long. */
export const COOLDOWN_DAYS = 14;
const MAX_EVIDENCE = 10;

export interface EngineInput {
  /** User's local date (YYYY-MM-DD) for "today". */
  today: string;
  timeZone: string;
  plan: PlanVersion | null;
  meals: readonly Meal[];
  workouts: readonly Workout[];
  sleeps: readonly Sleep[];
  /** Earlier suggestions, for de-duplication and cooldown. */
  suggestions: readonly Suggestion[];
  conservative: boolean;
}

export interface ProposalCandidate {
  ruleId: string;
  engineVersion: number;
  baseVersionId: string;
  patch: PlanPatch;
  changes: FieldChange[];
  reason: Reason;
  evidence: EvidenceRef[];
  completeness: Completeness;
}

export interface ActionCandidate {
  ruleId: string;
  kind: "nutrition" | "training" | "recovery" | "sleep" | "logging";
  /** Lower comes first. */
  priority: number;
  reason: Reason;
  evidence: EvidenceRef[];
  completeness: Completeness | null;
}

export type SkipCode =
  | "no_plan"
  | "plan_too_new"
  | "insufficient_data"
  | "not_triggered"
  | "already_pending"
  | "cooldown"
  | "blocked_by_safety"
  | "limit_reached";

export interface EngineResult {
  proposals: ProposalCandidate[];
  actions: ActionCandidate[];
  skipped: { ruleId: string; code: SkipCode }[];
}

export const reasonKey = (ruleId: string) => `rule.${ruleId}`;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const round5 = (value: number) => Math.round(value / 5) * 5;
const oneDecimal = (value: number) => Math.round(value * 10) / 10;
const latestFirst = <T extends { date: string }>(items: T[]) => [...items].sort((a, b) => b.date.localeCompare(a.date));
const evidence = (kind: EvidenceRef["kind"], items: { id: string; date: string }[]): EvidenceRef[] =>
  latestFirst(items)
    .slice(0, MAX_EVIDENCE)
    .map(({ id, date }) => ({ kind, id, date }));

type Draft = Omit<ProposalCandidate, "engineVersion" | "baseVersionId" | "changes">;
type RuleOutcome<T> = T | SkipCode;

// ----------------------------------------------------------------------------- proposals

function trainingMinutesRule(input: EngineInput, plan: PlanVersion): RuleOutcome<Draft> {
  const days = 14;
  const window = new Set(dateWindow(input.today, days));
  const workouts = input.workouts.filter((workout) => window.has(workout.date) && workout.duration > 0);
  if (workouts.length < 3) return "insufficient_data";
  const typical = median(workouts.map((workout) => workout.duration));
  const planned = plan.trainingMinutes;
  let proposed: number;
  let direction: "down" | "up";
  if (typical < planned * 0.75) {
    proposed = Math.max(10, round5(typical));
    direction = "down";
    if (planned - proposed < 10) return "not_triggered";
  } else if (typical > planned * 1.25) {
    proposed = Math.min(planned + 15, round5(typical), 180);
    direction = "up";
    if (proposed - planned < 10) return "not_triggered";
  } else return "not_triggered";
  const ruleId = `training.minutes_${direction}`;
  return {
    ruleId,
    patch: { trainingMinutes: proposed },
    reason: {
      key: reasonKey(ruleId),
      params: { days, count: workouts.length, median: Math.round(typical), planned, proposed },
    },
    evidence: evidence("workout", workouts),
    completeness: { loggedDays: new Set(workouts.map((workout) => workout.date)).size, totalDays: days },
  };
}

function trainingDaysRule(input: EngineInput, plan: PlanVersion): RuleOutcome<Draft> {
  const weeks = 4;
  const blocks = Array.from({ length: weeks }, (_, i) => new Set(dateWindow(addDays(input.today, -7 * i), 7)));
  const all = new Set(blocks.flatMap((block) => [...block]));
  const workouts = input.workouts.filter((workout) => all.has(workout.date));
  const counts = blocks.map((block) => new Set(workouts.filter((w) => block.has(w.date)).map((w) => w.date)).size);
  // Without logging in most weeks we cannot tell "did not train" from "did not log".
  if (counts.filter((count) => count > 0).length < 3) return "insufficient_data";
  const planned = plan.trainingDays;
  if (!counts.every((count) => count < planned)) return "not_triggered";
  const average = counts.reduce((sum, count) => sum + count, 0) / weeks;
  const proposed = Math.max(1, Math.round(average));
  if (proposed >= planned) return "not_triggered";
  return {
    ruleId: "training.days_down",
    patch: { trainingDays: proposed },
    reason: { key: reasonKey("training.days_down"), params: { weeks, average: oneDecimal(average), planned, proposed } },
    evidence: evidence("workout", workouts),
    completeness: { loggedDays: new Set(workouts.map((workout) => workout.date)).size, totalDays: weeks * 7 },
  };
}

function suppression(input: EngineInput, ruleId: string, fields: PlanField[]): SkipCode | null {
  const key = reasonKey(ruleId);
  const pending = input.suggestions.some(
    (suggestion) =>
      suggestion.status === "proposed" &&
      (suggestion.reason === key || Object.keys(suggestion.patch).some((field) => fields.includes(field as PlanField))),
  );
  if (pending) return "already_pending";
  const cooldownStart = addDays(input.today, -COOLDOWN_DAYS);
  const recent = input.suggestions.some(
    (suggestion) =>
      suggestion.reason === key &&
      (suggestion.status === "rejected" || suggestion.status === "undone") &&
      localDateOf(suggestion.createdAt, input.timeZone) >= cooldownStart,
  );
  return recent ? "cooldown" : null;
}

function proposals(input: EngineInput, skipped: EngineResult["skipped"]): ProposalCandidate[] {
  const ruleIds = ["training.minutes", "training.days_down"];
  const plan = input.plan;
  if (!plan) {
    for (const ruleId of ruleIds) skipped.push({ ruleId, code: "no_plan" });
    return [];
  }
  if (localDateOf(plan.createdAt, input.timeZone) > addDays(input.today, -PLAN_SETTLE_DAYS)) {
    for (const ruleId of ruleIds) skipped.push({ ruleId, code: "plan_too_new" });
    return [];
  }
  const out: ProposalCandidate[] = [];
  const touched = new Set<PlanField>();
  const outcomes: [string, RuleOutcome<Draft>][] = [
    ["training.minutes", trainingMinutesRule(input, plan)],
    ["training.days_down", trainingDaysRule(input, plan)],
  ];
  for (const [fallbackId, outcome] of outcomes) {
    if (typeof outcome === "string") {
      skipped.push({ ruleId: fallbackId, code: outcome });
      continue;
    }
    const fields = Object.keys(outcome.patch) as PlanField[];
    const suppressed = suppression(input, outcome.ruleId, fields);
    if (suppressed) {
      skipped.push({ ruleId: outcome.ruleId, code: suppressed });
      continue;
    }
    if (fields.some((field) => touched.has(field)) || out.length >= MAX_PROPOSALS) {
      skipped.push({ ruleId: outcome.ruleId, code: "limit_reached" });
      continue;
    }
    const guarded = guardEnginePatch(planValues(plan), outcome.patch, { conservative: input.conservative });
    if (guarded.blocked.length > 0) {
      skipped.push({ ruleId: outcome.ruleId, code: "blocked_by_safety" });
      continue;
    }
    let changes: FieldChange[];
    try {
      changes = applyPatch(plan, guarded.allowed, { id: "preview", createdAt: plan.createdAt, reason: "preview" }).changes;
    } catch (error) {
      if (!(error instanceof PlanRuleError)) throw error;
      skipped.push({ ruleId: outcome.ruleId, code: "not_triggered" });
      continue;
    }
    fields.forEach((field) => touched.add(field));
    out.push({ ...outcome, patch: guarded.allowed, engineVersion: ENGINE_VERSION, baseVersionId: plan.id, changes });
  }
  return out;
}

// ----------------------------------------------------------------------------- daily actions

function recoveryAction(input: EngineInput): RuleOutcome<ActionCandidate> {
  const night = sleepNights(input.sleeps).nights.find((candidate) => candidate.date === input.today);
  if (!night) return "insufficient_data";
  const records = input.sleeps
    .filter((sleep) => night.sessionIds.includes(sleep.id))
    .sort((a, b) => Date.parse(b.end) - Date.parse(a.end));
  const energy = records[0].energy;
  // Two independent signals are required; one short night or one low rating alone changes nothing.
  if (!(night.minutes < 300 && energy <= 2)) return "not_triggered";
  return {
    ruleId: "recovery.lighter_option",
    kind: "recovery",
    priority: 1,
    reason: { key: reasonKey("recovery.lighter_option"), params: { hours: oneDecimal(night.minutes / 60), energy } },
    evidence: records.map((sleep) => ({ kind: "sleep" as const, id: sleep.id, date: night.date })),
    completeness: null,
  };
}

function sessionTodayAction(input: EngineInput): RuleOutcome<ActionCandidate> {
  const plan = input.plan;
  if (!plan) return "no_plan";
  const window = new Set(dateWindow(input.today, 7));
  const recent = input.workouts.filter((workout) => window.has(workout.date));
  if (recent.some((workout) => workout.date === input.today)) return "not_triggered";
  const done = new Set(recent.map((workout) => workout.date)).size;
  if (done >= plan.trainingDays) return "not_triggered";
  return {
    ruleId: "training.session_today",
    kind: "training",
    priority: 2,
    reason: {
      key: reasonKey("training.session_today"),
      params: { planned: plan.trainingDays, done, minutes: plan.trainingMinutes },
    },
    evidence: [{ kind: "plan", id: plan.id, date: localDateOf(plan.createdAt, input.timeZone) }, ...evidence("workout", recent)],
    completeness: null,
  };
}

function proteinGapAction(input: EngineInput): RuleOutcome<ActionCandidate> {
  const target = input.plan?.proteinTarget ?? null;
  if (target === null) return input.plan ? "not_triggered" : "no_plan";
  const totalDays = 7;
  const days = dailyNutrition(input.meals, dateWindow(addDays(input.today, -1), totalDays));
  // A day counts only with 2+ meals and fully known protein; sparse days would exaggerate a gap.
  const usable = days.filter(
    (day) => day.mealCount >= 2 && day.totals?.values.protein != null && !day.totals.partial.includes("protein"),
  );
  if (usable.length < 4) return "insufficient_data";
  const average = usable.reduce((sum, day) => sum + (day.totals?.values.protein ?? 0), 0) / usable.length;
  if (average >= target * 0.85) return "not_triggered";
  const dates = new Set(usable.map((day) => day.date));
  return {
    ruleId: "nutrition.protein_gap",
    kind: "nutrition",
    priority: 3,
    reason: {
      key: reasonKey("nutrition.protein_gap"),
      params: { days: usable.length, totalDays, average: Math.round(average), target },
    },
    evidence: evidence("meal", input.meals.filter((meal) => dates.has(meal.date))),
    completeness: { loggedDays: usable.length, totalDays },
  };
}

function windDownAction(input: EngineInput): RuleOutcome<ActionCandidate> {
  const plan = input.plan;
  if (!plan) return "no_plan";
  const totalDays = 7;
  const window = new Set(dateWindow(input.today, totalDays));
  const nights = sleepNights(input.sleeps).nights.filter((night) => window.has(night.date));
  if (nights.length < 4) return "insufficient_data";
  const average = nights.reduce((sum, night) => sum + night.minutes, 0) / nights.length / 60;
  if (average >= plan.sleepHours - 0.75) return "not_triggered";
  const ids = new Set(nights.flatMap((night) => night.sessionIds));
  return {
    ruleId: "sleep.wind_down",
    kind: "sleep",
    priority: 4,
    reason: {
      key: reasonKey("sleep.wind_down"),
      params: { nights: nights.length, totalDays, average: oneDecimal(average), target: plan.sleepHours },
    },
    evidence: evidence(
      "sleep",
      input.sleeps.filter((sleep) => ids.has(sleep.id)).map((sleep) => ({ id: sleep.id, date: localDateOf(sleep.end, sleep.timezone) })),
    ),
    completeness: { loggedDays: nights.length, totalDays },
  };
}

function mealLoggingAction(input: EngineInput): RuleOutcome<ActionCandidate> {
  const totalDays = 7;
  const loggedDays = dailyNutrition(input.meals, dateWindow(addDays(input.today, -1), totalDays)).filter((day) => day.logged).length;
  if (loggedDays >= 3) return "not_triggered";
  return {
    ruleId: "logging.meals_insufficient",
    kind: "logging",
    priority: 5,
    reason: { key: reasonKey("logging.meals_insufficient"), params: { loggedDays, totalDays } },
    evidence: [],
    completeness: { loggedDays, totalDays },
  };
}

function actions(input: EngineInput, skipped: EngineResult["skipped"]): ActionCandidate[] {
  const rules: [string, (input: EngineInput) => RuleOutcome<ActionCandidate>][] = [
    ["recovery.lighter_option", recoveryAction],
    ["training.session_today", sessionTodayAction],
    ["nutrition.protein_gap", proteinGapAction],
    ["sleep.wind_down", windDownAction],
    ["logging.meals_insufficient", mealLoggingAction],
  ];
  const found: ActionCandidate[] = [];
  for (const [ruleId, rule] of rules) {
    const outcome = rule(input);
    if (typeof outcome === "string") skipped.push({ ruleId, code: outcome });
    else found.push(outcome);
  }
  found.sort((a, b) => a.priority - b.priority);
  for (const extra of found.slice(MAX_ACTIONS)) skipped.push({ ruleId: extra.ruleId, code: "limit_reached" });
  return found.slice(0, MAX_ACTIONS);
}

/** Evaluate all rules for one user and day. Pure: same input, same output. */
export function evaluate(input: EngineInput): EngineResult {
  const skipped: EngineResult["skipped"] = [];
  return { proposals: proposals(input, skipped), actions: actions(input, skipped), skipped };
}

/** Adapter to the current M0 `Suggestion` shape; evidence needs the contract extension to travel with it. */
export function toSuggestion(candidate: ProposalCandidate, meta: { id: string; createdAt: string }): Suggestion {
  const patch: Suggestion["patch"] = {};
  if (candidate.patch.trainingMinutes !== undefined && candidate.patch.trainingMinutes !== null)
    patch.trainingMinutes = candidate.patch.trainingMinutes;
  if (candidate.patch.trainingDays !== undefined && candidate.patch.trainingDays !== null)
    patch.trainingDays = candidate.patch.trainingDays;
  return {
    id: meta.id,
    baseVersionId: candidate.baseVersionId,
    createdAt: meta.createdAt,
    reason: candidate.reason.key,
    status: "proposed",
    patch,
  };
}
