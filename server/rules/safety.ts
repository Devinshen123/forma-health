// Safety guards for automated suggestions. Numbers here are a DRAFT pending review by a
// registered dietitian; see docs/safety/safety-rules.md. Until then the engine never touches
// energy or protein targets — only the user can change those.
import type { PlanField, PlanPatch, PlanValues } from "./types";

export const SAFETY_REVIEW_STATUS = "draft_pending_dietitian_review" as const;
export const MIN_AGE_YEARS = 18;

/** Fields the rules engine may propose changing. Nutrition targets are user-only. */
export const ENGINE_PROPOSABLE_FIELDS: readonly PlanField[] = ["trainingMinutes", "trainingDays"];
/** Largest step one automated proposal may take upward. Decreases are not capped. */
export const MAX_INCREASE_PER_PROPOSAL: Partial<Record<PlanField, number>> = { trainingMinutes: 15, trainingDays: 1 };

export type AgeStatus = "eligible" | "ineligible" | "needs_birth_date";

/**
 * With only a birth year the exact age is ambiguous by one year.
 * Eligible only when even the youngest possible age is 18+; the borderline year needs a full birth date.
 */
export function ageEligibility(birthYear: number | null | undefined, today: string): AgeStatus {
  const year = Number(today.slice(0, 4));
  if (birthYear === null || birthYear === undefined || !Number.isInteger(birthYear) || birthYear > year)
    return "needs_birth_date";
  const youngest = year - birthYear - 1;
  const oldest = year - birthYear;
  if (youngest >= MIN_AGE_YEARS) return "eligible";
  if (oldest < MIN_AGE_YEARS) return "ineligible";
  return "needs_birth_date";
}

const parseLocalDate = (date: string): [number, number, number] | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) return null;
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
};

/** Completed years on `today`. A 29 February birthday counts from 1 March in non-leap years. */
export function ageOnDate(birthDate: string, today: string): number | null {
  const birth = parseLocalDate(birthDate);
  const now = parseLocalDate(today);
  if (!birth || !now || birthDate > today) return null;
  const beforeBirthday = now[1] < birth[1] || (now[1] === birth[1] && now[2] < birth[2]);
  return now[0] - birth[0] - (beforeBirthday ? 1 : 0);
}

/** Exact adult check from a full birth date (preferred over `ageEligibility` with a year only). */
export function adultStatus(birthDate: string | null | undefined, today: string): "eligible" | "ineligible" | "invalid" {
  const age = birthDate ? ageOnDate(birthDate, today) : null;
  if (age === null) return "invalid";
  return age >= MIN_AGE_YEARS ? "eligible" : "ineligible";
}

export const CONSERVATIVE_REASONS = [
  "pregnancy_or_breastfeeding",
  "eating_disorder_history",
  "kidney_disease",
  "diabetes_medication",
  "under_medical_care",
] as const;
export type ConservativeReason = (typeof CONSERVATIVE_REASONS)[number];

export function conservativeMode(flags: Partial<Record<ConservativeReason, boolean>>): {
  active: boolean;
  reasons: ConservativeReason[];
} {
  const reasons = CONSERVATIVE_REASONS.filter((reason) => flags[reason] === true);
  return { active: reasons.length > 0, reasons };
}

export type BlockCode = "user_only_field" | "step_too_large" | "conservative_no_increase";

/** Filter an engine-generated patch. Anything blocked is reported, never silently changed. */
export function guardEnginePatch(
  base: PlanValues,
  patch: PlanPatch,
  context: { conservative: boolean },
): { allowed: PlanPatch; blocked: { field: PlanField; code: BlockCode }[] } {
  const allowed: PlanPatch = {};
  const blocked: { field: PlanField; code: BlockCode }[] = [];
  for (const [field, value] of Object.entries(patch) as [PlanField, number | null | undefined][]) {
    if (value === undefined) continue;
    if (!ENGINE_PROPOSABLE_FIELDS.includes(field) || value === null) {
      blocked.push({ field, code: "user_only_field" });
      continue;
    }
    const before = base[field];
    const increase = before === null ? 0 : value - before;
    if (increase > 0 && context.conservative) {
      blocked.push({ field, code: "conservative_no_increase" });
      continue;
    }
    const cap = MAX_INCREASE_PER_PROPOSAL[field];
    if (cap !== undefined && increase > cap) {
      blocked.push({ field, code: "step_too_large" });
      continue;
    }
    (allowed as Record<PlanField, number>)[field] = value;
  }
  return { allowed, blocked };
}

