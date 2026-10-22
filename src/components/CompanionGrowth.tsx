import { useEffect, useRef, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { COMPANION_GROWTH_STAGES, companionGrowthStage } from '../companion-growth';
import type { CompanionSnapshot } from '../companion';
import Companion3D from './Companion3D';

export default function CompanionGrowth({ snapshot, identity, zh }: { snapshot: CompanionSnapshot; identity: string; zh: boolean }) {
  const [previewLevel, setPreviewLevel] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<number | null>(null);
  const previous = useRef({ identity, level: snapshot.level });
  const shownLevel = previewLevel ?? snapshot.level, stage = companionGrowthStage(shownLevel);
  const currentStage = companionGrowthStage(snapshot.level), details = COMPANION_GROWTH_STAGES[stage];
  useEffect(() => {
    const old = previous.current; previous.current = { identity, level: snapshot.level };
    if (old.identity === identity && snapshot.level > old.level) { setCelebration(snapshot.level); setPreviewLevel(null); }
    else if (old.identity !== identity) { setCelebration(null); setPreviewLevel(null); }
  }, [identity, snapshot.level]);
  useEffect(() => { if (celebration === null) return; const timer = window.setTimeout(() => setCelebration(null), 5000); return () => window.clearTimeout(timer); }, [celebration]);
  return <div className="companion-growth-studio" data-preview={previewLevel !== null}>
    <div className="companion-growth-stage-label"><Sparkles size={14} />{zh ? details.zh : details.en}<span>Lv. {shownLevel}</span></div>
    <Companion3D character={snapshot.character ?? 'sprout'} equipped={snapshot.equipped} level={shownLevel} zh={zh} />
    <div className="companion-growth-announcement" role="status" aria-live="polite">{celebration !== null ? (zh ? `升级啦！现在是 ${celebration} 级。` : `Level up! You reached level ${celebration}.`) : ''}</div>
    <div className="companion-growth-road" role="group" aria-label={zh ? '成长外观预览' : 'Growth appearance previews'}>
      {COMPANION_GROWTH_STAGES.map((item, index) => <button type="button" key={item.level} aria-pressed={stage === index} className={currentStage >= index ? 'is-unlocked' : ''} onClick={() => setPreviewLevel(item.level)}><span>{index <= currentStage ? <Check size={12} /> : <Sparkles size={12} />} Lv.{item.level}</span><strong>{zh ? item.zh : item.en}</strong></button>)}
    </div>
    <p className="companion-growth-description">{zh ? details.detailZh : details.detailEn}</p>
    {previewLevel !== null ? <div className="companion-growth-preview" role="status"><span>{zh ? `外观预览 · 实际等级 ${snapshot.level}` : `Appearance preview · actual level ${snapshot.level}`}</span><button type="button" className="text-button" onClick={() => setPreviewLevel(null)}>{zh ? '返回当前伙伴' : 'Back to my companion'}</button></div> : <p className="companion-growth-note">{zh ? '每 100 XP 升一级 · 3 / 5 / 10 级解锁成长外观' : '100 XP per level · new looks at levels 3 / 5 / 10'}</p>}
  </div>;
}
