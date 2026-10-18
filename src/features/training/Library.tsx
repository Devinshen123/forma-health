import { useDeferredValue, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { catalog, categoryLabel, equipmentLabel, exerciseLabel, muscleLabel } from '../../catalog/exercises';
import ExerciseDetails from '../../components/ExerciseDetails';
import type { CatalogExercise, Language } from '../../types';

const animated = (exercise: CatalogExercise) => !!(exercise.video || exercise.animation);
const videoCount = catalog.filter(exercise => exercise.video).length;
const sourceCounts = { opengym: catalog.filter(exercise => exercise.source === 'opengym').length, forma: catalog.filter(exercise => exercise.source === 'forma').length, 'free-exercise-db': catalog.filter(exercise => exercise.source === 'free-exercise-db').length };

export default function Library({ lang, onChoose, chooseLabel }: { lang: Language; onChoose: (exercise: CatalogExercise) => void; chooseLabel?: string }) {
  const zh = lang === 'zh';
  const [query, setQuery] = useState(''), [muscle, setMuscle] = useState(''), [equipment, setEquipment] = useState('');
  const [source, setSource] = useState(''), [category, setCategory] = useState(''), [teaching, setTeaching] = useState(false);
  const [page, setPage] = useState(0), [expanded, setExpanded] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const muscles = useMemo(() => [...new Set(catalog.flatMap(exercise => exercise.primaryMuscles))].sort(), []);
  const equipmentKeys = useMemo(() => [...new Set(catalog.map(exercise => exercise.equipment ?? '__unknown'))].sort(), []);
  const categories = useMemo(() => [...new Set(catalog.map(exercise => exercise.category))].sort(), []);
  const filtered = useMemo(() => {
    const words = deferredQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return catalog.filter(exercise => {
      const name = `${exercise.name} ${exercise.nameZh ?? ''} ${exercise.sourceId ?? ''}`.toLocaleLowerCase();
      return words.every(word => name.includes(word)) && (!muscle || exercise.primaryMuscles.includes(muscle)) && (!equipment || (exercise.equipment ?? '__unknown') === equipment) && (!source || exercise.source === source) && (!category || exercise.category === category) && (!teaching || animated(exercise));
    });
  }, [deferredQuery, muscle, equipment, source, category, teaching]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 12) - 1));
  return <div className="stack">
    <div className="form-grid three">
      <label className="field"><span><Search size={15} /> {zh ? '搜索动作' : 'Search exercises'}</span><input className="input" value={query} placeholder={zh ? '中文名、英文名或动作编号' : 'Chinese / English name or exercise ID'} onChange={event => { setQuery(event.target.value); setPage(0); }} /></label>
      <label className="field">{zh ? '主要肌群' : 'Primary muscle'}<select aria-label={zh ? '主要肌群' : 'Primary muscle'} className="input" value={muscle} onChange={event => { setMuscle(event.target.value); setPage(0); }}><option value="">{zh ? '全部肌群' : 'All muscles'}</option>{muscles.map(key => <option key={key} value={key}>{muscleLabel(key, lang)}</option>)}</select></label>
      <label className="field">{zh ? '器械' : 'Equipment'}<select aria-label={zh ? '器械' : 'Equipment'} className="input" value={equipment} onChange={event => { setEquipment(event.target.value); setPage(0); }}><option value="">{zh ? '全部器械' : 'All equipment'}</option>{equipmentKeys.map(key => <option key={key} value={key}>{equipmentLabel(key === '__unknown' ? null : key, lang)}</option>)}</select></label>
    </div>
    <div className="form-grid">
      <label className="field">{zh ? '动作来源' : 'Exercise source'}<select aria-label={zh ? '动作来源' : 'Exercise source'} className="input" value={source} onChange={event => { setSource(event.target.value); setPage(0); }}><option value="">{zh ? '全部来源' : 'All sources'}</option><option value="opengym">openGym · {sourceCounts.opengym}</option><option value="forma">Forma · {sourceCounts.forma}</option><option value="free-exercise-db">Free Exercise DB · {sourceCounts['free-exercise-db']}</option></select></label>
      <label className="field">{zh ? '动作类别' : 'Exercise category'}<select aria-label={zh ? '动作类别' : 'Exercise category'} className="input" value={category} onChange={event => { setCategory(event.target.value); setPage(0); }}><option value="">{zh ? '全部类别' : 'All categories'}</option>{categories.map(key => <option key={key} value={key}>{categoryLabel(key, lang)}</option>)}</select></label>
    </div>
    <label className="checkbox-field"><input type="checkbox" checked={teaching} onChange={event => { setTeaching(event.target.checked); setPage(0); }} />{zh ? '仅看带动画或教学示意的动作' : 'Only exercises with animations or demonstrations'}</label>
    <p className="hint" role="status">{zh ? `${catalog.length.toLocaleString()} 个动作 · ${videoCount.toLocaleString()} 个带授权动画，另有 8 个 Forma 原创示意。部分动作步骤保留英文。` : `${catalog.length.toLocaleString()} exercises · ${videoCount.toLocaleString()} with licensed animations, plus 8 original Forma demonstrations. Some instructions remain in English.`}</p>
    <div className="training-grid">{filtered.slice(currentPage * 12, currentPage * 12 + 12).map(exercise => <article key={exercise.id} className="exercise-card stack" data-exercise-id={exercise.id}>
      {exercise.video ? <button type="button" className="exercise-preview" aria-label={zh ? `查看${exerciseLabel(exercise, lang)}动画` : `View ${exerciseLabel(exercise, lang)} animation`} onClick={() => setExpanded(expanded === exercise.id ? null : exercise.id)}><img src={exercise.video.poster} alt={zh ? `${exerciseLabel(exercise, lang)}动作预览` : `${exerciseLabel(exercise, lang)} preview`} loading="lazy" decoding="async" width={180} height={180} /></button> : null}
      <div><h3>{exerciseLabel(exercise, lang)}</h3><p className="muted">{exercise.primaryMuscles.map(key => muscleLabel(key, lang)).join(' · ') || categoryLabel(exercise.category, lang)} · {equipmentLabel(exercise.equipment, lang)}</p><span className="badge">{exercise.video ? zh ? '动作动画' : 'Exercise animation' : exercise.animation ? zh ? '原创教学示意' : 'Original demonstration' : zh ? '文字说明' : 'Text instructions'}</span></div>
      <div className="row-actions"><button type="button" className="btn btn-ghost" onClick={() => setExpanded(expanded === exercise.id ? null : exercise.id)} aria-expanded={expanded === exercise.id}>{zh ? '查看动作' : 'View exercise'}</button><button type="button" className="btn btn-secondary" onClick={() => onChoose(exercise)}><Plus size={15} />{chooseLabel ?? (zh ? '加入计划' : 'Add to routine')}</button></div>
      {expanded === exercise.id ? <ExerciseDetails exercise={exercise} lang={lang} /> : null}
    </article>)}</div>
    {!filtered.length ? <p className="empty-state">{zh ? '没有匹配的动作，请调整筛选。' : 'No matching exercises. Adjust the filters.'}</p> : <div className="training-toolbar"><span className="muted">{filtered.length.toLocaleString()} {zh ? '个结果' : 'results'} · {currentPage + 1}/{Math.ceil(filtered.length / 12)}</span><div className="row-actions"><button type="button" className="btn btn-secondary" disabled={!currentPage} onClick={() => setPage(currentPage - 1)} aria-label={zh ? '上一页' : 'Previous page'}><ChevronLeft size={17} /></button><button type="button" className="btn btn-secondary" disabled={(currentPage + 1) * 12 >= filtered.length} onClick={() => setPage(currentPage + 1)} aria-label={zh ? '下一页' : 'Next page'}><ChevronRight size={17} /></button></div></div>}
  </div>;
}
