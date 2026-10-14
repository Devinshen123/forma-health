// Shared shapes for the deterministic rules layer. Rules are pure functions:
// no I/O, no clock, no randomness — callers pass `today`, ids and timestamps in.
import type { PlanVersion } from "../../src/types";

export interface Nutrients {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}
export type NutrientKey = keyof Nutrients;
export const NUTRIENT_KEYS: readonly NutrientKey[] = ["kcal", "protein", "carbs", "fat"];

/** Sum of several items. A key is `partial` when some items had a value and others were unknown. */
export interface Totals {
  values: Nutrients;
  partial: NutrientKey[];
  itemCount: number;
}

export interface EvidenceRef {
  kind: "meal" | "workout" | "sleep" | "plan";
  id: string;
  date: string;
}

/** How many days in a window actually had records. Never infer "zero" from an unlogged day. */
export interface Completeness {
  loggedDays: number;
  totalDays: number;
}

/** A localisable explanation: the key selects a zh/en template, params fill it. */
export interface Reason {
  key: string;
  params: Record<string, string | number>;
}

export const PLAN_FIELDS = [
  "trainingMinutes",
  "trainingDays",
  "sleepHours",
  "calorieTarget",
  "proteinTarget",
] as const;
export type PlanField = (typeof PLAN_FIELDS)[number];
export type PlanValues = Pick<PlanVersion, PlanField>;
export type PlanPatch = Partial<PlanValues>;

export interface FieldChange {
  field: PlanField;
  before: number | null;
  after: number | null;
}
