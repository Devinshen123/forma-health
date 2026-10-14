// zh/en templates for rule reasons. Wording describes what was logged and never claims causation
// or certainty; an LLM may later rephrase, but these deterministic texts are the fallback.
import type { Reason } from "./types";

export type RuleLanguage = "zh" | "en";

export const RULE_MESSAGES: Record<string, Record<RuleLanguage, string>> = {
  "rule.training.minutes_down": {
    zh: "最近 {days} 天你记录了 {count} 次训练，时长中位数 {median} 分钟，计划是 {planned} 分钟。把计划改为 {proposed} 分钟，可能更贴近你实际能安排的时间。",
    en: "In the last {days} days you logged {count} workouts with a median of {median} min, against a plan of {planned} min. Setting the plan to {proposed} min may better match the time you actually have.",
  },
  "rule.training.minutes_up": {
    zh: "最近 {days} 天你记录了 {count} 次训练，时长中位数 {median} 分钟，高于计划的 {planned} 分钟。可以把计划提高到 {proposed} 分钟（每次调整最多增加 15 分钟）。",
    en: "In the last {days} days you logged {count} workouts with a median of {median} min, above your plan of {planned} min. You could raise the plan to {proposed} min (at most 15 min per change).",
  },
  "rule.training.days_down": {
    zh: "过去 {weeks} 周你记录到的训练平均每周 {average} 天，计划是每周 {planned} 天。可以把计划改为每周 {proposed} 天。这只按已记录的训练计算；如果有没记录的训练，可以忽略这条建议。",
    en: "Over the last {weeks} weeks your logged workouts averaged {average} days a week, against a plan of {planned}. You could set the plan to {proposed} days a week. This counts logged workouts only; if you trained without logging, ignore this suggestion.",
  },
  "rule.recovery.lighter_option": {
    zh: "昨晚记录的睡眠约 {hours} 小时，精力自评 {energy}/5。如果今天训练，可以考虑降低强度或缩短时间。这只是一个可选项，不会自动取消训练。",
    en: "You logged about {hours} h of sleep last night and rated your energy {energy}/5. If you train today, you could go lighter or shorter. This is optional and will not cancel your workout.",
  },
  "rule.training.session_today": {
    zh: "计划每周训练 {planned} 次，最近 7 天记录了 {done} 次。今天可以安排一次 {minutes} 分钟的训练。",
    en: "Your plan has {planned} sessions a week and you logged {done} in the last 7 days. Today could fit a {minutes}-minute session.",
  },
  "rule.nutrition.protein_gap": {
    zh: "最近 {totalDays} 天里有 {days} 天记录较完整，这些天蛋白质平均 {average} 克，目标是 {target} 克。下一餐可以考虑加一份蛋白质来源。以上按你的记录计算，可能有漏记。",
    en: "On {days} well-logged days out of the last {totalDays}, protein averaged {average} g against a target of {target} g. Consider adding a protein source at your next meal. Based on what you logged; some food may be missing.",
  },
  "rule.sleep.wind_down": {
    zh: "最近 {totalDays} 天记录了 {nights} 晚睡眠，平均 {average} 小时，目标是 {target} 小时。今晚可以试着提前 30 分钟准备休息。",
    en: "You logged {nights} nights in the last {totalDays} days, averaging {average} h against a target of {target} h. Tonight, try starting to wind down 30 minutes earlier.",
  },
  "weekly.data_completeness": {
    zh: "这 {totalDays} 天中：饮食记录 {nutritionDays} 天，训练记录 {trainingDays} 天，睡眠记录 {sleepNights} 晚。没记录的日子不计入平均值。",
    en: "Over these {totalDays} days: meals logged on {nutritionDays} days, workouts on {trainingDays} days, sleep on {sleepNights} nights. Unlogged days are left out of the averages.",
  },
  "weekly.training_adherence": {
    zh: "计划每周训练 {planned} 天，这周记录到 {done} 天。",
    en: "Your plan has {planned} training days a week; you logged {done} this week.",
  },
  "weekly.actions_completed": {
    zh: "{totalDays} 天中有 {days} 天完成了至少一项今日行动。",
    en: "You completed at least one daily action on {days} of {totalDays} days.",
  },
  "weekly.sleep_trend": {
    zh: "已记录夜晚的平均睡眠为 {current} 小时，上周为 {previous} 小时。",
    en: "Average sleep on logged nights was {current} h, compared with {previous} h the week before.",
  },
  "weekly.protein_trend": {
    zh: "记录较完整的日子里，平均蛋白质为 {current} 克，上周为 {previous} 克。",
    en: "On well-logged days, protein averaged {current} g, compared with {previous} g the week before.",
  },
  "weekly.comparison_limited": {
    zh: "这周或上周记录的天数较少，部分指标暂不做对比。",
    en: "Some metrics are not compared because one of the two weeks has too few logged days.",
  },
  "rule.logging.meals_insufficient": {
    zh: "最近 {totalDays} 天中有 {loggedDays} 天记录了饮食。至少记录 3 天后，才能给出饮食方面的建议。",
    en: "You logged meals on {loggedDays} of the last {totalDays} days. Log at least 3 days to get nutrition suggestions.",
  },
};

export const placeholders = (template: string) => [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);

/** Render a reason; throws on an unknown key or a missing parameter so gaps are caught in tests. */
export function renderReason(reason: Reason, lang: RuleLanguage): string {
  const template = RULE_MESSAGES[reason.key]?.[lang];
  if (template === undefined) throw new Error(`No ${lang} template for ${reason.key}`);
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = reason.params[name];
    if (value === undefined) throw new Error(`Missing parameter ${name} for ${reason.key}`);
    return String(value);
  });
}
