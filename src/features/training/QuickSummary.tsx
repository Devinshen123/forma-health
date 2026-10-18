import { useState, useRef, useEffect, type FormEvent } from "react";
import {
  ArrowLeftRight,
  Dumbbell,
  Pencil,
  Plus,
  Timer,
  Trash2,
} from "lucide-react";
import { Modal } from "../../components/Modal";
import { RecordDraft } from "../recordDraft";
import {
  localDate,
  uid,
  type Exercise,
  type FeatureProps,
  type Workout,
} from "../../types";

type ExerciseDraft = {
  original?: Exercise;
  key: string;
  name: string;
  sets: string;
  reps: string;
  weight: string;
};
type WorkoutDraft = {
  id: string;
  existing: boolean;
  date: string;
  name: string;
  duration: string;
  rpe: string;
  exercises: ExerciseDraft[];
  notes: string;
  createdAt: string;
  loadUnit: "kg" | "lb";
};
const KG_TO_LB = 2.2046226218487757;
const newExercise = (): ExerciseDraft => ({
  key: uid(),
  name: "",
  sets: "3",
  reps: "10",
  weight: "",
});
const alternatives = [
  {
    zh: "深蹲 → 箱式深蹲",
    en: "Squat → Box squat",
    detailZh:
      "需要固定深度时，可选择稳固的箱子或长凳；记录实际完成的组数和次数。",
    detailEn:
      "For a consistent depth, use a stable box or bench. Log the sets and reps you actually completed.",
  },
  {
    zh: "俯卧撑 → 上斜俯卧撑",
    en: "Push-up → Incline push-up",
    detailZh:
      "双手撑在稳固的高处可改变难度。高度与次数写入备注，方便下次比较。",
    detailEn:
      "A stable elevated surface changes the difficulty. Note its height and your reps for the next session.",
  },
  {
    zh: "杠铃划船 → 单臂哑铃划船",
    en: "Barbell row → One-arm dumbbell row",
    detailZh: "器械不同时，可记录每侧次数与单只哑铃重量；替代动作不默认等量。",
    detailEn:
      "With different equipment, log reps per side and the weight of one dumbbell. Alternatives are not assumed equivalent.",
  },
];