// ---------------------------------------------------------------------------------------------
// Allergens: we can only compare declared allergens with words in a food's name or ingredients.
// A photo cannot reveal hidden ingredients, so the absence of a warning never means "safe".

export const ALLERGEN_DISCLAIMER_KEY = "allergen.not_a_safety_check";

interface AllergenGroup {
  terms: string[];
  /** Phrases that contain a term but do not mean the allergen (removed before matching). */
  exclude?: string[];
}

export const ALLERGEN_GROUPS: Record<string, AllergenGroup> = {
  peanut: { terms: ["peanut", "花生"] },
  tree_nut: {
    terms: ["tree nut", "almond", "walnut", "cashew", "pecan", "hazelnut", "pistachio", "macadamia", "坚果", "杏仁", "核桃", "腰果", "榛子", "开心果", "碧根果", "夏威夷果"],
  },
  milk: {
    terms: ["milk", "dairy", "lactose", "cheese", "butter", "cream", "yogurt", "yoghurt", "whey", "牛奶", "乳糖", "乳制品", "奶酪", "芝士", "黄油", "奶油", "酸奶", "乳清", "奶"],
    exclude: ["coconut milk", "almond milk", "oat milk", "soy milk", "椰奶", "杏仁奶", "燕麦奶", "豆奶", "奶白菜"],
  },
  egg: { terms: ["egg", "mayonnaise", "鸡蛋", "蛋黄", "蛋清", "蛋"], exclude: ["eggplant", "蛋白质"] },
  wheat_gluten: {
    terms: ["wheat", "gluten", "flour", "bread", "pasta", "noodle", "小麦", "麸质", "面粉", "面包", "面条", "馒头", "饺子", "包子"],
    exclude: ["buckwheat", "荞麦"],
  },
  soy: { terms: ["soy", "soya", "tofu", "edamame", "miso", "大豆", "黄豆", "豆腐", "豆浆", "毛豆", "味噌", "酱油"] },
  fish: { terms: ["fish", "salmon", "tuna", "cod", "鱼", "三文鱼", "金枪鱼", "鳕鱼"], exclude: ["鱿鱼", "鲍鱼", "squid"] },
  shellfish: {
    terms: ["shellfish", "shrimp", "prawn", "crab", "lobster", "clam", "oyster", "mussel", "scallop", "squid", "虾", "蟹", "龙虾", "蛤", "蚝", "牡蛎", "扇贝", "鱿鱼", "鲍鱼", "贝"],
    exclude: ["贝果"],
  },
  sesame: { terms: ["sesame", "tahini", "芝麻", "麻酱"] },
};

const NONE_TOKENS = new Set(["none", "no", "n/a", "na", "无", "没有", "没", "否"]);

/** Split a free-text allergy field into declared tokens, dropping "none"-style answers. */
export function parseDeclaredAllergens(text: string): string[] {
  return text
    .split(/[,，、;；\n/]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0 && !NONE_TOKENS.has(token));
}

/** Map a declared token to a group: exact key or term first, else the longest contained term wins. */
function groupOf(token: string): string | null {
  for (const [group, { terms }] of Object.entries(ALLERGEN_GROUPS))
    if (group === token || terms.includes(token)) return group;
  let best: { group: string; length: number } | null = null;
  for (const [group, { terms }] of Object.entries(ALLERGEN_GROUPS))
    for (const term of terms)
      if (token.includes(term) && (best === null || term.length > best.length)) best = { group, length: term.length };
  return best?.group ?? null;
}

export interface AllergenWarning {
  declared: string;
  matched: string;
}

/** Possible conflicts between declared allergens and a food description. Never a safety clearance. */
export function allergenWarnings(declaredText: string, foodText: string): AllergenWarning[] {
  const food = foodText.toLowerCase();
  const warnings: AllergenWarning[] = [];
  for (const declared of parseDeclaredAllergens(declaredText)) {
    const group = groupOf(declared);
    if (group === null) {
      if (food.includes(declared)) warnings.push({ declared, matched: declared });
      continue;
    }
    const { terms, exclude = [] } = ALLERGEN_GROUPS[group];
    const cleaned = exclude.reduce((text, phrase) => text.split(phrase).join(" "), food);
    const matched = terms.find((term) => cleaned.includes(term));
    if (matched) warnings.push({ declared, matched });
  }
  return warnings;
}
