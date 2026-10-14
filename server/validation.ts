import { z } from "zod";
import type { AppState, Suggestion } from "../src/types";

const text = (max = 2000) => z.string().max(max);
const title = z.string().trim().min(1).max(160);
export const idSchema = z.string().uuid();
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Use a valid calendar date");
const instant = z.string().datetime({ offset: true });
const timezone = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Use a valid IANA time zone");
const minutes = z.number().int().min(1).max(1440);
const days = z.number().int().min(1).max(7);
const hours = z.number().min(1).max(16);
const patchSchema = z
  .object({
    trainingMinutes: minutes.optional(),
    trainingDays: days.optional(),
    sleepHours: hours.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "An adjustment must change at least one field",
  );
const planSchema = z
  .object({
    id: idSchema,
    parentId: idSchema.nullable(),
    createdAt: instant,
    reason: title,
    trainingMinutes: minutes,
    trainingDays: days,
    sleepHours: hours,
    calorieTarget: z.number().min(1).max(20000).nullable(),
    proteinTarget: z.number().min(0).max(2000).nullable(),
  })
  .strict();
const suggestionSchema = z
  .object({
    id: idSchema,
    baseVersionId: idSchema,
    createdAt: instant,
    reason: title,
    status: z.enum(["proposed", "accepted", "undone", "rejected"]),
    patch: patchSchema,
    acceptedVersionId: idSchema.optional(),
  })
  .strict();
const mealSchema = z
  .object({
    id: idSchema,
    date: dateSchema,
    name: title,
    type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    grams: z.number().positive().max(10000),
    referenceGrams: z.number().positive().max(10000),
    kcal: z.number().min(0).max(100000),
    protein: z.number().min(0).max(10000),
    carbs: z.number().min(0).max(10000),
    fat: z.number().min(0).max(10000),
    source: z.enum(["manual", "label", "ai_estimate"]),
    assetId: idSchema.optional(),
    aiDraftId: idSchema.optional(),
    aiItemIndex: z.number().int().min(0).max(7).optional(),
    createdAt: instant,
  })
  .strict()
  .superRefine((meal, ctx) => {
    if (meal.source === 'ai_estimate') {
      if (!meal.aiDraftId || meal.aiItemIndex === undefined || !meal.assetId || meal.referenceGrams !== 100)
        ctx.addIssue({ code: 'custom', message: 'AI meals must identify their reviewed draft item, photo and 100 g reference' });
    } else if (meal.aiDraftId !== undefined || meal.aiItemIndex !== undefined) {
      ctx.addIssue({ code: 'custom', message: 'Manual and label meals cannot claim AI draft provenance' });
    }
    if (meal.protein + meal.carbs + meal.fat > meal.referenceGrams * 1.1 + 1)
      ctx.addIssue({
        code: "custom",
        path: ["referenceGrams"],
        message: "Macros must refer to the stated reference weight",
      });
    if (meal.kcal > meal.referenceGrams * 12)
      ctx.addIssue({
        code: "custom",
        path: ["kcal"],
        message: "Calories must refer to the stated reference weight",
      });
  });
const sleepSchema = z
  .object({
    id: idSchema,
    date: dateSchema,
    start: instant,
    end: instant,
    quality: z.number().int().min(1).max(5),
    energy: z.number().int().min(1).max(5),
    source: z.literal("manual"),
    timezone,
    createdAt: instant,
  })
  .strict()
  .superRefine((sleep, ctx) => {
    const length = Date.parse(sleep.end) - Date.parse(sleep.start);
    if (!(length > 0 && length <= 24 * 60 * 60 * 1000))
      ctx.addIssue({
        code: "custom",
        path: ["end"],
        message: "Sleep must end after it starts and span at most 24 hours",
      });
    try {
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: sleep.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(sleep.end));
      if (date !== sleep.date)
        ctx.addIssue({
          code: "custom",
          path: ["date"],
          message: "Sleep date must be the wake-up day in its time zone",
        });
    } catch {
      /* the underlying date/time-zone schemas report invalid values */
    }
  });
