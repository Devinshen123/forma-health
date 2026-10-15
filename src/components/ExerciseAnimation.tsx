import {useEffect,useId,useState} from 'react';
import {Pause,Play} from 'lucide-react';
import type {CatalogExercise,Language} from '../types';
type Point=[number,number];
type Pose={head:Point;shoulder:Point;hip:Point;elbow:Point;hand:Point;knee:Point;foot:Point;elbow2?:Point;hand2?:Point;knee2?:Point;foot2?:Point};
const standing:Pose={head:[160,48],shoulder:[160,80],hip:[160,133],elbow:[176,110],hand:[178,143],knee:[152,166],foot:[145,200],knee2:[172,168],foot2:[180,200]};
const frames:Record<NonNullable<CatalogExercise['animation']>,[Pose,Pose]>={
  squat:[standing,{head:[188,92],shoulder:[178,117],hip:[132,150],elbow:[202,127],hand:[222,115],knee:[181,169],foot:[173,200],knee2:[166,175],foot2:[160,200]}],
  pushup:[{head:[220,119],shoulder:[195,133],hip:[132,149],elbow:[201,166],hand:[205,200],knee:[80,169],foot:[40,200]}, {head:[218,169],shoulder:[195,179],hip:[128,185],elbow:[170,181],hand:[205,200],knee:[80,189],foot:[40,200]}],
  row:[{head:[210,79],shoulder:[182,100],hip:[119,114],elbow:[172,143],hand:[165,180],knee:[118,164],foot:[100,200],elbow2:[207,133],hand2:[220,158]}, {head:[210,79],shoulder:[182,100],hip:[119,114],elbow:[140,93],hand:[136,125],knee:[118,164],foot:[100,200],elbow2:[207,133],hand2:[220,158]}],
  press:[{...standing,elbow:[194,96],hand:[190,64],elbow2:[126,96],hand2:[130,64]}, {...standing,elbow:[181,45],hand:[178,14],elbow2:[139,45],hand2:[142,14]}],
  curl:[{...standing,elbow:[175,110],hand:[182,147],elbow2:[145,110],hand2:[138,147]}, {...standing,elbow:[175,110],hand:[191,76],elbow2:[145,110],hand2:[129,76]}],
  hinge:[{...standing,elbow:[176,112],hand:[182,150]}, {head:[232,114],shoulder:[207,129],hip:[135,135],elbow:[207,161],hand:[207,194],knee:[150,173],foot:[158,200],knee2:[165,173],foot2:[180,200]}],
  lunge:[{head:[160,48],shoulder:[160,80],hip:[160,133],elbow:[178,110],hand:[179,140],knee:[124,163],foot:[100,200],knee2:[191,166],foot2:[218,200]}, {head:[160,92],shoulder:[160,121],hip:[157,166],elbow:[178,148],hand:[179,176],knee:[105,163],foot:[100,200],knee2:[198,193],foot2:[218,200]}],
  plank:[{head:[221,125],shoulder:[195,139],hip:[132,155],elbow:[192,200],hand:[224,200],knee:[84,177],foot:[45,200]}, {head:[221,125],shoulder:[195,139],hip:[132,155],elbow:[192,200],hand:[224,200],knee:[84,177],foot:[45,200]}],
};
const point=(a:Point,b:Point,t:number):Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function interpolate(a:Pose,b:Pose,t:number):Pose {const p={...a};for(const key of Object.keys(a) as (keyof Pose)[]){if(a[key]&&b[key])p[key]=point(a[key]!,b[key]!,t);}return p;}
export default function ExerciseAnimation({exercise,lang}:{exercise:CatalogExercise;lang:Language}) {
  const zh=lang==='zh',id=useId(),mode=exercise.animation;
  const [playing,setPlaying]=useState(false),[phase,setPhase]=useState(0);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(()=>{setPlaying(false);setPhase(0);},[exercise.id]);
  useEffect(()=>{if(!playing||reduced)return;let frame=0,start=performance.now(),last=0;const tick=(now:number)=>{if(now-last>=32){setPhase((1-Math.cos((now-start)/4000*Math.PI*2))/2);last=now;}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[playing,reduced]);
  if(!mode)return <p className="hint">{zh?'本动作有文字说明，暂无教学动画。':'Text instructions are available; no animation for this exercise.'}</p>;
  const p=interpolate(...frames[mode],phase);
  const line=(points:Point[],key:string,back=false)=><polyline key={key} points={points.map(v=>v.join(',')).join(' ')} fill="none" stroke={back?'#94a3a1':'#213e36'} strokeWidth={back?7:9} strokeLinecap="round" strokeLinejoin="round"/>;
  const dumbbell=(hand:Point,key:string)=><g key={key}><path d={`M${hand[0]-11} ${hand[1]}h22`} stroke="#213e36" strokeWidth="4"/><rect x={hand[0]-15} y={hand[1]-8} width="7" height="16" rx="2" fill="#619737"/><rect x={hand[0]+8} y={hand[1]-8} width="7" height="16" rx="2" fill="#619737"/></g>;
  return <section className="exercise-animation" aria-label={zh?'原创动作教学示意':'Original movement demonstration'}>
    <svg viewBox="0 0 320 230" role="img" aria-labelledby={id}>
      <title id={id}>{zh?'原创二维动作路径示意；结合下方文字逐步查看':'Original 2D movement diagram; use the instructions below'}</title>
      <path d="M25 206H295" stroke="#c9d5ce" strokeWidth="2"/>
      {mode==='row'&&<path d="M204 161H260M211 161V204M250 161V204" stroke="#adbcb6" strokeWidth="7" strokeLinecap="round"/>}
      {p.elbow2&&p.hand2&&line([p.shoulder,p.elbow2,p.hand2],'far-arm',true)}
      {p.knee2&&p.foot2&&line([p.hip,p.knee2,p.foot2],'far-leg',true)}
      {line([p.shoulder,p.hip,p.knee,p.foot],'body')}
      {line([p.shoulder,p.elbow,p.hand],'arm')}
      <circle cx={p.head[0]} cy={p.head[1]} r="14" fill="#213e36"/>
      <path d={`M${p.head[0]} ${p.head[1]+12}L${p.shoulder[0]} ${p.shoulder[1]}`} stroke="#213e36" strokeWidth="8"/>
      {[p.shoulder,p.hip,p.elbow,p.knee].map((v,i)=><circle key={i} cx={v[0]} cy={v[1]} r="4" fill="#c5f467"/>)}
      {['row','press','curl','hinge'].includes(mode)&&dumbbell(p.hand,'load')}
      {['press','curl'].includes(mode)&&p.hand2&&dumbbell(p.hand2,'load2')}
      {mode==='plank'&&<text x="160" y="28" textAnchor="middle" fill="#42634d" fontSize="14">{zh?'稳定保持 · 正常呼吸':'Hold steadily · Breathe'}</text>}
    </svg>
    <div className="animation-controls">
      <button type="button" className="btn btn-secondary" onClick={()=>setPlaying(!playing)} disabled={reduced||mode==='plank'}>{playing?<Pause size={16}/>:<Play size={16}/>} {zh?(playing?'暂停示意':'播放示意'):(playing?'Pause':'Play')}</button>
      <label className="field">{zh?'逐步查看':'Step through'}<input type="range" min="0" max="100" value={Math.round(phase*100)} onChange={e=>{setPlaying(false);setPhase(Number(e.target.value)/100);}}/></label>
    </div>
    <p className="hint">{zh?'Forma 原创二维路径示意，简化了视角与关节运动；请同时阅读动作步骤。':'Original Forma 2D diagram simplifies perspective and joint movement. Read the movement instructions alongside it.'}{reduced&&(zh?' 已使用减少动态，可手动逐步查看。':' Reduced motion enabled; step through manually.')}</p>
  </section>;
}
