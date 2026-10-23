import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Trees, X } from 'lucide-react';

export default function CompanionIsland({dex,name,identity,zh,onOpenChange}:{dex:number;name:string;identity:string;zh:boolean;onOpenChange:(open:boolean)=>void}) {
  const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null),frame=useRef<HTMLIFrameElement>(null),close=useRef<HTMLButtonElement>(null);
  const islandDex=dex===446?143:dex;
  const url=`/companion-island/?backend=webgl2&companion=${islandDex}&scope=${encodeURIComponent(identity)}`;
  useEffect(()=>{onOpenChange(open);return()=>onOpenChange(false);},[open,onOpenChange]);
  useEffect(()=>{
    if(!open)return;
    const overflow=document.body.style.overflow,root=document.getElementById('root'),inert=root?.inert;document.body.style.overflow='hidden';if(root)root.inert=true;close.current?.focus();
    const message=(event:MessageEvent)=>{if(event.origin===location.origin&&event.source===frame.current?.contentWindow&&event.data?.type==='forma-island-close')setOpen(false);};
    const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);}};
    window.addEventListener('message',message);window.addEventListener('keydown',keyboard);
    return()=>{document.body.style.overflow=overflow;if(root)root.inert=inert??false;window.removeEventListener('message',message);window.removeEventListener('keydown',keyboard);trigger.current?.focus();};
  },[open]);
  return <>
    <section className="companion-island-invite" aria-label={zh?'3D 伙伴乐园':'3D companion island'}><div className="companion-island-invite-icon"><Trees size={27}/></div><div><strong>{zh?'给伙伴一个，一起生活的小世界。':'A little world to live in, together.'}</strong><p>{zh?'吃果子、点篝火、浇花、闻花打喷嚏，也会和邻居互相回应。':'Fruit, campfires, flowers and little reactions between friends.'}</p></div><button ref={trigger} type="button" className="btn btn-primary" onClick={()=>setOpen(true)}>{zh?'进入 3D 伙伴乐园':'Enter the 3D island'}<ArrowUpRight size={17}/></button></section>
    {open&&createPortal(<div className="companion-island-overlay" role="dialog" aria-modal="true" aria-label={zh?'3D 伙伴乐园':'3D companion island'}><header className="companion-island-bar"><div><Trees size={17}/><strong>{zh?'Forma 伙伴乐园':'Forma companion island'}</strong><span>{dex===446?(zh?'卡比兽陪你逛岛':'Snorlax joins you'):<>{name}{zh?'也在岛上':' is here, too'}</>}</span></div><button ref={close} type="button" onClick={()=>setOpen(false)} aria-label={zh?'返回伙伴成长':'Back to companion growth'}><X size={18}/><span>{zh?'返回伙伴':'Back'}</span></button></header><iframe ref={frame} src={url} title={zh?'伙伴乐园实时 3D 场景':'Companion island in real-time 3D'} allow="autoplay"/></div>,document.body)}
  </>;
}
