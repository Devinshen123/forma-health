import { useEffect, useRef, useState } from "react";
import { uid, type ActiveWorkout, type AppState, type CatalogExercise, type FeatureProps, type Language, type RoutineExercise, type SetLog, type TrainingRoutine, type Workout } from "../../types";

export const LB_PER_KG = 2.2046226218487757;
export const displayLoad = (kg: number | null, imperial: boolean) => kg === null ? "" : String(Math.round(kg * (imperial ? LB_PER_KG : 1) * 1000) / 1000);
export const readLoad = (value: string, imperial: boolean) => value === "" ? null : Math.round(Number(value) / (imperial ? LB_PER_KG : 1) * 1000000) / 1000000;
export const readNumber = (value: string) => value === "" ? null : Number(value);
export const setKindLabel = (kind: SetLog["kind"], lang: Language) => kind === "warmup" ? lang === "zh" ? "热身" : "Warm-up" : kind === "drop" ? lang === "zh" ? "递减" : "Drop" : lang === "zh" ? "工作" : "Work";
export const actualSet = (kind: SetLog["kind"] = "work"): SetLog => ({ id: uid(), kind, reps: null, weight: null, durationSeconds: null, distanceMeters: null, rpe: null, rir: null, completed: false });
export const routineExercise = (exercise?: CatalogExercise, lang: Language = "en"): RoutineExercise => ({ id: uid(), exerciseId: exercise?.id, name: (lang === "zh" ? exercise?.nameZh ?? exercise?.name : exercise?.name) ?? "", primaryMuscles: exercise?.primaryMuscles ?? [], setCount: 3, repsMin: 8, repsMax: 12, weight: null, restSeconds: 90, supersetGroup: null, progression: { enabled: false, incrementKg: 2.5 } });
export const leafRoutines = (routines: TrainingRoutine[]) => routines.filter((routine) => !routines.some((candidate) => candidate.supersedesId === routine.id));
export const sessionFromRoutine = (routine: TrainingRoutine, date: string): ActiveWorkout => ({ id: uid(), date, name: routine.name, startedAt: new Date().toISOString(), routineId: routine.id, exercises: routine.exercises.map((exercise) => ({ id: uid(), exerciseId: exercise.exerciseId, name: exercise.name, primaryMuscles: [...exercise.primaryMuscles], setLogs: Array.from({ length: exercise.setCount }, () => actualSet()), supersetGroup: exercise.supersetGroup, restSeconds: exercise.restSeconds, notes: "" })), restEndsAt: null, notes: "", rpe: null });
export const validSetEvidence = (set: SetLog) => (set.reps !== null && set.reps > 0 && set.weight !== null) || (set.durationSeconds !== null && set.durationSeconds > 0);
/** Rest follows a completed drop chain and a completed user-defined superset round. */
export function nextSetBeforeRest(session: ActiveWorkout, exerciseId: string, setId: string): { exerciseId: string; setId: string; name: string; index: number } | null {
  const exercise = session.exercises.find((item) => item.id === exerciseId), set = exercise?.setLogs.find((item) => item.id === setId);
  if (!exercise || !set) return null;
  const pendingDrop = (item: typeof exercise, parentId: string): SetLog | undefined => {
    for (const child of item.setLogs.filter((log) => log.dropParentId === parentId)) {
      if (!child.completed) return child;
      const descendant = pendingDrop(item, child.id); if (descendant) return descendant;
    }
  };
  const cue = (item: typeof exercise, log: SetLog) => ({ exerciseId: item.id, setId: log.id, name: item.name, index: item.setLogs.findIndex((candidate) => candidate.id === log.id) + 1 });
  const ownDrop = pendingDrop(exercise, set.id); if (ownDrop) return cue(exercise, ownDrop);
  let parent = set;
  while (parent.kind === "drop" && parent.dropParentId) { const previous = exercise.setLogs.find((log) => log.id === parent.dropParentId); if (!previous) break; parent = previous; }
  const remainingDrop = pendingDrop(exercise, parent.id); if (remainingDrop) return cue(exercise, remainingDrop);
  if (parent.kind !== "work" || !exercise.supersetGroup) return null;
  const round = exercise.setLogs.filter((log) => log.kind === "work").findIndex((log) => log.id === parent.id);
  for (const partner of session.exercises.filter((item) => item.supersetGroup === exercise.supersetGroup)) {
    const roundSet = partner.setLogs.filter((log) => log.kind === "work")[round]; if (!roundSet) continue;
    if (!roundSet.completed) return cue(partner, roundSet);
    const drop = pendingDrop(partner, roundSet.id); if (drop) return cue(partner, drop);
  }
  return null;
}
export const setIssue = (set: SetLog): boolean =>
  (set.reps !== null && (!Number.isInteger(set.reps) || set.reps < 0 || set.reps > 1000)) ||
  (set.weight !== null && (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > 2000)) ||
  (set.durationSeconds !== null && (!Number.isFinite(set.durationSeconds) || set.durationSeconds <= 0 || set.durationSeconds > 86400)) ||
  (set.distanceMeters !== null && (!Number.isFinite(set.distanceMeters) || set.distanceMeters < 0 || set.distanceMeters > 1000000)) ||
  (set.rpe !== null && (!Number.isFinite(set.rpe) || set.rpe < 1 || set.rpe > 10)) ||
  (set.rir !== null && (!Number.isFinite(set.rir) || set.rir < 0 || set.rir > 20));
export const workoutFromSession = (session: ActiveWorkout, duration: number): Workout => ({ id: session.id, date: session.date, name: session.name.trim(), duration, rpe: session.rpe, routineId: session.routineId, source: "manual", notes: [session.notes.trim(), ...session.exercises.filter((exercise) => exercise.notes.trim()).map((exercise) => `${exercise.name}: ${exercise.notes.trim()}`)].filter(Boolean).join("\n\n"), createdAt: new Date().toISOString(), exercises: session.exercises.filter((exercise) => exercise.setLogs.some((set) => set.completed)).map((exercise) => { const logs = exercise.setLogs.filter((set) => set.completed); return { id: exercise.id, exerciseId: exercise.exerciseId, name: exercise.name.trim(), primaryMuscles: exercise.primaryMuscles, sets: logs.length, reps: logs.find((set) => set.reps !== null)?.reps ?? 0, weight: logs.find((set) => set.weight !== null)?.weight ?? 0, setLogs: logs, supersetGroup: exercise.supersetGroup, restSeconds: exercise.restSeconds }; }) });
export function useTrainingSave({ save, notify, lang }: Pick<FeatureProps, "save" | "notify" | "lang">) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const mounted = useRef(true), lock = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (next: AppState, success?: () => void, message?: [string, string]) => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError("");
    try { await save(next); if (!mounted.current) return false; success?.(); if (message) notify(...message); return true; }
    catch { if (mounted.current) { setError(lang === "zh" ? "未能保存，请检查页面顶部的连接或冲突状态后重试。" : "Could not save. Check connection or conflict status at the top of the page, then retry."); notify("本次改动未保存", "Changes were not saved"); } return false; }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return { busy, error, setError, run };
}
