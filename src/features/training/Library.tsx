import { useDeferredValue, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Plus, Search, X } from 'lucide-react';
import { categoryLabel, equipmentLabel, exerciseLabel } from '../../catalog/exercises';
import { openGymExercises } from '../../catalog/opengym';
import muscleIndex from '../../catalog/opengym-muscles.json';
import { matchesMuscle, MUSCLE_KEYS, muscleName } from '../../catalog/muscle-explorer';
import MuscleExplorer from '../../components/MuscleExplorer';
import ExerciseDetails from '../../components/ExerciseDetails';
import type { CatalogExercise, Language } from '../../types';

// The old catalogue stays available to resolve saved exercise IDs, outside this picker.
const exercises = openGymExercises.filter(exercise => exercise.video);
const equipmentKeys = [...new Set(exercises.map(exercise => exercise.equipment ?? '__unknown'))].sort();
const categories = [...new Set(exercises.map(exercise => exercise.category))].sort();
const roles = muscleIndex as Record<string, { primary: string[]; secondary: string[] }>;
const PAGE_SIZE = 12;

export default function Library({ lang, onChoose, chooseLabel }: { lang: Language; onChoose: (exercise: CatalogExercise) => void; chooseLabel?: string }) {
  const zh = lang === 'zh';
  const [query, setQuery] = useState(''), [muscle, setMuscle] = useState(''), [equipment, setEquipment] = useState(''), [category, setCategory] = useState('');
  const [page, setPage] = useState(0), [expanded, setExpanded] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => {
    const words = deferredQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return exercises.filter(exercise => {
      const name = [exercise.name, exercise.nameZh ?? '', exercise.sourceId ?? ''].join(' ').toLocaleLowerCase();
      return words.every(word => name.includes(word)) && (!muscle || matchesMuscle(exercise, muscle)) && (!equipment || (exercise.equipment ?? '__unknown') === equipment) && (!category || exercise.category === category);
    });
  }, [deferredQuery, muscle, equipment, category]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const changed = () => { setPage(0); setExpanded(null); };
  const selectMuscle = (key: string) => { setMuscle(key); changed(); };
  const clear = () => { setQuery(''); setMuscle(''); setEquipment(''); setCategory(''); changed(); };
  const hasFilters = !!(query || muscle || equipment || category);

  return <div className="stack exercise-library">
    <div className="library-summary" role="status">
      <strong>{exercises.length.toLocaleString()} {zh ? '个动画动作' : 'animated exercises'}</strong>
      <span className="hint">{zh ? '按肌群寻找动作，加入你的训练。部分动作步骤保留英文。' : 'Find movements by muscle and add them to your training. Some instructions remain in English.'}</span>
    </div>
    <label className="field"><span><Search size={15} /> {zh ? '搜索动作' : 'Search exercises'}</span><input aria-label={zh ? '搜索动作' : 'Search exercises'} className="input" value={query} placeholder={zh ? '中文名、英文名或动作编号' : 'Chinese / English name or exercise ID'} onChange={event => { setQuery(event.target.value); changed(); }} /></label>
    <div className="form-grid three">
      <label className="field">{zh ? '肌群' : 'Muscle group'}<select aria-label={zh ? '肌群' : 'Muscle group'} className="input" value={muscle} onChange={event => selectMuscle(event.target.value)}><option value="">{zh ? '全部肌群' : 'All muscles'}</option>{MUSCLE_KEYS.map(key => <option key={key} value={key}>{muscleName(key, lang)}</option>)}</select></label>
      <label className="field">{zh ? '器械' : 'Equipment'}<select aria-label={zh ? '器械' : 'Equipment'} className="input" value={equipment} onChange={event => { setEquipment(event.target.value); changed(); }}><option value="">{zh ? '全部器械' : 'All equipment'}</option>{equipmentKeys.map(key => <option key={key} value={key}>{equipmentLabel(key === '__unknown' ? null : key, lang)}</option>)}</select></label>
      <label className="field">{zh ? '动作类别' : 'Exercise category'}<select aria-label={zh ? '动作类别' : 'Exercise category'} className="input" value={category} onChange={event => { setCategory(event.target.value); changed(); }}><option value="">{zh ? '全部类别' : 'All categories'}</option>{categories.map(key => <option key={key} value={key}>{categoryLabel(key, lang)}</option>)}</select></label>
    </div>
    <MuscleExplorer exercises={exercises} lang={lang} selected={muscle} onSelect={selectMuscle} />
    <div className="training-toolbar library-results" data-testid="exercise-results">
      <p role="status">{filtered.length.toLocaleString()} {zh ? '个结果' : 'results'}{muscle ? ' · ' + muscleName(muscle, lang) : ''}</p>
      {hasFilters ? <button type="button" className="btn btn-ghost" onClick={clear}><X size={15} />{zh ? '清除筛选' : 'Clear filters'}</button> : null}
    </div>
    <div className="training-grid">{filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE).map(exercise => <article key={exercise.id} className="exercise-card stack" data-exercise-id={exercise.id}>
      <button type="button" className="exercise-preview" aria-label={zh ? '查看' + exerciseLabel(exercise, lang) + '动画' : 'View ' + exerciseLabel(exercise, lang) + ' animation'} onClick={() => setExpanded(expanded === exercise.id ? null : exercise.id)}><img src={exercise.video!.poster} alt={zh ? exerciseLabel(exercise, lang) + '动作预览' : exerciseLabel(exercise, lang) + ' preview'} loading="lazy" decoding="async" width={180} height={180} /><span className="library-play" aria-hidden="true"><Play size={18} fill="currentColor" /></span></button>
      <div><h3>{exerciseLabel(exercise, lang)}</h3><p className="muted">{categoryLabel(exercise.category, lang)} · {equipmentLabel(exercise.equipment, lang)}</p>{muscle ? <span className="badge">{roles[exercise.sourceId!]?.primary.includes(muscle) ? zh ? '主要目标' : 'Primary target' : zh ? '同时训练' : 'Also trains'} · {muscleName(muscle, lang)}</span> : null}</div>
      <div className="row-actions"><button type="button" className="btn btn-ghost" onClick={() => setExpanded(expanded === exercise.id ? null : exercise.id)} aria-expanded={expanded === exercise.id}>{zh ? '查看动作' : 'View exercise'}</button><button type="button" className="btn btn-secondary" onClick={() => onChoose(exercise)}><Plus size={15} />{chooseLabel ?? (zh ? '加入计划' : 'Add to routine')}</button></div>
      {expanded === exercise.id ? <ExerciseDetails exercise={exercise} lang={lang} /> : null}
    </article>)}</div>
    {!filtered.length ? <div className="empty-state"><p>{zh ? '没有匹配的动作，请调整筛选。' : 'No matching exercises. Adjust the filters.'}</p><button type="button" className="btn btn-secondary" onClick={clear}>{zh ? '显示全部动作' : 'Show all exercises'}</button></div> : <div className="training-toolbar"><span className="muted">{zh ? '第' : 'Page'} {currentPage + 1} / {Math.ceil(filtered.length / PAGE_SIZE)} {zh ? '页' : ''}</span><div className="row-actions"><button type="button" className="btn btn-secondary" disabled={!currentPage} onClick={() => { setPage(currentPage - 1); setExpanded(null); }} aria-label={zh ? '上一页' : 'Previous page'}><ChevronLeft size={17} /></button><button type="button" className="btn btn-secondary" disabled={(currentPage + 1) * PAGE_SIZE >= filtered.length} onClick={() => { setPage(currentPage + 1); setExpanded(null); }} aria-label={zh ? '下一页' : 'Next page'}><ChevronRight size={17} /></button></div></div>}
  </div>;
}
