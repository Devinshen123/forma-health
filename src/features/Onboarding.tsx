import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Dumbbell,
  Heart,
  Sparkles,
} from "lucide-react";
import { currentPlan, uid } from "../types";
import type { FeatureProps, Profile, PlanVersion } from "../types";

const copy = {
  zh: {
    eyebrow: "你的起点",
    title: "先认识你，再安排今天。",
    subtitle: "六个小步骤，建立一个由你确认、随时可改的起始计划。",
    steps: [
      "你的目标",
      "训练节奏",
      "偏好与限制",
      "休息状态",
      "可选营养目标",
      "确认计划",
    ],
    back: "返回",
    next: "继续",
    skip: "暂时跳过",
    confirm: "确认我的计划",
    saving: "正在保存…",
    saved: "计划已确认，可以开始记录今天。",
    goalTitle: "你想把哪件事练得更好？",
    goalHelp: "选择当前最关注的方向，之后也能调整。",
    performance: "健身表现",
    performanceHelp: "在训练、补给与休息之间找到更适合你的节奏。",
    strength: "力量与进步",
    strengthHelp: "持续记录训练，让组数、次数与负重的进步有迹可循。",
    habits: "长期健康习惯",
    habitsHelp: "从做得到的小行动开始，关注持续性与完整记录。",
    name: "称呼（可选）",
    namePlaceholder: "我们该怎么称呼你？",
    trainingTitle: "让训练适合你的生活。",
    trainingHelp: "先填写你实际能安排的时间；这些是你的选择，不是 AI 处方。",
    experience: "训练经验",
    new: "刚开始",
    regular: "有规律训练",
    days: "每周训练天数",
    minutes: "每次训练时间（分钟）",
    equipment: "常用器械与场地",
    gym: "健身房",
    home: "居家器械",
    bodyweight: "自重训练",
    foodTitle: "你的偏好和限制，值得被尊重。",
    foodHelp:
      "只填写与计划有关的信息。过敏和活动限制会作为你的备注，当前版本不自动生成食谱或医疗建议。",
    allergies: "食物过敏（可选）",
    allergyPlaceholder: "例如：花生、乳制品",
    restrictions: "饮食偏好、饮食与活动限制（可选）",
    restrictionPlaceholder:
      "例如：素食；近期膝盖不适，避免跳跃。请不要填写证件等无关信息。",
    sleepTitle: "给休息留出空间。",
    sleepHelp:
      "设置你希望安排的睡眠时间。这是可修改的个人目标，不代表睡眠测量或诊断。",
    sleepGoal: "计划中的睡眠时间（小时）",
    restState: "感觉与记录，一起考虑。",
    restHelp:
      "确认计划后，可以在睡眠页记录实际睡眠、主观精力与睡眠感受。单项指标或主观感觉不会自动取消训练。",
    nutritionTitle: "已有营养目标，就把它带进来。",
    nutritionHelp:
      "如果没有确定的目标，留空即可。我们不会根据问卷自动计算减脂或医疗目标。",
    calories: "每日能量目标（kcal，可选）",
    protein: "每日蛋白质目标（g，可选）",
    optionalPlaceholder: "留空也可以",
    reviewTitle: "这是属于你的起始计划。",
    reviewHelp:
      "训练安排来自你填写的时间与器械、配合固定模板；当前没有调用 AI。记录实际执行情况后，再由你选择调整。",
    goalLabel: "当前目标",
    trainingLabel: "每周训练",
    sleepLabel: "睡眠安排",
    nutritionLabel: "营养目标",
    noTarget: "暂未设置，以记录为起点",
    dayUnit: "天",
    minuteUnit: "分钟 / 次",
    hourUnit: "小时 / 晚",
    templateTitle: "训练模板",
    templateGym:
      "全身基础训练：蹲、推、拉和核心，按你的时间安排；动作与负重由你确认。",
    templateHome: "居家全身训练：蹲、推、划船和核心，按现有器械替换动作。",
    templateBodyweight:
      "自重基础训练：蹲、墙面或地面推、髋部动作和核心，选择适合自己的替代动作。",
    source: "来源：你的问卷与固定模板",
    note: "填写内容只用于你的计划和记录。Apple Health 与第三方 AI 的授权会在需要时单独说明。",
    draft: "此设备会保存未完成的问卷草稿；确认后自动清除。",
    draftUnavailable: "此浏览器暂时无法保存草稿；本次仍可以继续完成。",
    trainingError: "请填写每周 1–7 天、每次 10–180 分钟的实际可用训练时间。",
    sleepError: "请填写 4–12 小时之间的睡眠安排。",
    nutritionError:
      "可选目标必须为数值：能量 500–8000 kcal，蛋白质 1–400 g；不确定时请留空。",
    saveError: "计划暂未保存，请稍后重试。填写内容仍然保留。",
  },
  en: {
    eyebrow: "YOUR STARTING POINT",
    title: "A plan that begins with you.",
    subtitle:
      "Six small steps to create a starting plan you can review and change.",
    steps: [
      "Your goal",
      "Training rhythm",
      "Preferences & limits",
      "Rest & energy",
      "Optional nutrition",
      "Review your plan",
    ],
    back: "Back",
    next: "Continue",
    skip: "Skip for now",
    confirm: "Confirm my plan",
    saving: "Saving…",
    saved: "Your plan is ready. Start recording today.",
    goalTitle: "What would you like to work on?",
    goalHelp: "Choose what matters most right now. You can change it later.",
    performance: "Fitness performance",
    performanceHelp:
      "Find a rhythm that connects training, nutrition and recovery.",
    strength: "Strength & progress",
    strengthHelp: "Track sets, repetitions and weights to see your progress.",
    habits: "Long-term healthy habits",
    habitsHelp: "Start with manageable actions and consistent records.",
    name: "Preferred name (optional)",
    namePlaceholder: "What should we call you?",
    trainingTitle: "Fit training into your life.",
    trainingHelp:
      "Choose the time you can actually set aside. These are your preferences, not an AI prescription.",
    experience: "Training experience",
    new: "Getting started",
    regular: "Train regularly",
    days: "Training days per week",
    minutes: "Minutes per session",
    equipment: "Equipment & location",
    gym: "Gym",
    home: "Home equipment",
    bodyweight: "Bodyweight",
    foodTitle: "Make room for your preferences.",
    foodHelp:
      "Share only what is useful for your plan. Allergies and activity limits are saved as your notes; this version does not automatically create recipes or medical advice.",
    allergies: "Food allergies (optional)",
    allergyPlaceholder: "For example: peanuts, dairy",
    restrictions: "Food preferences, dietary & activity limits (optional)",
    restrictionPlaceholder:
      "For example: vegetarian; recent knee discomfort, avoid jumping. Do not include unrelated identifiers.",
    sleepTitle: "Leave room for rest.",
    sleepHelp:
      "Choose the sleep time you would like to plan for. This is an editable personal goal, not a measurement or diagnosis.",
    sleepGoal: "Planned sleep time (hours)",
    restState: "Consider your records and how you feel.",
    restHelp:
      "After confirming, use the Sleep page to record actual sleep, energy and how you felt. One metric or a feeling alone will not automatically cancel training.",
    nutritionTitle: "Bring a nutrition goal you already have.",
    nutritionHelp:
      "Leave these empty if you have not chosen a goal. We do not automatically calculate weight-loss or medical targets from your answers.",
    calories: "Daily energy target (kcal, optional)",
    protein: "Daily protein target (g, optional)",
    optionalPlaceholder: "Optional",
    reviewTitle: "Your starting plan, ready for review.",
    reviewHelp:
      "Training uses your time, equipment and a fixed template. No AI is being called. Once you have actual records, you choose any adjustments.",
    goalLabel: "Current focus",
    trainingLabel: "Weekly training",
    sleepLabel: "Planned sleep",
    nutritionLabel: "Nutrition goals",
    noTarget: "Not set yet. Start by recording.",
    dayUnit: "days",
    minuteUnit: "min / session",
    hourUnit: "hours / night",
    templateTitle: "Training template",
    templateGym:
      "Full-body basics: squat, push, pull and core, fitted to your available time. You choose exercises and weights.",
    templateHome:
      "Home full-body training: squat, push, row and core, adapted to the equipment you have.",
    templateBodyweight:
      "Bodyweight basics: squat, wall or floor push, hip movement and core, with alternatives you can choose.",
    source: "Source: your answers and a fixed template",
    note: "Your answers support your own plan and records. Apple Health and third-party AI permissions will be explained separately when needed.",
    draft:
      "This device saves unfinished answers as a draft and clears them after confirmation.",
    draftUnavailable:
      "This browser cannot save the draft right now. You can still finish these steps.",
    trainingError:
      "Enter an available schedule of 1–7 days per week and 10–180 minutes per session.",
    sleepError: "Enter a planned sleep time between 4 and 12 hours.",
    nutritionError:
      "Optional targets must be numeric: energy 500–8000 kcal and protein 1–400 g. Leave them empty if unsure.",
    saveError:
      "Your plan could not be saved yet. Try again; your answers are still here.",
  },
};

