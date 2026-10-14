import { useCallback, useEffect, useRef, useState } from "react";
import { Dumbbell, Plus, Play } from "lucide-react";
import { Modal } from "../components/Modal";
import { localDate, uid, type ActiveWorkout, type CatalogExercise, type FeatureProps, type TrainingRoutine } from "../types";
import Library from "./training/Library";
import Routines from "./training/Routines";
import Session from "./training/Session";
import Progress from "./training/Progress";
import ImportTraining from "./training/Import";
import QuickSummary from "./training/QuickSummary";
import { actualSet, sessionFromRoutine, useTrainingSave } from "./training/helpers";

type Section = "library" | "routines" | "session" | "progress" | "import";
export default function Training(props: FeatureProps) {
  const { state, lang } = props, zh = lang === "zh";
  const [section, setSection] = useState<Section>((state.activeWorkouts ?? []).length ? "session" : "routines"), [seed, setSeed] = useState<CatalogExercise | null>(null), [quick, setQuick] = useState(false), [free, setFree] = useState(false), [sessionName, setSessionName] = useState(""), [exerciseName, setExerciseName] = useState(""), [date, setDate] = useState(localDate), [activeId, setActiveId] = useState("");
  const { busy, error, setError, run } = useTrainingSave(props);
  const [activity, setActivity] = useState({ dirty: false, busy: false }), [leaving, setLeaving] = useState<{ section?: Section; quick?: boolean; activeId?: string } | null>(null);
  const unsavedHandler = useRef(props.onUnsavedChange); unsavedHandler.current = props.onUnsavedChange;
  const onActivity = useCallback((dirty: boolean, saving: boolean) => { setActivity((current) => current.dirty === dirty && current.busy === saving ? current : { dirty, busy: saving }); unsavedHandler.current?.(dirty, saving); }, []);
  useEffect(() => () => unsavedHandler.current?.(false, false), []);
  useEffect(() => {
    if (!activity.dirty) return;
    const leavingPage = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", leavingPage);
    return () => window.removeEventListener("beforeunload", leavingPage);
  }, [activity.dirty]);
  const applyNavigation = (target: { section?: Section; quick?: boolean; activeId?: string }) => { if (target.section) setSection(target.section); if (target.activeId) setActiveId(target.activeId); setQuick(target.quick ?? false); setError(""); };
  const navigate = (target: { section?: Section; quick?: boolean; activeId?: string }) => { if (activity.busy || busy) return; if (activity.dirty) setLeaving(target); else applyNavigation(target); };
  const sessions = state.activeWorkouts ?? [], active = sessions.find((item) => item.id === activeId) ?? sessions[0];
  const sections: { id: Section; zh: string; en: string }[] = [{ id: "library", zh: "动作库", en: "Library" }, { id: "routines", zh: "计划", en: "Routines" }, { id: "session", zh: "训练中", en: "Session" }, { id: "progress", zh: "进步", en: "Progress" }, { id: "import", zh: "导入", en: "Import" }];
  const start = async (routine: TrainingRoutine) => {
    if (sessions.length || busy) { setSection("session"); return; }
    const session = sessionFromRoutine(routine, localDate());
    await run({ ...state, activeWorkouts: [...sessions, session] }, () => { setActiveId(session.id); setQuick(false); setSection("session"); }, ["训练已开始，实际组待填写", "Session started; actual sets await your entries"]);
  };
  const startFree = async () => {
    if (sessions.length || busy) return;
    if (!sessionName.trim() || !exerciseName.trim() || !date) { setError(zh ? "请填写训练名称、日期和第一个动作。" : "Enter a session name, date and first exercise."); return; }
    const session: ActiveWorkout = { id: uid(), name: sessionName.trim(), date, startedAt: new Date().toISOString(), exercises: [{ id: uid(), name: exerciseName.trim(), primaryMuscles: [], setLogs: [actualSet()], supersetGroup: null, restSeconds: 90, notes: "" }], restEndsAt: null, restRemainingSeconds: null, notes: "", rpe: null };
    await run({ ...state, activeWorkouts: [...sessions, session] }, () => { setFree(false); setQuick(false); setSection("session"); setActiveId(session.id); }, ["自由训练已开始", "Free session started"]);
  };
  return <div className="stack">
    <div className="page-heading"><div><h1>{zh ? "训练" : "Training"}</h1><p className="page-subtitle">{zh ? "从计划到每一组，看见实际完成的进步。" : "From your plan to every set, see the progress you complete."}</p></div><button className="btn btn-secondary" disabled={busy || activity.busy} onClick={() => navigate({ quick: !quick })}><Plus size={17} />{quick ? zh ? "返回完整训练" : "Back to training" : zh ? "快速汇总记录" : "Quick summary"}</button></div>
    <nav className="training-tabs" aria-label={zh ? "训练功能" : "Training sections"}>{sections.map((item) => <button key={item.id} className={!quick && section === item.id ? "active" : ""} aria-pressed={!quick && section === item.id} disabled={busy || activity.busy} onClick={() => navigate({ section: item.id })}>{zh ? item.zh : item.en}{item.id === "session" && sessions.length ? ` (${sessions.length})` : ""}</button>)}</nav>
    {error && !free ? <p className="form-error" role="alert">{error}</p> : null}
    {quick ? <QuickSummary {...props} /> : section === "library" ? <div className="panel stack"><h2>{zh ? "动作库" : "Exercise library"}</h2><Library lang={lang} onChoose={(exercise) => { setSeed(exercise); setSection("routines"); }} /></div> : section === "routines" ? <Routines {...props} seed={seed} consumeSeed={() => setSeed(null)} onStart={start} canStart={!sessions.length && !busy} /> : section === "session" ? active ? <div className="stack">{sessions.length > 1 ? <label className="field">{zh ? "选择进行中的训练" : "Choose active session"}<select className="input" disabled={activity.busy} value={active.id} onChange={(event) => navigate({ section: "session", activeId: event.target.value })}>{sessions.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.date}</option>)}</select></label> : null}<Session {...props} key={active.id} active={active} onActivity={onActivity} /></div> : <div className="panel empty-state"><Dumbbell size={34} /><h2>{zh ? "准备好开始训练了吗？" : "Ready to start training?"}</h2><p>{zh ? "从已保存计划开始，或添加自由训练。实际数据会保持空白，直到你填写。" : "Start a saved routine or a free session. Actual values stay blank until you enter them."}</p><div className="row-actions"><button className="btn btn-primary" onClick={() => setSection("routines")}><Play size={16} />{zh ? "选择计划" : "Choose routine"}</button><button className="btn btn-secondary" onClick={() => { setSessionName(""); setExerciseName(""); setDate(localDate()); setError(""); setFree(true); }}><Plus size={16} />{zh ? "自由训练" : "Free session"}</button></div></div> : section === "progress" ? <Progress {...props} /> : <ImportTraining {...props} />}
    {leaving ? <Modal title={zh ? "离开未保存的训练草稿？" : "Leave unsaved session edits?"} onClose={() => setLeaving(null)} footer={<><button className="btn btn-secondary" onClick={() => setLeaving(null)}>{zh ? "返回并保存进度" : "Return and save progress"}</button><button className="btn btn-primary" onClick={() => { applyNavigation(leaving); setActivity({ dirty: false, busy: false }); setLeaving(null); }}>{zh ? "放弃未保存编辑并切换" : "Discard unsaved edits and switch"}</button></>}><p>{zh ? "已保存的组会保留；当前未保存的输入会丢失。" : "Saved sets remain. Current unsaved entries will be discarded."}</p></Modal> : null}
    {free ? <Modal title={zh ? "开始自由训练" : "Start a free session"} onClose={() => { if (!busy) setFree(false); }} footer={<><button className="btn btn-secondary" disabled={busy} onClick={() => setFree(false)}>{zh ? "取消" : "Cancel"}</button><button className="btn btn-primary" disabled={busy} onClick={startFree}>{busy ? zh ? "保存中…" : "Saving…" : zh ? "开始训练" : "Start session"}</button></>}><fieldset disabled={busy} className="stack" style={{ border: 0, padding: 0 }}><label className="field">{zh ? "训练名称" : "Session name"}<input className="input" maxLength={160} value={sessionName} onChange={(event) => setSessionName(event.target.value)} /></label><label className="field">{zh ? "日期" : "Date"}<input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="field">{zh ? "第一个动作（稍后可从库中添加）" : "First exercise (add more from the library later)"}<input className="input" maxLength={160} value={exerciseName} onChange={(event) => setExerciseName(event.target.value)} /></label></fieldset>{error ? <p className="form-error" role="alert">{error}</p> : null}</Modal> : null}
  </div>;
}
