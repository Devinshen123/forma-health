// Plan versioning as pure functions: versions are append-only, undo is a compensating version.
import type { PlanVersion } from "../../src/types";
import { PLAN_FIELDS, type FieldChange, type PlanField, type PlanPatch, type PlanValues } from "./types";

/** Same limits the plan editor shows to users; nullable fields may also be null. */
export const PLAN_BOUNDS: Record<PlanField, { min: number; max: number; integer: boolean; nullable: boolean }> = {
  trainingMinutes: { min: 10, max: 180, integer: true, nullable: false },
  trainingDays: { min: 1, max: 7, integer: true, nullable: false },
  sleepHours: { min: 4, max: 12, integer: false, nullable: false },
  calorieTarget: { min: 500, max: 8000, integer: false, nullable: true },
  proteinTarget: { min: 1, max: 400, integer: false, nullable: true },
};

export class PlanRuleError extends Error {
  constructor(
    readonly code: "no_change" | "out_of_bounds" | "stale_base" | "unknown_version" | "no_parent",
    message: string,
  ) {
    super(message);
    this.name = "PlanRuleError";
  }
}

export const planValues = (version: PlanVersion): PlanValues => ({
  trainingMinutes: version.trainingMinutes,
  trainingDays: version.trainingDays,
  sleepHours: version.sleepHours,
  calorieTarget: version.calorieTarget,
  proteinTarget: version.proteinTarget,
});

export function diffPlan(before: PlanValues, after: PlanValues): FieldChange[] {
  return PLAN_FIELDS.filter((field) => before[field] !== after[field]).map((field) => ({
    field,
    before: before[field],
    after: after[field],
  }));
}

export function assertWithinBounds(values: PlanValues): void {
  for (const field of PLAN_FIELDS) {
    const value = values[field];
    const bound = PLAN_BOUNDS[field];
    if (value === null) {
      if (!bound.nullable) throw new PlanRuleError("out_of_bounds", `${field} is required`);
      continue;
    }
    if (!Number.isFinite(value) || value < bound.min || value > bound.max || (bound.integer && !Number.isInteger(value)))
      throw new PlanRuleError("out_of_bounds", `${field} must be within ${bound.min}–${bound.max}`);
  }
}

export type BaseCheck = { ok: true } | { ok: false; code: "stale_base" | "unknown_version"; currentId: string | null };

/** A change prepared against `baseVersionId` may only apply while that version is still current (else HTTP 409). */
export function checkBase(versions: readonly PlanVersion[], currentId: string | null, baseVersionId: string): BaseCheck {
  if (!versions.some((version) => version.id === baseVersionId)) return { ok: false, code: "unknown_version", currentId };
  return baseVersionId === currentId ? { ok: true } : { ok: false, code: "stale_base", currentId };
}

export interface NewVersionMeta {
  id: string;
  createdAt: string;
  reason: string;
}

/** New child version of `base` with `patch` applied. Throws if nothing changes or a value is out of bounds. */
export function applyPatch(
  base: PlanVersion,
  patch: PlanPatch,
  meta: NewVersionMeta,
): { version: PlanVersion; changes: FieldChange[] } {
  const before = planValues(base);
  const merged: Record<PlanField, number | null> = { ...before };
  for (const field of PLAN_FIELDS) {
    const value = patch[field];
    if (value !== undefined) merged[field] = value;
  }
  const after = merged as PlanValues;
  assertWithinBounds(after);
  const changes = diffPlan(before, after);
  if (changes.length === 0) throw new PlanRuleError("no_change", "Patch does not change the plan");
  return { version: { ...after, id: meta.id, parentId: base.id, createdAt: meta.createdAt, reason: meta.reason }, changes };
}

/**
 * Undo the current version by appending a version that restores its parent's values.
 * History is never deleted; logged meals and workouts are untouched by plan changes.
 */
export function compensate(
  versions: readonly PlanVersion[],
  currentId: string | null,
  undoneVersionId: string,
  meta: NewVersionMeta,
): { version: PlanVersion; changes: FieldChange[] } {
  const undone = versions.find((version) => version.id === undoneVersionId);
  if (!undone) throw new PlanRuleError("unknown_version", "Version not found");
  if (undoneVersionId !== currentId) throw new PlanRuleError("stale_base", "Only the current version can be undone");
  const parent = versions.find((version) => version.id === undone.parentId);
  if (!parent) throw new PlanRuleError("no_parent", "The first version has nothing to restore");
  const restored = planValues(parent);
  const changes = diffPlan(planValues(undone), restored);
  return { version: { ...restored, id: meta.id, parentId: undone.id, createdAt: meta.createdAt, reason: meta.reason }, changes };
}
