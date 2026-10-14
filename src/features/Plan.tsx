import { useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  History,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
import { Modal } from "../components/Modal";
import { currentPlan, uid } from "../types";
import type { AppState, FeatureProps, PlanVersion, Suggestion } from "../types";

const copy = {
  zh: {
    title: "你的计划，由你掌握。",
    subtitle: "查看参数、调整安排，留下每一次选择的理由。",
    current: "当前计划",
    edit: "编辑计划",
    source: "来源：你的设置与固定模板",
    sourceHelp:
      "当前安排不调用 AI。训练模板是起点，动作和负重仍由你选择；营养目标仅采用你自行填写的数值。",
    trainingDays: "每周训练天数",
    trainingMinutes: "每次训练时间",
    sleepHours: "计划睡眠时间",
    calorieTarget: "能量目标",
    proteinTarget: "蛋白质目标",
    days: "天 / 周",
    minutes: "分钟 / 次",
    hours: "小时 / 晚",
    unset: "暂未设置",
    editTitle: "调整你的计划",
    editDescription: "修改后会保存新版本。历史计划与实际记录会保留。",
    caloriesLabel: "每日能量目标（kcal，可选）",
    proteinLabel: "每日蛋白质目标（g，可选）",
    optional: "留空即取消目标",
    save: "保存新版本",
    cancel: "取消",
    saving: "保存中…",
    editError:
      "请填写有效值：训练 1–7 天、10–180 分钟，睡眠 4–12 小时；可选营养目标须为数值（能量 500–8000 kcal，蛋白质 1–400 g）。",
    changedElsewhere: "当前计划已更新。请关闭后重新查看，再确认调整。",
    failed: "未能保存，请重试。当前计划没有改变。",
    noChanges: "没有需要保存的变化。",
    adjustmentTitle: "生活变了，安排也可以变。",
    adjustmentHelp:
      "你可以主动缩短每次训练。确认后，今后的训练会使用新目标，直到再次编辑或撤销。",
    limited: "我想缩短每次训练",
    alreadyShort: "当前已经是 30 分钟或更短，可以直接编辑适合自己的安排。",
    candidate: "待确认的调整",
    reason: "调整原因",
    limitedReason:
      "你主动选择缩短训练。将每次训练目标改为 30 分钟，保留原有训练天数与其他目标；今后的安排也会采用这一目标，可以撤销。",
    candidateSource: "来源：你的操作与固定调整规则；没有调用 AI。",
    before: "调整前",
    after: "调整后",
    accept: "接受调整",
    reject: "暂不调整",
    undo: "撤销这次调整",
    stale: "此调整基于旧计划。请暂不采用，并基于当前版本重新提出调整。",
    accepted: "已接受",
    undone: "已撤销",
    rejected: "未采用",
    proposed: "待确认",
    review: "查看差异",
    undoHelp:
      "只能撤销当前仍在使用的已接受调整。之后已有新版本时，请通过编辑选择新的安排。",
    history: "计划版本",
    version: "版本",
    active: "正在使用",
    initialReason: "初始计划由你确认",
    editReason: "你主动修改了计划参数",
    undoReason: "恢复调整前的参数，保留版本历史",
    saved: "新计划已保存。",
    proposedSaved: "调整已准备好，请先查看差异。",
    acceptedSaved: "调整已接受。",
    rejectedSaved: "已保留原计划。",
    undoneSaved: "已恢复调整前的参数。",
    noPlan: "先完成引导，建立属于你的起始计划。",
    noSuggestions: "目前没有待审核的调整。",
    note: "计划目标与实际记录分别保存；修改目标不会改变历史摄入、训练或睡眠。",
  },
  en: {
    title: "Your plan stays in your hands.",
    subtitle:
      "Review your settings, change the schedule and keep a reason for every choice.",
    current: "Current plan",
    edit: "Edit plan",
    source: "Source: your settings and a fixed template",
    sourceHelp:
      "This plan does not call AI. The training template is a starting point; you choose exercises and weights. Nutrition targets only use values you entered.",
    trainingDays: "Training days per week",
    trainingMinutes: "Time per session",
    sleepHours: "Planned sleep time",
    calorieTarget: "Energy target",
    proteinTarget: "Protein target",
    days: "days / week",
    minutes: "min / session",
    hours: "hours / night",
    unset: "Not set",
    editTitle: "Adjust your plan",
    editDescription:
      "Changes create a new version. Earlier plans and actual records are kept.",
    caloriesLabel: "Daily energy target (kcal, optional)",
    proteinLabel: "Daily protein target (g, optional)",
    optional: "Leave empty to remove a target",
    save: "Save new version",
    cancel: "Cancel",
    saving: "Saving…",
    editError:
      "Enter valid values: 1–7 training days, 10–180 minutes and 4–12 sleep hours. Optional nutrition targets must be numeric (energy 500–8000 kcal, protein 1–400 g).",
    changedElsewhere:
      "The current plan has changed. Close this review and check the latest version before confirming.",
    failed: "Could not save. Try again; your current plan has not changed.",
    noChanges: "There are no changes to save.",
    adjustmentTitle: "Make room for a change of plans.",
    adjustmentHelp:
      "Choose shorter sessions and review the difference. After confirmation, future sessions use this target until you edit it or undo the change.",
    limited: "I want shorter training sessions",
    alreadyShort:
      "Your session is already 30 minutes or shorter. Edit the plan to choose another schedule.",
    candidate: "An adjustment to review",
    reason: "Why this adjustment",
    limitedReason:
      "You chose shorter training. This changes every session target to 30 minutes and keeps your training days and other targets. Future sessions use this target, and you can undo it.",
    candidateSource:
      "Source: your action and a fixed adjustment rule. No AI is being called.",
    before: "Before",
    after: "After",
    accept: "Accept adjustment",
    reject: "Keep my current plan",
    undo: "Undo this adjustment",
    stale:
      "This adjustment uses an older plan. Keep it unapplied and propose a new one from the current version.",
    accepted: "Accepted",
    undone: "Undone",
    rejected: "Not used",
    proposed: "Needs review",
    review: "Review changes",
    undoHelp:
      "Only an accepted adjustment still in use can be undone. If there is a later version, edit the plan to choose a new schedule.",
    history: "Plan versions",
    version: "Version",
    active: "In use",
    initialReason: "You confirmed your starting plan",
    editReason: "You changed your plan settings",
    undoReason: "Restored the earlier settings and kept the version history",
    saved: "Your new plan has been saved.",
    proposedSaved: "Your adjustment is ready to review.",
    acceptedSaved: "Adjustment accepted.",
    rejectedSaved: "Your original plan is kept.",
    undoneSaved: "The settings before the adjustment have been restored.",
    noPlan: "Complete the introduction to create your starting plan.",
    noSuggestions: "There are no adjustments waiting for review.",
    note: "Targets and actual records are separate. Changing a target does not change earlier meals, training or sleep.",
  },
};
type EditableField =
  | "trainingMinutes"
  | "trainingDays"
  | "sleepHours"
  | "calorieTarget"
  | "proteinTarget";
type EditValues = Record<EditableField, string>;
type ErrorKey = "editError" | "changedElsewhere" | "failed" | "noChanges";

function profileForPlan(state: AppState, plan: PlanVersion) {
  return state.profile
    ? {
        ...state.profile,
        trainingDays: plan.trainingDays,
        timeMinutes: plan.trainingMinutes,
        sleepGoal: plan.sleepHours,
      }
    : null;
}
function inRange(value: string, min: number, max: number, integer = false) {
  const n = Number(value);
  return (
    value.trim() !== "" &&
    Number.isFinite(n) &&
    n >= min &&
    n <= max &&
    (!integer || Number.isInteger(n))
  );
}

export function Plan({ state, lang, save, notify }: FeatureProps) {
  const c = copy[lang];
  const plan = currentPlan(state);
  const [editor, setEditor] = useState<{
    baseId: string;
    values: EditValues;
  } | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const numeric = (value: number) =>
    new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
      maximumFractionDigits: 1,
    }).format(value);
  const date = (value: string) =>
    new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: state.profile?.timezone ?? "UTC",
    }).format(new Date(value));
  const reason = (code: string) =>
    code === "onboarding.initial"
      ? c.initialReason
      : code === "plan.user_edit"
        ? c.editReason
        : code === "suggestion.time_limited"
          ? c.limitedReason
          : code === "suggestion.undo"
            ? c.undoReason
            : code;
  const reviewed = state.suggestions.find((item) => item.id === reviewId);
  const reviewedBase =
    reviewed &&
    state.planVersions.find((item) => item.id === reviewed.baseVersionId);
  const proposed = state.suggestions.filter(
    (item) => item.status === "proposed",
  );
  const latestAccepted = [...state.suggestions]
    .reverse()
    .find((item) => item.status === "accepted");
  const canUndo = latestAccepted?.acceptedVersionId === plan?.id;
  const openEdit = () => {
    if (!plan) return;
    setError(null);
    setEditor({
      baseId: plan.id,
      values: {
        trainingMinutes: String(plan.trainingMinutes),
        trainingDays: String(plan.trainingDays),
        sleepHours: String(plan.sleepHours),
        calorieTarget:
          plan.calorieTarget === null ? "" : String(plan.calorieTarget),
        proteinTarget:
          plan.proteinTarget === null ? "" : String(plan.proteinTarget),
      },
    });
  };
  const saveEdit = async () => {
    if (!editor || !plan || busy) return;
    if (editor.baseId !== plan.id) {
      setError("changedElsewhere");
      return;
    }
    const v = editor.values;
    if (
      !inRange(v.trainingMinutes, 10, 180, true) ||
      !inRange(v.trainingDays, 1, 7, true) ||
      !inRange(v.sleepHours, 4, 12) ||
      (v.calorieTarget.trim() && !inRange(v.calorieTarget, 500, 8000, true)) ||
      (v.proteinTarget.trim() && !inRange(v.proteinTarget, 1, 400))
    ) {
      setError("editError");
      return;
    }
    const values = {
      trainingMinutes: Number(v.trainingMinutes),
      trainingDays: Number(v.trainingDays),
      sleepHours: Number(v.sleepHours),
      calorieTarget: v.calorieTarget.trim() ? Number(v.calorieTarget) : null,
      proteinTarget: v.proteinTarget.trim() ? Number(v.proteinTarget) : null,
    };
    if (
      (Object.keys(values) as EditableField[]).every(
        (field) => values[field] === plan[field],
      )
    ) {
      setError("noChanges");
      return;
    }
    const next: PlanVersion = {
      ...plan,
      ...values,
      id: uid(),
      parentId: plan.id,
      createdAt: new Date().toISOString(),
      reason: "plan.user_edit",
    };
    setBusy(true);
    setError(null);
    try {
      await save({
        ...state,
        profile: profileForPlan(state, next),
        planVersions: [...state.planVersions, next],
        currentPlanId: next.id,
      });
      setEditor(null);
      notify(copy.zh.saved, copy.en.saved);
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  };
  const propose = async () => {
    if (!plan || busy || plan.trainingMinutes <= 30) return;
    const existing = proposed.find(
      (item) =>
        item.baseVersionId === plan.id &&
        item.reason === "suggestion.time_limited",
    );
    if (existing) {
      setReviewId(existing.id);
      setError(null);
      return;
    }
    const suggestion: Suggestion = {
      id: uid(),
      baseVersionId: plan.id,
      createdAt: new Date().toISOString(),
      reason: "suggestion.time_limited",
      status: "proposed",
      patch: { trainingMinutes: 30 },
    };
    setBusy(true);
    setError(null);
    try {
      await save({ ...state, suggestions: [...state.suggestions, suggestion] });
      setReviewId(suggestion.id);
      notify(copy.zh.proposedSaved, copy.en.proposedSaved);
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  };
  const decide = async (item: Suggestion, accept: boolean) => {
    if (!plan || busy || item.status !== "proposed") return;
    if (accept && plan.id !== item.baseVersionId) {
      setError("changedElsewhere");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (accept) {
        const next: PlanVersion = {
          ...plan,
          ...item.patch,
          id: uid(),
          parentId: plan.id,
          createdAt: new Date().toISOString(),
          reason: item.reason,
        };
        await save({
          ...state,
          profile: profileForPlan(state, next),
          planVersions: [...state.planVersions, next],
          currentPlanId: next.id,
          suggestions: state.suggestions.map((s) =>
            s.id === item.id
              ? { ...s, status: "accepted", acceptedVersionId: next.id }
              : s,
          ),
        });
        notify(copy.zh.acceptedSaved, copy.en.acceptedSaved);
      } else {
        await save({
          ...state,
          suggestions: state.suggestions.map((s) =>
            s.id === item.id ? { ...s, status: "rejected" } : s,
          ),
        });
        notify(copy.zh.rejectedSaved, copy.en.rejectedSaved);
      }
      setReviewId(null);
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  };
  const undo = async () => {
    if (
      !plan ||
      !latestAccepted ||
      busy ||
      latestAccepted.acceptedVersionId !== plan.id
    )
      return;
    const parent = state.planVersions.find(
      (p) => p.id === latestAccepted.baseVersionId,
    );
    if (!parent) {
      setError("changedElsewhere");
      return;
    }
    const restored: PlanVersion = {
      ...parent,
      id: uid(),
      parentId: plan.id,
      createdAt: new Date().toISOString(),
      reason: "suggestion.undo",
    };
    setBusy(true);
    setError(null);
    try {
      await save({
        ...state,
        profile: profileForPlan(state, restored),
        planVersions: [...state.planVersions, restored],
        currentPlanId: restored.id,
        suggestions: state.suggestions.map((s) =>
          s.id === latestAccepted.id ? { ...s, status: "undone" } : s,
        ),
      });
      notify(copy.zh.undoneSaved, copy.en.undoneSaved);
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  };
  if (!plan)
    return (
      <div className="stack">
        <header className="page-heading">
          <div>
            <h1>{c.title}</h1>
            <p className="page-subtitle">{c.subtitle}</p>
          </div>
        </header>
        <section className="panel empty-state">
          <Clock3 size={32} />
          <p>{c.noPlan}</p>
        </section>
      </div>
    );

  return (
    <div className="stack">
      <header className="page-heading">
        <div>
          <h1>{c.title}</h1>
          <p className="page-subtitle">{c.subtitle}</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={openEdit}
          disabled={busy}
        >
          <Pencil size={16} />
          {c.edit}
        </button>
      </header>
      <section className="panel">
        <h2 className="section-title">{c.current}</h2>
        <div className="form-grid three" style={{ marginTop: 20 }}>
          {(
            [
              ["trainingDays", c.days],
              ["trainingMinutes", c.minutes],
              ["sleepHours", c.hours],
            ] as const
          ).map(([field, unit]) => (
            <div key={field}>
              <span className="muted">{c[field]}</span>
              <p className="stat-value">
                {numeric(plan[field])}
                <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>
                  {unit}
                </span>
              </p>
            </div>
          ))}
        </div>
        <div className="form-grid" style={{ marginTop: 16 }}>
          {(
            [
              ["calorieTarget", "kcal"],
              ["proteinTarget", "g"],
            ] as const
          ).map(([field, unit]) => (
            <div key={field}>
              <span className="muted">{c[field]}</span>
              <p>
                <strong>
                  {plan[field] === null
                    ? c.unset
                    : `${numeric(plan[field]!)} ${unit}`}
                </strong>
              </p>
            </div>
          ))}
        </div>
        <span className="badge">{c.source}</span>
        <p className="hint" style={{ marginTop: 14 }}>
          {c.sourceHelp}
        </p>
      </section>
      <section className="panel">
        <div className="page-heading">
          <div>
            <h2 className="section-title">{c.adjustmentTitle}</h2>
            <p className="hint">{c.adjustmentHelp}</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={propose}
            disabled={busy || plan.trainingMinutes <= 30}
          >
            <Clock3 size={17} />
            {c.limited}
          </button>
        </div>
        {plan.trainingMinutes <= 30 && <p className="hint">{c.alreadyShort}</p>}
        {proposed.length > 0 ? (
          <div className="stack" style={{ marginTop: 16 }}>
            {proposed.map((item) => (
              <div className="record-row" key={item.id}>
                <div className="row-main">
                  <strong>{c.candidate}</strong>
                  <span className="muted">
                    {item.baseVersionId === plan.id ? c.limitedReason : c.stale}
                  </span>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setReviewId(item.id);
                    setError(null);
                  }}
                  disabled={busy}
                >
                  {c.review}
                  <ArrowRight size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">{c.noSuggestions}</p>
        )}
        {latestAccepted && (
          <div className="record-row" style={{ marginTop: 16 }}>
            <div className="row-main">
              <strong>{c.accepted}</strong>
              <span className="muted">
                {canUndo ? c.limitedReason : c.undoHelp}
              </span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={undo}
              disabled={busy || !canUndo}
              title={!canUndo ? c.undoHelp : undefined}
            >
              <RotateCcw size={16} />
              {c.undo}
            </button>
          </div>
        )}
        {error && !editor && !reviewId && (
          <p className="form-error" role="alert">
            {c[error]}
          </p>
        )}
      </section>
      <section className="panel">
        <div
          className="row-actions"
          style={{ justifyContent: "flex-start", marginBottom: 16 }}
        >
          <History size={19} />
          <h2 className="section-title" style={{ margin: 0 }}>
            {c.history}
          </h2>
        </div>
        <div className="stack">
          {[...state.planVersions].reverse().map((item) => (
            <div className="record-row" key={item.id}>
              <div className="row-main">
                <strong>
                  {c.version}{" "}
                  {state.planVersions.findIndex((p) => p.id === item.id) + 1} ·{" "}
                  {reason(item.reason)}
                </strong>
                <span className="muted">
                  {date(item.createdAt)} · {numeric(item.trainingDays)} {c.days}{" "}
                  · {numeric(item.trainingMinutes)} {c.minutes} ·{" "}
                  {numeric(item.sleepHours)} {c.hours}
                </span>
              </div>
              {item.id === plan.id && <span className="badge">{c.active}</span>}
            </div>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 18 }}>
          {c.note}
        </p>
      </section>
      {editor && (
        <Modal
          title={c.editTitle}
          description={c.editDescription}
          onClose={() => {
            if (!busy) {
              setEditor(null);
              setError(null);
            }
          }}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setEditor(null);
                  setError(null);
                }}
                disabled={busy}
              >
                {c.cancel}
              </button>
              <button
                className="btn btn-primary"
                onClick={saveEdit}
                disabled={busy}
              >
                {busy ? c.saving : c.save}
              </button>
            </>
          }
        >
          <div className="stack">
            <div className="form-grid three">
              {(["trainingDays", "trainingMinutes", "sleepHours"] as const).map(
                (field) => (
                  <label className="field" key={field}>
                    {c[field]}
                    <input
                      className="input"
                      type="number"
                      inputMode={field === "sleepHours" ? "decimal" : "numeric"}
                      value={editor.values[field]}
                      min={
                        field === "trainingDays"
                          ? 1
                          : field === "trainingMinutes"
                            ? 10
                            : 4
                      }
                      max={
                        field === "trainingDays"
                          ? 7
                          : field === "trainingMinutes"
                            ? 180
                            : 12
                      }
                      step={field === "sleepHours" ? 0.5 : 1}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditor((v) =>
                          v
                            ? { ...v, values: { ...v.values, [field]: value } }
                            : null,
                        );
                        setError(null);
                      }}
                    />
                  </label>
                ),
              )}
            </div>
            <div className="form-grid">
              {(
                [
                  ["calorieTarget", c.caloriesLabel],
                  ["proteinTarget", c.proteinLabel],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="field">
                  {label}
                  <input
                    className="input"
                    type="number"
                    inputMode="decimal"
                    min={field === "calorieTarget" ? 500 : 1}
                    max={field === "calorieTarget" ? 8000 : 400}
                    value={editor.values[field]}
                    placeholder={c.optional}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditor((v) =>
                        v
                          ? { ...v, values: { ...v.values, [field]: value } }
                          : null,
                      );
                      setError(null);
                    }}
                  />
                </label>
              ))}
            </div>
            {error && (
              <p className="form-error" role="alert">
                {c[error]}
              </p>
            )}
          </div>
        </Modal>
      )}
      {reviewed && reviewedBase && (
        <Modal
          title={c.candidate}
          description={c.candidateSource}
          onClose={() => {
            if (!busy) {
              setReviewId(null);
              setError(null);
            }
          }}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => decide(reviewed, false)}
                disabled={busy || reviewed.status !== "proposed"}
              >
                <X size={15} />
                {c.reject}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => decide(reviewed, true)}
                disabled={
                  busy ||
                  reviewed.status !== "proposed" ||
                  reviewed.baseVersionId !== plan.id
                }
              >
                <Check size={15} />
                {busy ? c.saving : c.accept}
              </button>
            </>
          }
        >
          <div className="stack">
            <div>
              <h3 className="section-title">{c.reason}</h3>
              <p>{reason(reviewed.reason)}</p>
            </div>
            {(
              Object.keys(reviewed.patch) as (
                "trainingMinutes" | "trainingDays" | "sleepHours"
              )[]
            ).map((field) => (
              <div className="panel" key={field}>
                <h3 className="section-title">{c[field]}</h3>
                <div
                  className="row-actions"
                  style={{ justifyContent: "space-between", marginTop: 16 }}
                >
                  <div>
                    <span className="muted">{c.before}</span>
                    <p className="stat-value">{numeric(reviewedBase[field])}</p>
                  </div>
                  <ArrowRight size={24} />
                  <div>
                    <span className="muted">{c.after}</span>
                    <p className="stat-value">
                      {numeric(reviewed.patch[field]!)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {reviewed.baseVersionId !== plan.id && (
              <p className="hint">{c.stale}</p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {c[error]}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Plan;