interface Draft {
  step: number;
  name: string;
  goal: Profile["goal"];
  experience: Profile["experience"];
  trainingDays: string;
  timeMinutes: string;
  equipment: Profile["equipment"];
  allergies: string;
  restrictions: string;
  sleepGoal: string;
  calories: string;
  protein: string;
}
interface OnboardingProps extends FeatureProps {
  onComplete: () => void;
  draftKey?: string;
  accountName?: string;
}

function initialDraft(profile: Profile | null): Draft {
  return {
    step: 0,
    name: profile?.name ?? "",
    goal: profile?.goal ?? "performance",
    experience: profile?.experience ?? "new",
    trainingDays: String(profile?.trainingDays ?? 3),
    timeMinutes: String(profile?.timeMinutes ?? 45),
    equipment: profile?.equipment ?? "gym",
    allergies: profile?.allergies ?? "",
    restrictions: profile?.restrictions ?? "",
    sleepGoal: String(profile?.sleepGoal ?? 8),
    calories: "",
    protein: "",
  };
}
function readDraft(key: string, defaults: Draft): Draft {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!parsed || typeof parsed !== "object") return defaults;
    const d = parsed as Record<string, unknown>;
    const result = { ...defaults };
    for (const field of [
      "name",
      "trainingDays",
      "timeMinutes",
      "allergies",
      "restrictions",
      "sleepGoal",
      "calories",
      "protein",
    ] as const) {
      if (typeof d[field] === "string")
        result[field] = d[field].slice(0, field === "name" ? 60 : 500);
    }
    if (typeof d.step === "number" && Number.isInteger(d.step))
      result.step = Math.max(0, Math.min(5, d.step));
    if (
      d.goal === "performance" ||
      d.goal === "strength" ||
      d.goal === "habits"
    )
      result.goal = d.goal;
    if (d.experience === "new" || d.experience === "regular")
      result.experience = d.experience;
    if (
      d.equipment === "gym" ||
      d.equipment === "home" ||
      d.equipment === "bodyweight"
    )
      result.equipment = d.equipment;
    return result;
  } catch {
    return defaults;
  }
}
function validNumber(value: string, min: number, max: number, integer = false) {
  const number = Number(value);
  return (
    value.trim() !== "" &&
    Number.isFinite(number) &&
    number >= min &&
    number <= max &&
    (!integer || Number.isInteger(number))
  );
}

