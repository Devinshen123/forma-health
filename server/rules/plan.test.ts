import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlanVersion } from "../../src/types";
import { applyPatch, checkBase, compensate, diffPlan, planValues, PlanRuleError } from "./plan";

const v1: PlanVersion = {
  id: "v1",
  parentId: null,
  createdAt: "2026-10-01T08:00:00Z",
  reason: "onboarding",
  trainingMinutes: 45,
  trainingDays: 4,
  sleepHours: 8,
  calorieTarget: null,
  proteinTarget: 120,
};
const meta = (id: string) => ({ id, createdAt: "2026-10-14T08:00:00Z", reason: "test" });
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    if (error instanceof PlanRuleError) return error.code;
    throw error;
  }
  return "no error";
};

test("diff lists only changed fields with before and after", () => {
  assert.deepEqual(diffPlan(planValues(v1), { ...planValues(v1), trainingMinutes: 30, calorieTarget: 2400 }), [
    { field: "trainingMinutes", before: 45, after: 30 },
    { field: "calorieTarget", before: null, after: 2400 },
  ]);
});

test("applying a patch appends a child version and leaves the base untouched", () => {
  const { version, changes } = applyPatch(v1, { trainingMinutes: 30 }, meta("v2"));
  assert.equal(version.parentId, "v1");
  assert.equal(version.trainingMinutes, 30);
  assert.equal(v1.trainingMinutes, 45);
  assert.deepEqual(changes, [{ field: "trainingMinutes", before: 45, after: 30 }]);
});

test("no-op and out-of-bounds patches are refused", () => {
  assert.equal(code(() => applyPatch(v1, { trainingMinutes: 45 }, meta("x"))), "no_change");
  assert.equal(code(() => applyPatch(v1, {}, meta("x"))), "no_change");
  assert.equal(code(() => applyPatch(v1, { trainingDays: 0 }, meta("x"))), "out_of_bounds");
  assert.equal(code(() => applyPatch(v1, { trainingMinutes: 32.5 }, meta("x"))), "out_of_bounds");
  assert.equal(code(() => applyPatch(v1, { sleepHours: null as unknown as number }, meta("x"))), "out_of_bounds");
  assert.equal(code(() => applyPatch(v1, { calorieTarget: 300 }, meta("x"))), "out_of_bounds");
  assert.equal(applyPatch(v1, { proteinTarget: null }, meta("x")).version.proteinTarget, null);
});

test("a change prepared on an old base is reported as stale (409), unknown bases separately", () => {
  const v2 = applyPatch(v1, { trainingMinutes: 30 }, meta("v2")).version;
  const versions = [v1, v2];
  assert.deepEqual(checkBase(versions, "v2", "v2"), { ok: true });
  assert.deepEqual(checkBase(versions, "v2", "v1"), { ok: false, code: "stale_base", currentId: "v2" });
  assert.deepEqual(checkBase(versions, "v2", "zzz"), { ok: false, code: "unknown_version", currentId: "v2" });
});

test("undo appends a compensating version equal to the parent and keeps history", () => {
  const v2 = applyPatch(v1, { trainingMinutes: 30, sleepHours: 7.5 }, meta("v2")).version;
  const { version: v3, changes } = compensate([v1, v2], "v2", "v2", meta("v3"));
  assert.equal(v3.parentId, "v2");
  assert.deepEqual(planValues(v3), planValues(v1));
  assert.deepEqual(changes, [
    { field: "trainingMinutes", before: 30, after: 45 },
    { field: "sleepHours", before: 7.5, after: 8 },
  ]);
  assert.equal(code(() => compensate([v1, v2, v3], "v3", "v2", meta("v4"))), "stale_base");
  assert.equal(code(() => compensate([v1], "v1", "v1", meta("v4"))), "no_parent");
  assert.equal(code(() => compensate([v1], "v1", "nope", meta("v4"))), "unknown_version");
});
