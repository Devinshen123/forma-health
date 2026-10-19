import { useMemo } from 'react';
import { catalog } from '../../catalog/exercises';
import { trainingStats } from '../../training/domain';
import type { FeatureProps } from '../../types';
import { displayLoad, LB_PER_KG } from './helpers';
import Workbench from './Workbench';

export default function TrainingStatistics(props: FeatureProps) {
  const { state, lang, demo } = props;
  const zh = lang === 'zh', imperial = state.profile?.units === 'imperial';
  const stats = useMemo(() => trainingStats(state.workouts, catalog), [state.workouts]);
  const durations = useMemo(() => state.workouts.filter(workout => Number.isFinite(workout.duration) && workout.duration > 0), [state.workouts]);
  const minutes = durations.reduce((total, workout) => total + workout.duration, 0);
  const number = (value: number) => value.toLocaleString(zh ? 'zh-CN' : 'en-US', { maximumFractionDigits: 3 });
  const minutesLabel = !durations.length ? '—' : minutes < 0.001 ? '<0.001' : number(minutes);
  const displayVolume = stats.volumeKg === null ? null : stats.volumeKg * (imperial ? LB_PER_KG : 1);
  const volumeLabel = displayVolume === null ? '—' : displayVolume > 0 && displayVolume < 0.001 ? '<0.001' : number(Number(displayLoad(stats.volumeKg, imperial)));
  const unit = imperial ? 'lb' : 'kg';
  const valueStyle = { overflowWrap: 'anywhere' as const };

  return <div className="stack">
    <section className="panel stack" aria-label={zh ? 'Forma 训练汇总' : 'Forma training summary'} data-training-summary>
      <div className="section-title"><h2>{zh ? '全部已保存训练' : 'All saved training'}</h2>{demo ? <span className="badge">{zh ? '演示数据' : 'Demo data'}</span> : null}</div>
      <p className="hint">{zh ? '汇总全部已保存的 Forma 训练记录，包括原生录入、导入和已同步的工作台训练。进行中的训练不计入。' : 'This covers all saved Forma training: native entries, imports and synced workbench sessions. Workouts still in progress are excluded.'}</p>
      <div className="training-metric-grid">
        <div className="training-metric" data-stat="saved-workouts"><span className="muted">{zh ? '已保存训练次数' : 'Saved sessions'}</span><strong className="stat-value" style={valueStyle}>{stats.loggedWorkouts ? number(stats.loggedWorkouts) : '—'}</strong><small>{zh ? '全部已保存记录' : 'All saved records'}</small></div>
        <div className="training-metric" data-stat="saved-minutes"><span className="muted">{zh ? '有效总分钟' : 'Recorded minutes'}</span><strong className="stat-value" style={valueStyle}>{minutesLabel}</strong><small>{stats.loggedWorkouts ? zh ? `${durations.length}/${stats.loggedWorkouts} 次训练有有效时长` : `${durations.length}/${stats.loggedWorkouts} sessions with valid durations` : zh ? '尚无已记录时长' : 'No recorded duration yet'}</small></div>
        <div className="training-metric" data-stat="completed-sets"><span className="muted">{zh ? '实际完成工作 / 递减组' : 'Completed work / drop sets'}</span><strong className="stat-value" style={valueStyle}>{stats.detailedWorkouts ? number(stats.completedSets) : '—'}</strong><small>{zh ? '依据实际逐组记录' : 'From actual set records'}</small></div>
        <div className="training-metric" data-stat="known-volume"><span className="muted">{zh ? '已知负重 × 次数容量' : 'Known load × reps volume'}</span><strong className="stat-value" style={valueStyle}>{volumeLabel}</strong><small>{unit} × {zh ? '次；仅计已知值' : 'reps; known values only'}</small></div>
      </div>
      {stats.loggedWorkouts ? <p className="hint">{zh ? `${stats.detailedWorkouts} 次训练含逐组记录，${stats.legacyWorkouts} 次仅有汇总。${stats.unknownLoadSets} 个实际完成组缺少可计算的负重与次数；热身组不计入工作组与容量，汇总记录不推算成逐组数据。` : `${stats.detailedWorkouts} sessions include set details; ${stats.legacyWorkouts} have summaries only. ${stats.unknownLoadSets} completed sets lack calculable load and reps. Warm-ups are excluded from work-set counts and volume; summaries are not converted into invented sets.`}</p> : <p className="empty-state">{zh ? '还没有已保存的训练。完成并保存一次训练后，这里会显示汇总。' : 'No saved training yet. Complete and save a session to see your summary here.'}</p>}
      <p className="hint">{zh ? '下方图表和明细仅使用训练工作台中的原始记录。Forma 原生录入和其他导入记录不会反向加入工作台明细。' : 'The charts and details below use original workbench records only. Native Forma entries and other imports are not copied back into workbench details.'}</p>
    </section>
    <Workbench {...props} view="stats" />
  </div>;
}
