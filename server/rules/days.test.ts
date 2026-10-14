import assert from "node:assert/strict";
import { test } from "node:test";
import type { Meal } from "../../src/types";
import { addDays, dailyNutrition, dateWindow, localDateOf, meanOverLogged, sleepNights } from "./days";

const meal = (date: string, kcal: number | null, protein: number | null): Meal =>
  ({
    id: `${date}-${kcal}-${protein}`,
    date,
    name: "x",
    type: "lunch",
    grams: 100,
    referenceGrams: 100,
    kcal,
    protein,
    carbs: 10,
    fat: 5,
    source: "manual",
    createdAt: `${date}T12:00:00Z`,
  }) as unknown as Meal;

test("local date follows the user's zone, not the server's", () => {
  const instant = "2026-10-14T05:30:00Z";
  assert.equal(localDateOf(instant, "America/Los_Angeles"), "2026-10-13");
  assert.equal(localDateOf(instant, "Asia/Shanghai"), "2026-10-14");
  assert.throws(() => localDateOf(instant, "Mars/Olympus"), RangeError);
  assert.throws(() => localDateOf("not a date", "UTC"), RangeError);
});

test("date arithmetic crosses months, leap days and DST boundaries by calendar day", () => {
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2026-11-01", 1), "2026-11-02");
  assert.deepEqual(dateWindow("2026-10-14", 3), ["2026-10-12", "2026-10-13", "2026-10-14"]);
  assert.throws(() => addDays("2026-02-30", 1), RangeError);
  assert.throws(() => dateWindow("2026-10-14", 0), RangeError);
});

test("unlogged days stay unlogged and averages report completeness instead of zero-filling", () => {
  const days = dailyNutrition(
    [meal("2026-10-12", 500, 30), meal("2026-10-12", 300, 20), meal("2026-10-14", 700, null)],
    ["2026-10-12", "2026-10-13", "2026-10-14"],
  );
  assert.equal(days[1].logged, false);
  assert.equal(days[1].totals, null);
  assert.equal(days[0].totals?.values.kcal, 800);
  assert.equal(days[2].totals?.values.protein, null);
  const kcal = meanOverLogged(days.map((day) => day.totals?.values.kcal ?? null));
  assert.deepEqual(kcal, { mean: 750, loggedDays: 2, totalDays: 3 });
  assert.deepEqual(meanOverLogged([null, null]), { mean: null, loggedDays: 0, totalDays: 2 });
});

test("an overnight session belongs to the local wake date", () => {
  const { nights } = sleepNights([
    { id: "a", start: "2026-10-13T23:30:00-07:00", end: "2026-10-14T07:00:00-07:00", timezone: "America/Los_Angeles" },
  ]);
  assert.deepEqual(nights, [{ date: "2026-10-14", minutes: 450, sessionIds: ["a"] }]);
});

test("overlapping duplicates from two sources are merged, a separate nap is added", () => {
  const tz = "Europe/Berlin";
  const { nights } = sleepNights([
    { id: "watch", start: "2026-10-13T23:00:00+02:00", end: "2026-10-14T06:30:00+02:00", timezone: tz },
    { id: "manual", start: "2026-10-13T23:15:00+02:00", end: "2026-10-14T07:00:00+02:00", timezone: tz },
    { id: "nap", start: "2026-10-14T14:00:00+02:00", end: "2026-10-14T14:30:00+02:00", timezone: tz },
  ]);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].minutes, 8 * 60 + 30);
  assert.deepEqual(nights[0].sessionIds, ["watch", "manual", "nap"]);
});

test("impossible sessions are rejected and reported rather than counted", () => {
  const result = sleepNights([
    { id: "backwards", start: "2026-10-14T07:00:00Z", end: "2026-10-13T23:00:00Z", timezone: "UTC" },
    { id: "too-long", start: "2026-10-12T07:00:00Z", end: "2026-10-14T07:00:00Z", timezone: "UTC" },
    { id: "bad-zone", start: "2026-10-13T23:00:00Z", end: "2026-10-14T07:00:00Z", timezone: "Nowhere/City" },
  ]);
  assert.deepEqual(result.nights, []);
  assert.deepEqual(result.rejectedIds, ["backwards", "too-long", "bad-zone"]);
});
