import { useId, useMemo, useState } from 'react';
import { ChevronDown, PersonStanding, RotateCcw } from 'lucide-react';
import bodyPaths from '../catalog/body-paths';
import { isMuscleKey, muscleCounts, muscleName, MUSCLE_KEYS, type MuscleKey } from '../catalog/muscle-explorer';
import type { CatalogExercise, Language } from '../types';
import './MuscleExplorer.css';

interface MuscleExplorerProps {
  exercises: readonly CatalogExercise[];
  lang: Language;
  selected: string;
  onSelect: (key: string) => void;
}

export default function MuscleExplorer({ exercises, lang, selected, onSelect }: MuscleExplorerProps) {
  const zh = lang === 'zh';
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<MuscleKey | null>(null);
  const counts = useMemo(() => muscleCounts(exercises), [exercises]);
  const label = (key: MuscleKey) => `${muscleName(key, lang)} · ${counts[key].toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')} ${zh ? '个动作' : 'exercises'}`;
  const choose = (key: MuscleKey) => onSelect(selected === key ? '' : key);
  const active = hovered ?? (isMuscleKey(selected) ? selected : null);

  return <section className="muscle-explorer">
    <div className="muscle-explorer__header">
      <button type="button" className="muscle-explorer__toggle" aria-label={zh ? '探索肌肉' : 'Explore muscles'} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
        <span className="muscle-explorer__icon"><PersonStanding size={23} aria-hidden="true" /></span>
        <span className="muscle-explorer__toggle-text"><strong>{zh ? '探索肌肉' : 'Explore muscles'}</strong><span>{zh ? '按身体部位找到训练动作' : 'Find exercises by body area'}</span></span>
        <ChevronDown size={19} className={open ? 'muscle-explorer__chevron is-open' : 'muscle-explorer__chevron'} aria-hidden="true" />
      </button>
      {isMuscleKey(selected) ? <button type="button" className="muscle-explorer__clear" aria-label={zh ? '清除肌群筛选' : 'Clear muscle filter'} onClick={() => onSelect('')}><span>{muscleName(selected, lang)}</span><RotateCcw size={14} aria-hidden="true" /></button> : null}
    </div>
    <div id={panelId} role="region" aria-label={zh ? '人体肌群图' : 'Body muscle map'} hidden={!open} className="muscle-explorer__panel">
      <p className="muscle-explorer__intro">{zh ? '点选正面或背面的肌群，查看主要或辅助训练到它的动作。' : 'Choose an area on the front or back to see exercises that train it as a primary or secondary muscle.'}</p>
      <div className="muscle-explorer__diagrams">
        {(['front', 'back'] as const).map(side => {
          const geometry = bodyPaths.male[side];
          const parts = Object.entries(geometry.p);
          return <figure key={side} className="muscle-explorer__figure">
            <figcaption>{side === 'front' ? zh ? '正面' : 'Front' : zh ? '背面' : 'Back'}</figcaption>
            <svg viewBox={geometry.vb} aria-label={side === 'front' ? zh ? '正面肌群图' : 'Front muscle map' : zh ? '背面肌群图' : 'Back muscle map'} className="muscle-explorer__body" data-view={side}>
              {parts.filter(([key]) => !isMuscleKey(key)).map(([key, paths]) => <g key={key} className="muscle-explorer__inactive" aria-hidden="true">{paths.map((path, i) => <path key={i} d={path} />)}</g>)}
              {parts.filter(([key]) => isMuscleKey(key)).map(([key, paths]) => {
                const region = key as MuscleKey;
                return <g key={key} role="button" tabIndex={0} aria-label={label(region)} aria-pressed={selected === key} data-muscle-key={key} data-muscle-count={counts[region]} className="muscle-explorer__region" onClick={() => choose(region)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(region); } }} onMouseEnter={() => setHovered(region)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(region)} onBlur={() => setHovered(null)}>
                  <title>{label(region)}</title>
                  {paths.map((path, i) => <path key={i} d={path} />)}
                </g>;
              })}
            </svg>
          </figure>;
        })}
      </div>
      <div className="muscle-explorer__selection" role="status" aria-live="polite">
        {active ? <><strong>{muscleName(active, lang)}</strong><span>{counts[active].toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')} {zh ? '个动作' : 'exercises'}</span></> : <span>{zh ? '选择一块肌肉，或使用下方按钮。' : 'Select a muscle, or use the buttons below.'}</span>}
      </div>
      <div className="muscle-explorer__choices" aria-label={zh ? '选择肌群' : 'Choose a muscle'}>
        {MUSCLE_KEYS.map(key => <button key={key} type="button" className="muscle-explorer__chip" data-muscle-key={key} data-muscle-count={counts[key]} aria-label={label(key)} aria-pressed={selected === key} onClick={() => choose(key)}><span>{muscleName(key, lang)}</span><span className="muscle-explorer__count">{counts[key].toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}</span></button>)}
      </div>
      <p className="muscle-explorer__note">{zh ? '计数包含主要与辅助参与，同一动作在同一肌群只计一次；各肌群数量不相加。' : 'Counts include primary and secondary involvement. An exercise counts once per area; counts across areas overlap.'}</p>
    </div>
  </section>;
}
