import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import type { FeatureProps } from '../../types';

export default function Workbench({ accountId, demo, lang, onTrainingRefresh, view = 'home' }: FeatureProps & { view?: 'home' | 'stats' }) {
  const zh = lang === 'zh', frame = useRef<HTMLIFrameElement>(null);
  const statistics = view === 'stats';
  const [expanded, setExpanded] = useState(false), [warnings, setWarnings] = useState(0), [status, setStatus] = useState(''), [attempt, setAttempt] = useState(0);
  const refresh = useRef(onTrainingRefresh); refresh.current = onTrainingRefresh;
  useEffect(() => {
    if (!accountId || demo) return;
    const controller = new AbortController();
    const check = async () => {
      try {
        const response = await fetch('/training-workbench/api/data', { credentials: 'same-origin', headers: { 'X-Forma-Account': accountId }, signal: controller.signal });
        if (!response.ok) throw Error('Session unavailable');
        const data = await response.json();
        if (!controller.signal.aborted) { setWarnings(Array.isArray(data.projectionWarnings) ? data.projectionWarnings.length : Array.isArray(data.warnings) ? data.warnings.length : 0); setStatus(''); }
      } catch { if (!controller.signal.aborted) setStatus(zh ? '暂时无法同步。请检查连接或重新登录 Forma。' : 'Sync is unavailable. Check your connection or sign in to Forma again.'); }
    };
    const saved = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.account !== accountId || event.data?.type !== 'forma-workbench-saved') return;
      void check(); void refresh.current?.();
    };
    void check(); window.addEventListener('message', saved);
    return () => { controller.abort(); window.removeEventListener('message', saved); void refresh.current?.(); };
  }, [accountId, demo, lang, attempt]);

  if (!accountId || demo) return <section className="panel stack">
    <h2>{statistics ? zh ? '训练工作台统计' : 'Training workbench statistics' : zh ? '完整训练工作台' : 'Complete training workbench'}</h2>
    <p>{statistics ? zh ? '年度活动热图、肌群与每周训练量、体重变化、动作进步、主观强度和历史记录都在这里。详细图表使用工作台内保存的记录。' : 'Annual activity, muscle and weekly volume, body weight, exercise progress, recorded effort and history live here. Detailed charts use records saved in the workbench.' : zh ? '计划与轮转、动作收藏、自定义动作、器械配置、训练计时、历史统计、围度和进步照都在这里。' : 'Plans and rotations, favourites, custom exercises, equipment, timers, history, measurements and progress photos live here.'}</p>
    <p className="hint">{zh ? '请使用页面上方的“创建账户”或登录入口。训练工作台会按你的 Forma 账户保存，新的账户从空记录开始。' : 'Use Create account or Sign in above. The workbench saves to your Forma account; new accounts start empty.'}</p>
  </section>;

  const url = '/training-workbench/?' + new URLSearchParams({ account: accountId, lang }).toString() + '#/' + view;
  return <section className={'workbench-shell stack' + (expanded ? ' workbench-expanded' : '')} aria-label={statistics ? zh ? '训练工作台统计' : 'Training workbench statistics' : zh ? '完整训练工作台' : 'Complete training workbench'}>
    <div className="training-toolbar">
      <div><h2>{statistics ? zh ? '训练工作台统计' : 'Training workbench statistics' : zh ? '训练工作台' : 'Training workbench'}</h2><p className="hint">{statistics ? zh ? '详细图表仅包含工作台内保存的记录；其他 Forma 训练见上方汇总。工作台会在此浏览器保留本账户副本。' : 'Detailed charts use workbench records; other Forma training is included above. The workbench keeps a copy for this account in this browser.' : zh ? '工作台会在此浏览器保留本账户的训练副本，方便恢复；完成后同步到 Forma 的今日和趋势。' : 'The workbench keeps a training copy for this account in this browser so you can resume. Completed training syncs to Today and Trends.'}</p></div>
      <div className="row-actions"><button type="button" className="btn btn-secondary" onClick={() => { setAttempt(value => value + 1); void refresh.current?.(); }}><RefreshCw size={16} />{zh ? '刷新汇总' : 'Refresh summaries'}</button><button type="button" className="btn btn-secondary" aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{expanded ? zh ? '收起' : 'Collapse' : zh ? '展开工作台' : 'Expand workbench'}</button></div>
    </div>
    {status ? <p className="form-error" role="status">{status}</p> : null}
    {warnings ? <p className="hint" role="status">{zh ? `${warnings} 条记录的部分数据无法用于 Forma 汇总；完整原记录保留在训练工作台和备份中。` : `Some data in ${warnings} records cannot be included in Forma summaries. Complete originals remain in the workbench and backups.`}</p> : null}
    <iframe key={accountId + ':' + view} ref={frame} title={statistics ? zh ? 'Forma 训练统计' : 'Forma training statistics' : zh ? 'Forma 训练工作台' : 'Forma training workbench'} className="workbench-frame" src={url} allow="fullscreen; screen-wake-lock" />
  </section>;
}