export default function QuickSummary({ state, lang, save, notify }: FeatureProps) {
  const zh = lang === "zh"; const mounted = useRef(true); useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const imperial = state.profile?.units === "imperial";
  const weightUnit = imperial ? "lb" : "kg";
  const [date, setDate] = useState(localDate);
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [deleting, setDeleting] = useState<Workout | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editRecord = useRef<RecordDraft<Workout> | null>(null);
  const deleteRecord = useRef<RecordDraft<Workout> | null>(null);
  useEffect(() => { if(draft) editRecord.current?.observe(state.workouts.find(workout=>workout.id===draft.id)); }, [state.workouts,draft?.id]);
  const workouts = state.workouts
    .filter((workout) => workout.date === date && !workout.exercises.some((exercise) => exercise.setLogs !== undefined))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const minutes = workouts.reduce((sum, workout) => sum + workout.duration, 0);
  const sets = workouts.reduce(
    (sum, workout) =>
      sum +
      workout.exercises.reduce((total, exercise) => total + exercise.sets, 0),
    0,
  );
  const showWeight = (weight: number | null) => weight === null ? '—' :
    Math.round(weight * (imperial ? KG_TO_LB : 1) * 100) / 100;
  const open = (workout?: Workout) => {
    editRecord.current = new RecordDraft(workout);
    setError("");
    setDraft(
      workout
        ? {
            ...workout,
            existing: true,
            loadUnit: weightUnit,
            duration: String(workout.duration),
            rpe: workout.rpe === null ? "" : String(workout.rpe),
            exercises: workout.exercises.map((exercise) => ({
              original: exercise,
              key: uid(),
              name: exercise.name,
              sets: String(exercise.sets),
              reps: exercise.reps === null ? '' : String(exercise.reps),
              weight: exercise.weight === null ? '' : String(
                Math.round(
                  exercise.weight * (imperial ? KG_TO_LB : 1) * 100000,
                ) / 100000,
              ),
            })),
          }
        : {
            id: uid(),
            existing: false,
            loadUnit: weightUnit,
            createdAt: new Date().toISOString(),
            date,
            name: "",
            duration: "",
            rpe: "",
            exercises: [newExercise()],
            notes: "",
          },
    );
  };
  const close = () => {
    if (!busy) {
      setDraft(null);
      setError("");
    }
  };
  const patch = (change: Partial<WorkoutDraft>) =>
    setDraft((current) => (current ? { ...current, ...change } : null));
  const patchExercise = (key: string, change: Partial<ExerciseDraft>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            exercises: current.exercises.map((exercise) =>
              exercise.key === key ? { ...exercise, ...change } : exercise,
            ),
          }
        : null,
    );
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || busy) return;
    setError("");
    if (!editRecord.current?.canSave(state.workouts.find((workout) => workout.id === draft.id))) {
      setError(zh ? "记录已在另一处变化，请取消并重新打开核对。" : "This record changed elsewhere. Cancel and reopen to review it."); return;
    }
    const duration = Number(draft.duration),
      rpe = draft.rpe.trim() ? Number(draft.rpe) : null;
    const exercises = draft.exercises.map((exercise) => ({
      ...exercise.original,
      name: exercise.name.trim(),
      sets: Number(exercise.sets),
      reps: Number(exercise.reps),
      weight:
        Math.round(
          (Number(exercise.weight) / (draft.loadUnit === "lb" ? KG_TO_LB : 1)) * 1000000,
        ) / 1000000,
    }));
    if (
      !draft.name.trim() ||
      !draft.date ||
      !draft.duration.trim() ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 1440 ||
      (rpe !== null && (!Number.isFinite(rpe) || rpe < 1 || rpe > 10)) ||
      exercises.length < 1 ||
      exercises.length > 100 ||
      draft.exercises.some((exercise) => !exercise.weight.trim()) ||
      exercises.some(
        (exercise) =>
          !exercise.name ||
          !Number.isInteger(exercise.sets) ||
          exercise.sets < 1 ||
          exercise.sets > 100 ||
          !Number.isInteger(exercise.reps) ||
          exercise.reps < 1 ||
          exercise.reps > 1000 ||
          !Number.isFinite(exercise.weight) ||
          exercise.weight < 0 ||
          exercise.weight > 2000,
      )
    ) {
      setError(
        zh
          ? "请填写训练名称、1–1440 分钟、1–10 强度，以及至少一个完整动作。"
          : "Enter a session name, 1–1440 minutes, effort from 1–10, and at least one complete exercise.",
      );
      return;
    }
    setBusy(true);
    try {
      const workout: Workout = {
        ...(state.workouts.find((item) => item.id === draft.id) ?? {}),
        id: draft.id,
        date: draft.date,
        name: draft.name.trim(),
        duration,
        rpe,
        exercises,
        notes: draft.notes.trim(),
        createdAt: draft.createdAt,
      };
      editRecord.current.submittedValue(workout);
      await save({
        ...state,
        workouts: state.workouts.some((item) => item.id === workout.id)
          ? state.workouts.map((item) =>
              item.id === workout.id ? workout : item,
            )
          : [...state.workouts, workout],
      });
      if (!mounted.current) return;
      setDate(workout.date);
      setDraft(null);
      notify("训练已保存", "Training saved");
    } catch (cause) {
      if (!mounted.current) return;
      setError(
        (zh ? "保存失败：" : "Could not save: ") +
          (cause instanceof Error
            ? cause.message
            : zh
              ? "请重试。"
              : "Please try again."),
      );
      notify("训练未保存，请重试", "Training was not saved. Please try again.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const remove = async () => {
    if (!deleting || busy) return;
    if (!deleteRecord.current?.canSave(state.workouts.find(workout => workout.id === deleting.id))) {
      setError(zh ? "这条记录已在另一处变化，请先保留并重新核对后再删除。" : "This record changed elsewhere. Keep it and review the latest version before deleting.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      deleteRecord.current.submittedValue(undefined);
      await save({
        ...state,
        workouts: state.workouts.filter(
          (workout) => workout.id !== deleting.id,
        ),
      });
      setDeleting(null);
      notify("训练记录已删除", "Training deleted");
    } catch (cause) {
      if (!mounted.current) return;
      setError(
        (zh ? "删除失败：" : "Could not delete: ") +
          (cause instanceof Error
            ? cause.message
            : zh
              ? "请重试。"
              : "Please try again."),
      );
      notify("未能删除训练记录", "Could not delete training");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h2>{zh ? "快速汇总记录" : "Quick summary records"}</h2>
          <p className="page-subtitle">
            {zh
              ? "旧记录保留为汇总，不推断逐组完成情况。"
              : "Keep summary records without inventing individual completed sets."}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => open()}>
          <Plus size={18} />
          {zh ? "记录训练" : "Log training"}
        </button>
      </div>
      <div className="panel">
        <div className="section-title">
          <h2>{zh ? "当日训练" : "Daily training"}</h2>
          <label className="field">
            <span className="muted">{zh ? "日期" : "Date"}</span>
            <input
              className="input"
              type="date"
              value={date}
              onInput={(event) => setDate(event.currentTarget.value)}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>
        <div className="form-grid three">
          <div>
            <span className="muted">{zh ? "训练时间" : "Time trained"}</span>
            <div className="stat-value">
              {workouts.length ? minutes : "—"}{" "}
              <small>{zh ? "分钟" : "min"}</small>
            </div>
          </div>
          <div>
            <span className="muted">{zh ? "完成组数" : "Sets logged"}</span>
            <div className="stat-value">{workouts.length ? sets : "—"}</div>
          </div>
          <div>
            <span className="muted">{zh ? "训练次数" : "Sessions"}</span>
            <div className="stat-value">{workouts.length || "—"}</div>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="section-title">
          <h2>{zh ? "训练记录" : "Session history"}</h2>
          <span className="badge">{zh ? "手动录入" : "Manual entry"}</span>
        </div>
        {workouts.length ? (
          workouts.map((workout) => (
            <div key={workout.id} className="record-row">
              <div className="row-main">
                <strong>{workout.name}</strong>
                <p className="muted">
                  <Timer size={14} /> {workout.duration} {zh ? "分钟" : "min"} ·
                  RPE {workout.rpe ?? "—"}/10
                </p>
                {workout.exercises.map((exercise, index) => (
                  <p key={index}>
                    {exercise.name}{" "}
                    <span className="muted">
                      · {exercise.sets} × {exercise.reps ?? '—'} ·{" "}
                      {showWeight(exercise.weight)} {weightUnit}
                    </span>
                  </p>
                ))}
                {workout.notes ? (
                  <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
                    {workout.notes}
                  </p>
                ) : null}
              </div>
              <div className="row-actions">
                <button
                  className="icon-button"
                  aria-label={(zh ? "编辑 " : "Edit ") + workout.name}
                  disabled={busy}
                  onClick={() => open(workout)}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label={(zh ? "删除 " : "Delete ") + workout.name}
                  disabled={busy}
                  onClick={() => {
                    deleteRecord.current = new RecordDraft(workout);
                    setDeleting(workout);
                    setError("");
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <Dumbbell size={32} />
            <h3>{zh ? "从今天的训练开始" : "Start with today’s training"}</h3>
            <p>
              {zh
                ? "记录动作、组数、次数和你的主观强度。"
                : "Log exercises, sets, reps and your perceived effort."}
            </p>
            <button className="btn btn-secondary" onClick={() => open()}>
              {zh ? "添加训练记录" : "Add a session"}
            </button>
          </div>
        )}
      </div>
      <div className="panel">
        <div className="section-title">
          <h2>
            <ArrowLeftRight size={18} />{" "}
            {zh ? "动作替代参考" : "Exercise alternatives"}
          </h2>
        </div>
        <p className="hint">
          {zh
            ? "替代后记录实际动作与负重，不默认训练量相同。"
            : "Log the actual exercise and load. Alternatives do not imply equal training volume."}
        </p>
        {alternatives.map((item) => (
          <details
            key={item.en}
            style={{ padding: "14px 0", borderTop: "1px solid #e9ecf0" }}
          >
            <summary>{zh ? item.zh : item.en}</summary>
            <p className="muted">{zh ? item.detailZh : item.detailEn}</p>
          </details>
        ))}
      </div>
      {draft ? (
        <Modal
          title={
            draft.existing
              ? zh
                ? "编辑训练"
                : "Edit training"
              : zh
                ? "记录训练"
                : "Log training"
          }
          description={
            zh
              ? "记录你实际完成的训练。重量按当前单位输入。"
              : "Record the training you completed. Enter loads in your selected unit."
          }
          onClose={close}
          footer={
            <>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={close}
              >
                {zh ? "取消" : "Cancel"}
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                form="training-form"
                disabled={busy}
              >
                {busy
                  ? zh
                    ? "保存中…"
                    : "Saving…"
                  : zh
                    ? "保存训练"
                    : "Save training"}
              </button>
            </>
          }
        >
          <form id="training-form" className="stack" onSubmit={submit}>
            <fieldset
              disabled={busy}
              style={{ border: 0, margin: 0, padding: 0 }}
              className="stack"
            >
              <label className="field">
                {zh ? "训练名称" : "Session name"}
                <input
                  className="input"
                  required
                  maxLength={160}
                  value={draft.name}
                  onChange={(event) => patch({ name: event.target.value })}
                />
              </label>
              <div className="form-grid three">
                <label className="field">
                  {zh ? "日期" : "Date"}
                  <input
                    className="input"
                    type="date"
                    required
                    value={draft.date}
                    onInput={(event) =>
                      patch({ date: event.currentTarget.value })
                    }
                    onChange={(event) => patch({ date: event.target.value })}
                  />
                </label>
                <label className="field">
                  {zh ? "时长（分钟）" : "Duration (min)"}
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="1440"
                    step="1"
                    required
                    value={draft.duration}
                    onChange={(event) =>
                      patch({ duration: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  {zh ? "主观强度 RPE（可选 1–10）" : "Perceived effort RPE (optional 1–10)"}
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    value={draft.rpe}
                    onChange={(event) => patch({ rpe: event.target.value })}
                  />
                </label>
              </div>
              <p className="hint">
                {zh
                  ? "RPE 1 表示非常轻松，10 表示最大用力。"
                  : "RPE 1 means very easy. 10 means maximum effort."}
              </p>
              <div className="section-title">
                <h3>{zh ? "动作与组数" : "Exercises and sets"}</h3>
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={draft.exercises.length >= 100}
                  onClick={() =>
                    patch({ exercises: [...draft.exercises, newExercise()] })
                  }
                >
                  <Plus size={16} />
                  {zh ? "添加动作" : "Add exercise"}
                </button>
              </div>
              {draft.exercises.map((exercise, index) => (
                <div className="panel stack" key={exercise.key}>
                  <div className="section-title">
                    <strong>
                      {zh ? "动作 " : "Exercise "}
                      {index + 1}
                    </strong>
                    <button
                      className="icon-button"
                      type="button"
                      disabled={draft.exercises.length <= 1}
                      aria-label={zh ? "移除此动作" : "Remove exercise"}
                      onClick={() =>
                        patch({
                          exercises: draft.exercises.filter(
                            (item) => item.key !== exercise.key,
                          ),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <label className="field">
                    {zh ? "动作名称" : "Exercise name"}
                    <input
                      className="input"
                      required
                      maxLength={160}
                      value={exercise.name}
                      onChange={(event) =>
                        patchExercise(exercise.key, {
                          name: event.target.value,
                        })
                      }
                    />
                  </label>
                  <div className="form-grid three">
                    <label className="field">
                      {zh ? "组数" : "Sets"}
                      <input
                        className="input"
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        required
                        value={exercise.sets}
                        onChange={(event) =>
                          patchExercise(exercise.key, {
                            sets: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      {zh ? "每组次数" : "Reps per set"}
                      <input
                        className="input"
                        type="number"
                        min="1"
                        max="1000"
                        step="1"
                        required
                        value={exercise.reps}
                        onChange={(event) =>
                          patchExercise(exercise.key, {
                            reps: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      {zh ? "负重" : "Load"} ({draft.loadUnit})
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max={draft.loadUnit === "lb" ? 2000 * KG_TO_LB : 2000}
                        step="any"
                        required
                        value={exercise.weight}
                        onChange={(event) =>
                          patchExercise(exercise.key, {
                            weight: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
              <p className="hint">
                {zh
                  ? "自重动作负重填 0。公斤与磅会换算为公斤保存。单侧动作的次数和重量按你采用的记录口径填写，并在备注说明。"
                  : "Use 0 for bodyweight exercises. Loads are stored in kilograms. For one-sided exercises, note how you counted reps and load."}
              </p>
              <label className="field">
                {zh ? "训练备注（可选）" : "Session notes (optional)"}
                <textarea
                  className="input"
                  rows={3}
                  maxLength={4000}
                  value={draft.notes}
                  onChange={(event) => patch({ notes: event.target.value })}
                />
              </label>
            </fieldset>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </Modal>
      ) : null}
      {deleting ? (
        <Modal
          title={zh ? "删除这次训练？" : "Delete this session?"}
          description={deleting.name}
          onClose={() => {
            if (!busy) {
              setDeleting(null);
              setError("");
            }
          }}
          footer={
            <>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => {
                  setDeleting(null);
                  setError("");
                }}
              >
                {zh ? "保留" : "Keep"}
              </button>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={remove}
              >
                {busy
                  ? zh
                    ? "删除中…"
                    : "Deleting…"
                  : zh
                    ? "删除记录"
                    : "Delete session"}
              </button>
            </>
          }
        >
          <p>
            {zh
              ? "删除后，这次训练不再计入训练与趋势。"
              : "This session will no longer count toward training or trends."}
          </p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
