// Calendar arithmetic, completeness and sleep-night attribution.
// Local dates are YYYY-MM-DD strings in the user's IANA time zone.
import type { Meal, Sleep } from "../../src/types";
import { mealNutrients, sumNutrients } from "./nutrition";
import type { Completeness, Totals } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SLEEP_SESSION_MS = 24 * 3600_000;

export function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    throw new RangeError(`Unknown time zone: ${timeZone}`);
  }
}

/** The calendar date of an instant as seen in `timeZone`. */
export function localDateOf(instant: string | Date, timeZone: string): string {
  assertTimeZone(timeZone);
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid instant");
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function parseDate(date: string): number {
  if (!DATE_RE.test(date)) throw new RangeError(`Invalid local date: ${date}`);
  const ms = Date.parse(`${date}T12:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) throw new RangeError(`Invalid local date: ${date}`);
  return ms;
}

/** Pure calendar shift; independent of DST because it works on dates, not instants. */
export function addDays(date: string, delta: number): string {
  return new Date(parseDate(date) + delta * 86400_000).toISOString().slice(0, 10);
}

/** `days` consecutive dates ending at `endDate`, oldest first. */
export function dateWindow(endDate: string, days: number): string[] {
  if (!Number.isInteger(days) || days < 1) throw new RangeError("days must be a positive integer");
  return Array.from({ length: days }, (_, i) => addDays(endDate, i - days + 1));
}

export interface DayNutrition {
  date: string;
  /** At least one meal recorded. An unlogged day has `totals: null`, never zeros. */
  logged: boolean;
  mealCount: number;
  totals: Totals | null;
}

export function dailyNutrition(meals: readonly Meal[], dates: readonly string[]): DayNutrition[] {
  return dates.map((date) => {
    const dayMeals = meals.filter((meal) => meal.date === date);
    if (dayMeals.length === 0) return { date, logged: false, mealCount: 0, totals: null };
    return { date, logged: true, mealCount: dayMeals.length, totals: sumNutrients(dayMeals.map(mealNutrients)) };
  });
}

/** Mean over days that have a value; unlogged days are excluded and reported, not counted as zero. */
export function meanOverLogged(values: readonly (number | null)[]): { mean: number | null } & Completeness {
  const known = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return {
    mean: known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null,
    loggedDays: known.length,
    totalDays: values.length,
  };
}

export interface SleepNight {
  /** Local date of waking up, in the record's own time zone. */
  date: string;
  /** Union of overlapping sessions, so duplicates from two sources are not double counted. */
  minutes: number;
  sessionIds: string[];
}

export interface SleepNightsResult {
  nights: SleepNight[];
  /** Records that cannot be a sleep session (end before start, longer than 24 h, bad instant or zone). */
  rejectedIds: string[];
}

/**
 * Attribute each sleep record to its local wake date and merge overlaps within that date.
 * Naps on the same date count toward the same day total.
 */
export function sleepNights(sleeps: readonly Pick<Sleep, "id" | "start" | "end" | "timezone">[]): SleepNightsResult {
  const rejectedIds: string[] = [];
  const byDate = new Map<string, { start: number; end: number; id: string }[]>();
  for (const sleep of sleeps) {
    const start = Date.parse(sleep.start);
    const end = Date.parse(sleep.end);
    let date: string;
    try {
      if (Number.isNaN(start) || Number.isNaN(end) || end <= start || end - start > MAX_SLEEP_SESSION_MS)
        throw new RangeError("invalid session");
      date = localDateOf(new Date(end), sleep.timezone);
    } catch {
      rejectedIds.push(sleep.id);
      continue;
    }
    const list = byDate.get(date) ?? [];
    list.push({ start, end, id: sleep.id });
    byDate.set(date, list);
  }
  const nights: SleepNight[] = [];
  for (const [date, sessions] of byDate) {
    sessions.sort((a, b) => a.start - b.start);
    let total = 0;
    let runStart = sessions[0].start;
    let runEnd = sessions[0].end;
    for (const session of sessions.slice(1)) {
      if (session.start <= runEnd) runEnd = Math.max(runEnd, session.end);
      else {
        total += runEnd - runStart;
        runStart = session.start;
        runEnd = session.end;
      }
    }
    total += runEnd - runStart;
    nights.push({ date, minutes: Math.round(total / 60_000), sessionIds: sessions.map((session) => session.id) });
  }
  nights.sort((a, b) => a.date.localeCompare(b.date));
  return { nights, rejectedIds };
}
