import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { catalog, equipmentLabel, exerciseLabel, muscleLabel } from "../../catalog/exercises";
import ExerciseAnimation from "../../components/ExerciseAnimation";
import type { CatalogExercise, Language } from "../../types";

export default function Library({ lang, onChoose, chooseLabel }: { lang: Language; onChoose: (exercise: CatalogExercise) => void; chooseLabel?: string }) {
  const zh = lang === "zh";
  const [query, setQuery] = useState(""), [muscle, setMuscle] = useState(""), [equipment, setEquipment] = useState(""), [teaching, setTeaching] = useState(false), [page, setPage] = useState(0), [expanded, setExpanded] = useState<string | null>(null);
  const muscles = useMemo(() => [...new Set(catalog.flatMap((exercise) => exercise.primaryMuscles))].sort(), []);
  const equipmentKeys = useMemo(() => [...new Set(catalog.map((exercise) => exercise.equipment ?? "__unknown"))].sort(), []);
  const filtered = useMemo(() => catalog.filter((exercise) => (!query.trim() || `${exercise.name} ${exercise.nameZh ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && (!muscle || exercise.primaryMuscles.includes(muscle)) && (!equipment || (exercise.equipment ?? "__unknown") === equipment) && (!teaching || !!exercise.animation)), [query, muscle, equipment, teaching]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 12) - 1));
  return <div className="stack">
    <div className="form-grid three">
      <label className="field"><span><Search size={15} /> {zh ? "搜索动作" : "Search exercises"}</span><input className="input" value={query} placeholder={zh ? "中文基础动作或英文名称" : "Exercise name"} onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label>
      <label className="field">{zh ? "主要肌群" : "Primary muscle"}<select className="input" value={muscle} onChange={(event) => { setMuscle(event.target.value); setPage(0); }}><option value="">{zh ? "全部肌群" : "All muscles"}</option>{muscles.map((key) => <option key={key} value={key}>{muscleLabel(key, lang)}</option>)}</select></label>
      <label className="field">{zh ? "器械" : "Equipment"}<select className="input" value={equipment} onChange={(event) => { setEquipment(event.target.value); setPage(0); }}><option value="">{zh ? "全部器械" : "All equipment"}</option>{equipmentKeys.map((key) => <option key={key} value={key}>{equipmentLabel(key === "__unknown" ? null : key, lang)}</option>)}</select></label>
    </div>
    <label className="checkbox-field"><input type="checkbox" checked={teaching} onChange={(event) => { setTeaching(event.target.checked); setPage(0); }} />{zh ? "仅看带原创教学示意的动作" : "Only exercises with original teaching demonstrations"}</label>
    <p className="hint">{zh ? `${catalog.length} 个文字动作；来源动作说明保留英文，8 个基础动作提供中英文字与原创示意。` : `${catalog.length} text exercises. Source instructions remain in English; 8 foundation exercises have bilingual text and original demonstrations.`}</p>
    <div className="training-grid">{filtered.slice(currentPage * 12, currentPage * 12 + 12).map((exercise) => <article key={exercise.id} className="exercise-card stack">
      <div><h3>{exerciseLabel(exercise, lang)}</h3><p className="muted">{exercise.primaryMuscles.map((key) => muscleLabel(key, lang)).join(" · ")} · {equipmentLabel(exercise.equipment, lang)}</p><span className="badge">{exercise.animation ? zh ? "原创教学示意" : "Original demonstration" : zh ? "文字说明" : "Text instructions"}</span></div>
      <div className="row-actions"><button className="btn btn-ghost" onClick={() => setExpanded(expanded === exercise.id ? null : exercise.id)} aria-expanded={expanded === exercise.id}>{zh ? "查看动作" : "View exercise"}</button><button className="btn btn-secondary" onClick={() => onChoose(exercise)}><Plus size={15} />{chooseLabel ?? (zh ? "加入计划" : "Add to routine")}</button></div>
      {expanded === exercise.id ? <div className="stack">{exercise.animation ? <ExerciseAnimation exercise={exercise} lang={lang} /> : <p className="hint">{zh ? "此动作暂未提供原创教学示意。" : "No original demonstration is available for this exercise yet."}</p>}<ol>{(zh && exercise.instructionsZh ? exercise.instructionsZh : exercise.instructions).map((instruction, index) => <li key={index}>{instruction}</li>)}</ol>{zh && !exercise.instructionsZh ? <p className="hint">{zh ? "以上为来源英文说明，尚未翻译。" : "Source instructions have not been translated."}</p> : null}</div> : null}
    </article>)}</div>
    {!filtered.length ? <p className="empty-state">{zh ? "没有匹配的动作，请调整筛选。" : "No matching exercises. Adjust the filters."}</p> : <div className="training-toolbar"><span className="muted">{filtered.length} {zh ? "个结果" : "results"} · {currentPage + 1}/{Math.ceil(filtered.length / 12)}</span><div className="row-actions"><button className="btn btn-secondary" disabled={!currentPage} onClick={() => setPage(currentPage - 1)} aria-label={zh ? "上一页" : "Previous page"}><ChevronLeft size={17} /></button><button className="btn btn-secondary" disabled={(currentPage + 1) * 12 >= filtered.length} onClick={() => setPage(currentPage + 1)} aria-label={zh ? "下一页" : "Next page"}><ChevronRight size={17} /></button></div></div>}
  </div>;
}