export const stateSchema = z
  .object({
    profile: z
      .object({
        name: title,
        goal: z.enum(["performance", "strength", "habits"]),
        experience: z.enum(["new", "regular"]),
        trainingDays: days,
        timeMinutes: minutes,
        equipment: z.enum(["gym", "home", "bodyweight"]),
        allergies: text(),
        restrictions: text(),
        language: z.enum(["zh", "en"]),
        units: z.enum(["metric", "imperial"]),
        timezone,
        sleepGoal: hours,
        cloudConsent: z.boolean(),
        aiConsent: z.boolean(),
      })
      .strict()
      .nullable(),
    meals: z.array(mealSchema).max(10000),
    workouts: z
      .array(
        z
          .object({
            id: idSchema,
            date: dateSchema,
            name: title,
            duration: minutes,
            rpe: z.number().min(1).max(10),
            exercises: z
              .array(
                z
                  .object({
                    name: title,
                    sets: z.number().int().min(1).max(100),
                    reps: z.number().int().min(1).max(1000),
                    weight: z.number().min(0).max(2000),
                  })
                  .strict(),
              )
              .min(1)
              .max(100),
            notes: text(10000),
            createdAt: instant,
          })
          .strict(),
      )
      .max(10000),
    sleeps: z.array(sleepSchema).max(10000),
    reports: z
      .array(
        z
          .object({
            id: idSchema,
            name: title,
            date: dateSchema,
            assetId: idSchema.optional(),
            markers: z
              .array(
                z
                  .object({
                    name: title,
                    value: z.string().trim().min(1).max(500),
                    unit: text(100),
                    range: text(500),
                    notes: text(2000),
                  })
                  .strict(),
              )
              .max(200),
            extractionStatus: z.literal("manual"),
            createdAt: instant,
          })
          .strict()
          .refine(
            (report) => !!report.assetId || report.markers.length > 0,
            "A report needs an attachment or a manual marker",
          ),
      )
      .max(1000),
    planVersions: z.array(planSchema).max(10000),
    currentPlanId: idSchema.nullable(),
    suggestions: z.array(suggestionSchema).max(10000),
    completedActions: z.record(
      dateSchema,
      z
        .array(z.string().min(1).max(120))
        .max(100)
        .refine(
          (values) => new Set(values).size === values.length,
          "Actions must be unique",
        ),
    ),
  })
  .strict()
  .superRefine((state, ctx) => {
    const ids = new Set<string>();
    for (const collection of [
      "meals",
      "workouts",
      "sleeps",
      "reports",
      "planVersions",
      "suggestions",
    ] as const) {
      for (const [index, entity] of state[collection].entries()) {
        if (ids.has(entity.id))
          ctx.addIssue({
            code: "custom",
            path: [collection, index, "id"],
            message: "Entity IDs must be unique",
          });
        ids.add(entity.id);
      }
    }
    const plans = new Map(
      state.planVersions.map((version) => [version.id, version]),
    );
    const sleepsByStart = [...state.sleeps].sort(
      (a, b) => Date.parse(a.start) - Date.parse(b.start),
    );
    for (let index = 1; index < sleepsByStart.length; index++) {
      if (
        Date.parse(sleepsByStart[index].start) <
        Date.parse(sleepsByStart[index - 1].end)
      )
        ctx.addIssue({
          code: "custom",
          path: ["sleeps"],
          message: "Sleep intervals cannot overlap",
        });
    }
    const earlier = new Set<string>();
    for (const [index, version] of state.planVersions.entries()) {
      if (
        index === 0
          ? version.parentId !== null
          : !version.parentId || !earlier.has(version.parentId)
      )
        ctx.addIssue({
          code: "custom",
          path: ["planVersions", index, "parentId"],
          message:
            "Each version must point to an earlier version; only the first is a root",
        });
      earlier.add(version.id);
    }
    if (
      state.planVersions.length
        ? !state.currentPlanId || !plans.has(state.currentPlanId)
        : state.currentPlanId !== null
    )
      ctx.addIssue({
        code: "custom",
        path: ["currentPlanId"],
        message: "Current plan must reference an existing version",
      });
    for (const [index, suggestion] of state.suggestions.entries()) {
      if (!plans.has(suggestion.baseVersionId))
        ctx.addIssue({
          code: "custom",
          path: ["suggestions", index],
          message: "Adjustment base plan does not exist",
        });
      const accepted =
        suggestion.acceptedVersionId && plans.get(suggestion.acceptedVersionId);
      if (
        ["accepted", "undone"].includes(suggestion.status)
          ? !accepted || accepted.parentId !== suggestion.baseVersionId
          : suggestion.acceptedVersionId !== undefined
      )
        ctx.addIssue({
          code: "custom",
          path: ["suggestions", index],
          message: "Adjustment status and accepted plan must agree",
        });
    }
    for (const date of Object.keys(state.completedActions)) {
      if (["__proto__", "constructor", "prototype"].includes(date))
        ctx.addIssue({
          code: "custom",
          path: ["completedActions"],
          message: "Invalid action date",
        });
    }
  });