export function Onboarding({
  state,
  lang,
  save,
  notify,
  demo,
  onComplete,
  draftKey,
  accountName,
}: OnboardingProps) {
  const c = copy[lang];
  const key =
    draftKey ?? (demo ? "Forma-onboarding-demo" : "Forma-onboarding-auth");
  const [draft, setDraft] = useState<Draft>(() =>
    readDraft(key, initialDraft(state.profile)),
  );
  const [error, setError] = useState<
    "trainingError" | "sleepError" | "nutritionError" | "saveError" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [draftUnavailable, setDraftUnavailable] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      setDraftUnavailable(false);
    } catch {
      setDraftUnavailable(true);
    }
  }, [draft, key]);
  const patch = (next: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...next }));
    setError(null);
  };
  const validate = () => {
    if (
      !validNumber(draft.trainingDays, 1, 7, true) ||
      !validNumber(draft.timeMinutes, 10, 180, true)
    ) {
      setError("trainingError");
      return false;
    }
    if (!validNumber(draft.sleepGoal, 4, 12)) {
      setError("sleepError");
      return false;
    }
    if (
      (draft.calories.trim() &&
        !validNumber(draft.calories, 500, 8000, true)) ||
      (draft.protein.trim() && !validNumber(draft.protein, 1, 400))
    ) {
      setError("nutritionError");
      return false;
    }
    return true;
  };
  const next = () => {
    if (
      draft.step === 1 &&
      (!validNumber(draft.trainingDays, 1, 7, true) ||
        !validNumber(draft.timeMinutes, 10, 180, true))
    ) {
      setError("trainingError");
      return;
    }
    if (draft.step === 3 && !validNumber(draft.sleepGoal, 4, 12)) {
      setError("sleepError");
      return;
    }
    if (
      draft.step === 4 &&
      ((draft.calories.trim() &&
        !validNumber(draft.calories, 500, 8000, true)) ||
        (draft.protein.trim() && !validNumber(draft.protein, 1, 400)))
    ) {
      setError("nutritionError");
      return;
    }
    patch({ step: Math.min(5, draft.step + 1) });
  };
  const skip = () => {
    if (draft.step === 2) patch({ allergies: "", restrictions: "", step: 3 });
    if (draft.step === 3) patch({ sleepGoal: "8", step: 4 });
    if (draft.step === 4) patch({ calories: "", protein: "", step: 5 });
  };
  const submit = async () => {
    if (busy || !validate()) return;
    setBusy(true);
    let timezone = state.profile?.timezone ?? "UTC";
    try {
      timezone =
        state.profile?.timezone ??
        Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      /* Keep UTC fallback. */
    }
    const profile: Profile = {
      name: draft.name.trim() || accountName?.trim() || "Forma user",
      goal: draft.goal,
      experience: draft.experience,
      trainingDays: Number(draft.trainingDays),
      timeMinutes: Number(draft.timeMinutes),
      equipment: draft.equipment,
      allergies: draft.allergies.trim(),
      restrictions: draft.restrictions.trim(),
      language: lang,
      units: state.profile?.units ?? "metric",
      timezone,
      sleepGoal: Number(draft.sleepGoal),
      cloudConsent: state.profile?.cloudConsent ?? false,
      aiConsent: state.profile?.aiConsent ?? false,
    };
    const plan: PlanVersion = {
      id: uid(),
      parentId: currentPlan(state)?.id ?? null,
      createdAt: new Date().toISOString(),
      reason: "onboarding.initial",
      trainingMinutes: profile.timeMinutes,
      trainingDays: profile.trainingDays,
      sleepHours: profile.sleepGoal,
      calorieTarget: draft.calories.trim() ? Number(draft.calories) : null,
      proteinTarget: draft.protein.trim() ? Number(draft.protein) : null,
    };
    try {
      await save({
        ...state,
        profile,
        planVersions: [...state.planVersions, plan],
        currentPlanId: plan.id,
      });
      try {
        localStorage.removeItem(key);
      } catch {
        /* A draft cleanup failure does not undo a saved plan. */
      }
      notify(copy.zh.saved, copy.en.saved);
      onComplete();
    } catch {
      setError("saveError");
    } finally {
      setBusy(false);
    }
  };
  const template =
    draft.equipment === "gym"
      ? c.templateGym
      : draft.equipment === "home"
        ? c.templateHome
        : c.templateBodyweight;
  const number = (value: string) =>
    new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
      maximumFractionDigits: 1,
    }).format(Number(value));

  return (
    <div className="stack">
      <header className="page-heading">
        <div>
          <h1>{c.title}</h1>
          <p className="page-subtitle">{c.subtitle}</p>
        </div>
      </header>
      <section
        className="panel onboarding-panel"
        aria-labelledby="onboarding-title"
      >
        <div className="onboarding-progress">
          <span className="badge">{draft.step + 1} / 6</span>
          <span className="muted">{c.steps[draft.step]}</span>
        </div>
        <progress
          value={draft.step + 1}
          max={6}
          aria-label={lang === "zh" ? "问卷进度" : "Questionnaire progress"}
          style={{
            width: "100%",
            accentColor: "#9fcf58",
            height: 6,
            margin: "18px 0 30px",
          }}
        />
        {draft.step === 0 && (
          <div className="stack">
            <div>
              <h2 id="onboarding-title" className="section-title">
                {c.goalTitle}
              </h2>
              <p className="hint">{c.goalHelp}</p>
            </div>
            {(
              [
                ["performance", Sparkles],
                ["strength", Dumbbell],
                ["habits", Heart],
              ] as const
            ).map(([goal, Icon]) => (
              <button
                type="button"
                key={goal}
                className={`record-row goal-option ${draft.goal === goal ? "selected" : ""}`}
                aria-pressed={draft.goal === goal}
                onClick={() => patch({ goal })}
              >
                <Icon size={24} aria-hidden="true" />
                <span className="row-main">
                  <strong>{c[goal]}</strong>
                  <span className="muted">{c[`${goal}Help`]}</span>
                </span>
                {draft.goal === goal && <Check size={20} aria-hidden="true" />}
              </button>
            ))}
            <label className="field">
              {c.name}
              <input
                className="input"
                value={draft.name}
                maxLength={60}
                autoComplete="given-name"
                onChange={(e) => patch({ name: e.target.value })}
                placeholder={c.namePlaceholder}
              />
            </label>
          </div>
        )}
        {draft.step === 1 && (
          <div className="stack">
            <div>
              <h2 id="onboarding-title" className="section-title">
                {c.trainingTitle}
              </h2>
              <p className="hint">{c.trainingHelp}</p>
            </div>
            <label className="field">
              {c.experience}
              <select
                className="input"
                value={draft.experience}
                onChange={(e) =>
                  patch({ experience: e.target.value as Draft["experience"] })
                }
              >
                <option value="new">{c.new}</option>
                <option value="regular">{c.regular}</option>
              </select>
            </label>
            <div className="form-grid">
              <label className="field">
                {c.days}
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={7}
                  step={1}
                  value={draft.trainingDays}
                  onChange={(e) => patch({ trainingDays: e.target.value })}
                />
              </label>
              <label className="field">
                {c.minutes}
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={180}
                  step={5}
                  value={draft.timeMinutes}
                  onChange={(e) => patch({ timeMinutes: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              {c.equipment}
              <select
                className="input"
                value={draft.equipment}
                onChange={(e) =>
                  patch({ equipment: e.target.value as Draft["equipment"] })
                }
              >
                <option value="gym">{c.gym}</option>
                <option value="home">{c.home}</option>
                <option value="bodyweight">{c.bodyweight}</option>
              </select>
            </label>
          </div>
        )}
        {draft.step === 2 && (
          <div className="stack">
            <div>
              <h2 id="onboarding-title" className="section-title">
                {c.foodTitle}
              </h2>
              <p className="hint">{c.foodHelp}</p>
            </div>
            <label className="field">
              {c.allergies}
              <input
                className="input"
                maxLength={500}
                value={draft.allergies}
                placeholder={c.allergyPlaceholder}
                onChange={(e) => patch({ allergies: e.target.value })}
              />
            </label>
            <label className="field">
              {c.restrictions}
              <textarea
                className="input"
                rows={4}
                maxLength={500}
                value={draft.restrictions}
                placeholder={c.restrictionPlaceholder}
                onChange={(e) => patch({ restrictions: e.target.value })}
              />
            </label>
          </div>
        )}
        {draft.step === 3 && (
          <div className="stack">
            <div>
              <h2 id="onboarding-title" className="section-title">
                {c.sleepTitle}
              </h2>
              <p className="hint">{c.sleepHelp}</p>
            </div>
            <label className="field">
              {c.sleepGoal}
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min={4}
                max={12}
                step={0.5}
                value={draft.sleepGoal}
                onChange={(e) => patch({ sleepGoal: e.target.value })}
              />
            </label>
            <div className="panel">
              <h3 className="section-title">{c.restState}</h3>
              <p className="hint">{c.restHelp}</p>
            </div>
          </div>
        )}
        {draft.step === 4 && (
          <div className="stack">
            <div>
              <h2 id="onboarding-title" className="section-title">
                {c.nutritionTitle}
              </h2>
              <p className="hint">{c.nutritionHelp}</p>
            </div>
            <div className="form-grid">
              <label className="field">
                {c.calories}
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={500}
                  max={8000}
                  value={draft.calories}
                  placeholder={c.optionalPlaceholder}
                  onChange={(e) => patch({ calories: e.target.value })}
                />
              </label>
              <label className="field">
                {c.protein}
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={400}
                  value={draft.protein}
                  placeholder={c.optionalPlaceholder}
                  onChange={(e) => patch({ protein: e.target.value })}
                />
              </label>
            </div>
          </div>
        )}
        {draft.step === 5 && (
          <div className="stack">
            <div>
              <h2 id="onboarding-title" className="section-title">
                {c.reviewTitle}
              </h2>
              <p className="hint">{c.reviewHelp}</p>
            </div>
            <div className="form-grid">
              <div className="panel">
                <span className="muted">{c.goalLabel}</span>
                <p className="stat-value" style={{ fontSize: 22 }}>
                  {c[draft.goal]}
                </p>
              </div>
              <div className="panel">
                <span className="muted">{c.trainingLabel}</span>
                <p>
                  <strong>
                    {number(draft.trainingDays)} {c.dayUnit}
                  </strong>{" "}
                  · {number(draft.timeMinutes)} {c.minuteUnit}
                </p>
              </div>
              <div className="panel">
                <span className="muted">{c.sleepLabel}</span>
                <p>
                  <strong>
                    {number(draft.sleepGoal)} {c.hourUnit}
                  </strong>
                </p>
              </div>
              <div className="panel">
                <span className="muted">{c.nutritionLabel}</span>
                <p>
                  {!draft.calories.trim() && !draft.protein.trim()
                    ? c.noTarget
                    : [
                        draft.calories.trim()
                          ? `${number(draft.calories)} kcal`
                          : "",
                        draft.protein.trim()
                          ? `${number(draft.protein)} g ${lang === "zh" ? "蛋白质" : "protein"}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
              </div>
            </div>
            <div className="panel">
              <h3 className="section-title">{c.templateTitle}</h3>
              <p>{template}</p>
              <span className="badge">{c.source}</span>
            </div>
            {(draft.allergies.trim() || draft.restrictions.trim()) && (
              <div>
                <p className="hint">
                  {c.allergies}: {draft.allergies.trim() || "—"}
                </p>
                <p className="hint" style={{ whiteSpace: "pre-wrap" }}>
                  {c.restrictions}: {draft.restrictions.trim() || "—"}
                </p>
              </div>
            )}
            <p className="hint">{c.note}</p>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {c[error]}
          </p>
        )}
        <div
          className="row-actions"
          style={{ justifyContent: "space-between", marginTop: 32 }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => patch({ step: draft.step - 1 })}
            disabled={busy || draft.step === 0}
          >
            <ArrowLeft size={16} />
            {c.back}
          </button>
          <div className="row-actions">
            {draft.step >= 2 && draft.step <= 4 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={skip}
                disabled={busy}
              >
                {c.skip}
              </button>
            )}
            {draft.step === 5 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={submit}
                disabled={busy}
              >
                {busy ? c.saving : c.confirm}
                <Check size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={next}
                disabled={busy}
              >
                {c.next}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
        <p className="hint" style={{ marginTop: 20 }}>
          {draftUnavailable ? c.draftUnavailable : c.draft}
        </p>
      </section>
    </div>
  );
}

export default Onboarding;
