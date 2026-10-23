import { useEffect, useRef, useState } from 'react';
import { Check, LockKeyhole, Sparkles } from 'lucide-react';
import { COMPANION_EVOLUTIONS, companionForm, companionGrowthStage, nextCompanionEvolution } from '../companion-growth';
import type { CompanionSnapshot } from '../companion';
import Companion3D from './Companion3D';
import CompanionAvatar from './CompanionAvatar';

export default function CompanionGrowth({ snapshot, identity, zh }: { snapshot: CompanionSnapshot; identity: string; zh: boolean }) {
  const [previewLevel, setPreviewLevel] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const previous = useRef({ identity, character: snapshot.character, level: snapshot.level });
  const character = snapshot.character ?? 'sprout', forms = COMPANION_EVOLUTIONS[character];
  const shownLevel = previewLevel ?? snapshot.level, stage = companionGrowthStage(shownLevel, character);
  const currentStage = companionGrowthStage(snapshot.level, character), form = companionForm(character, shownLevel);
  const next = nextCompanionEvolution(character, snapshot.xp);
  useEffect(() => {
    const old = previous.current; previous.current = { identity, character, level: snapshot.level };
    if (old.identity !== identity || old.character !== character) { setCelebration(null); setPreviewLevel(null); return; }
    if (snapshot.level > old.level) {
      setPreviewLevel(null);
      const evolved = companionGrowthStage(snapshot.level, character) > companionGrowthStage(old.level, character);
      setCelebration(evolved ? (zh ? `进化啦！${companionForm(character, old.level).zh}变成了${companionForm(character, snapshot.level).zh}！` : `Evolved into ${companionForm(character, snapshot.level).en}!`) : (zh ? `升级啦！现在是 ${snapshot.level} 级。` : `Level up! You reached level ${snapshot.level}.`));
    }
  }, [identity, character, snapshot.level, zh]);
  useEffect(() => { if (!celebration) return; const timer = window.setTimeout(() => setCelebration(null), 5000); return () => window.clearTimeout(timer); }, [celebration]);
  return <div className="companion-growth-studio" data-preview={previewLevel !== null} data-evolving={Boolean(celebration)} data-form={form.dex}>
    <button type="button" className="text-button companion-open-pokedex" onClick={()=>document.getElementById('companion-pokedex')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}>{zh?'选择伙伴 · 打开 151 图鉴':'Choose a companion · 151 Pokédex'} →</button>
    <div className="companion-growth-stage-label"><Sparkles size={14} /><strong>{zh ? form.zh : form.en}</strong><span>{previewLevel !== null ? (zh ? '形态预览' : 'Preview') : (zh ? '当前形态' : 'Current form')} · Lv.{shownLevel}</span></div>
    <Companion3D character={character} equipped={snapshot.equipped} level={shownLevel} zh={zh} />
    <div className="companion-growth-announcement" role="status" aria-live="polite">{celebration ?? ''}</div>
    <div className="companion-evolution-heading"><strong>{zh ? (forms.length>1?'我的进化路线':'我的伙伴形态') : (forms.length>1?'My evolution path':'My companion form')}</strong><span>{zh ? `${currentStage + 1} / ${forms.length} 已解锁` : `${currentStage + 1} / ${forms.length} unlocked`}</span></div>
    <div className="companion-growth-road" style={{ gridTemplateColumns: `repeat(${forms.length}, minmax(0, 1fr))` }} role="group" aria-label={zh ? '进化形态预览' : 'Evolution form previews'}>
      {forms.map((item, index) => <button type="button" key={item.dex} aria-label={zh ? `预览${item.zh}，${item.level}级${index <= currentStage ? '已解锁' : '解锁'}` : `Preview ${item.en}, level ${item.level}`} aria-pressed={stage === index} className={currentStage >= index ? 'is-unlocked' : ''} onClick={() => setPreviewLevel(item.level)}><CompanionAvatar character={character} level={item.level} thumbnail /><strong>{zh ? item.zh : item.en}</strong><span>{index <= currentStage ? <Check size={12} /> : <LockKeyhole size={12} />} Lv.{item.level}</span></button>)}
    </div>
    {previewLevel !== null ? <div className="companion-growth-preview" role="status"><span>{zh ? `仅预览形态 · 实际等级 ${snapshot.level} · 经验不变` : `Preview only · actual level ${snapshot.level} · XP unchanged`}</span><button type="button" className="text-button" onClick={() => setPreviewLevel(null)}>{zh ? '返回当前伙伴' : 'Back to my companion'}</button></div> : <p className="companion-growth-description">{next ? (zh ? `再获得 ${next.remainingXp} XP，${next.level} 级进化为${next.zh}。` : `${next.remainingXp} XP to ${next.en} at level ${next.level}.`) : (zh ? '已经进化到最终形态，继续一起积累成长。' : 'Final form unlocked. Keep growing together.')}</p>}
    <p className="companion-growth-note">{forms.length>1?(zh ? '每 100 XP 升一级 · 按 Forma 等级自动进化，外形与头像同步改变' : '100 XP per level · auto-evolution updates your model and portrait'):(zh?'每 100 XP 升一级 · 这位伙伴在关都图鉴中没有后续进化形态':'100 XP per level · no further Kanto evolution for this companion')}</p>
  </div>;
}