export const credentialsSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(10).max(128),
  })
  .strict();
export const registerSchema = credentialsSchema.extend({ name: title });
export const putStateSchema = z
  .object({
    state: stateSchema,
    revision: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER - 1),
  })
  .strict();
export const passwordSchema = z
  .object({ password: z.string().min(1).max(128) })
  .strict();
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const immutableSuggestion = ({
  status: _status,
  acceptedVersionId: _accepted,
  ...fields
}: Suggestion) => fields;
const targetFields = [
  "trainingMinutes",
  "trainingDays",
  "sleepHours",
  "calorieTarget",
  "proteinTarget",
] as const;

/** Both accept and undo append versions; an undo is a compensating child, never a history rewrite. */
export function validateTransition(
  previous: AppState,
  next: AppState,
): string | null {
  if (next.planVersions.length < previous.planVersions.length)
    return "Plan history cannot be deleted";
  for (let i = 0; i < previous.planVersions.length; i++)
    if (!equal(previous.planVersions[i], next.planVersions[i]))
      return "Existing plan versions cannot be edited or reordered";
  const appended = next.planVersions.slice(previous.planVersions.length);
  if (appended.length > 1) return "Save one plan version at a time";
  if (appended.length && appended[0].parentId !== previous.currentPlanId)
    return "A new plan must descend from the current plan";
  const oldSuggestions = new Map(
    previous.suggestions.map((item) => [item.id, item]),
  );
  const newSuggestions = new Map(
    next.suggestions.map((item) => [item.id, item]),
  );
  const accepted: Suggestion[] = [],
    undone: Suggestion[] = [];
  for (const old of previous.suggestions) {
    const item = newSuggestions.get(old.id);
    if (!item || !equal(immutableSuggestion(old), immutableSuggestion(item)))
      return "Adjustment history cannot be removed or rewritten";
    if (
      old.acceptedVersionId &&
      old.acceptedVersionId !== item.acceptedVersionId
    )
      return "The accepted plan reference is immutable";
    if (old.status === item.status) continue;
    if (old.status === "proposed" && item.status === "accepted")
      accepted.push(item);
    else if (old.status === "accepted" && item.status === "undone")
      undone.push(item);
    else if (!(old.status === "proposed" && item.status === "rejected"))
      return "Invalid adjustment status transition";
  }
  for (const item of next.suggestions)
    if (!oldSuggestions.has(item.id)) {
      if (
        item.status !== "proposed" ||
        item.baseVersionId !== next.currentPlanId
      )
        return "New adjustments must be proposed against the current plan";
    }
  if (accepted.length + undone.length > 1)
    return "Save one adjustment decision at a time";
  if (accepted.length) {
    const item = accepted[0],
      version = appended[0];
    const parent = previous.planVersions.find(
      (value) => value.id === item.baseVersionId,
    );
    if (
      !parent ||
      previous.currentPlanId !== item.baseVersionId ||
      appended.length !== 1 ||
      !version ||
      version.id !== item.acceptedVersionId ||
      next.currentPlanId !== version.id
    )
      return "Accepting an adjustment requires a new child of its current base plan";
    for (const field of targetFields) {
      const expected =
        field in item.patch
          ? item.patch[field as keyof typeof item.patch]
          : parent[field];
      if (version[field] !== expected)
        return "Accepted plan must match the proposed adjustment";
    }
  } else if (undone.length) {
    const item = undone[0];
    const version = previous.planVersions.find(
      (value) => value.id === item.acceptedVersionId,
    );
    const base = previous.planVersions.find(
      (value) => value.id === item.baseVersionId,
    );
    const compensation = appended[0];
    if (
      !version ||
      !base ||
      previous.currentPlanId !== version.id ||
      appended.length !== 1 ||
      !compensation ||
      compensation.parentId !== version.id ||
      next.currentPlanId !== compensation.id
    )
      return "Undoing the current adjustment requires a new compensating plan version";
    for (const field of targetFields)
      if (compensation[field] !== base[field])
        return "The undo version must restore every target from the adjustment base";
  } else if (
    appended.length
      ? next.currentPlanId !== appended[0].id
      : next.currentPlanId !== previous.currentPlanId
  )
    return "Current plan can change only by appending a version or undoing an accepted adjustment";
  return null;
}

export function parseState(value: unknown): AppState {
  return stateSchema.parse(value) as AppState;
}
