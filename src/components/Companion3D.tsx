import { useEffect, useRef, useState } from 'react';
import { Heart, Pause, Play, RotateCcw, RotateCw, Footprints, Moon, Sun, ZoomIn, ZoomOut } from 'lucide-react';
import type { CompanionCharacter, CompanionItem } from '../companion';
import { companionForm } from '../companion-growth';
import CompanionAvatar from './CompanionAvatar';
import type { CompanionAction } from './companion-animation';

interface Props { character: CompanionCharacter; equipped: CompanionItem | null; level: number; zh: boolean; suspended?:boolean }
type SceneHandle = { rotate: (delta: number) => void; pet: () => void; reset: () => void; refresh: () => void; interact: (action: CompanionAction) => void; zoom: (delta: number) => void };

export default function Companion3D(props: Props) {
  // Each character/stage owns its resources. Late imports cannot mount into another identity.
  return <CompanionScene key={`${props.character}:${props.equipped}:${companionForm(props.character, props.level).dex}`} {...props} />;
}

function CompanionScene({ character, equipped, level, zh, suspended=false }: Props) {
  const host = useRef<HTMLDivElement>(null), sceneHandle = useRef<SceneHandle | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [revision, setRevision] = useState(0), [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const suspendedRef=useRef(suspended);suspendedRef.current=suspended;
  const [action, setAction] = useState<CompanionAction>('idle');
  const [availableActions, setAvailableActions] = useState<CompanionAction[]>([]);
  const [greeting, setGreeting] = useState(false);
  const form = companionForm(character, level), name = form[zh ? 'zh' : 'en'];

  useEffect(() => {
    let disposed = false, cleanup = () => {};
    const controller = new AbortController();
    const element = host.current;
    if (!element) return;
    setStatus('loading');
    void import('./companion-scene').then(async ({ T, createCompanionModel, disposeScene, fitCompanionCamera, installCompanionLighting }) => {
      if (disposed) return;
      const model = await createCompanionModel(character, equipped, form.level, controller.signal, next => { if (!disposed) setAction(next); });
      if (disposed) { model.dispose(); return; }
      setAvailableActions([...model.actions]);
      let renderer: InstanceType<typeof T.WebGLRenderer>;
      try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
      catch { model.dispose(); setStatus('fallback'); return; }
      const canvas = renderer.domElement;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x000000, 0); renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      canvas.setAttribute('aria-hidden', 'true'); canvas.dataset.testid = 'companion-3d-canvas';
      element.appendChild(canvas);
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(35, 1, .1, 30); camera.position.set(0, 2.15, character === 'bunny' ? 6.4 : 5.8); camera.lookAt(0, character === 'bunny' ? 1.46 : 1.18, 0);
      let disposeLighting = () => {};
      cleanup = () => { sceneHandle.current = null; model.dispose(); disposeScene(scene); disposeLighting(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); };
      disposeLighting = installCompanionLighting(renderer, scene, element.clientWidth < 600 ? 512 : 1024);
      const platform = new T.Mesh(new T.CylinderGeometry(1.35, 1.4, .12, 80), new T.MeshStandardMaterial({ color: '#e7dfd2', roughness: .78 }));
      platform.position.y = -.065; platform.castShadow = true; platform.receiveShadow = true; scene.add(platform);
      const floor = new T.Mesh(new T.PlaneGeometry(8, 8), new T.ShadowMaterial({ color: '#6b645e', opacity: .22, depthWrite: false }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -.13; floor.receiveShadow = true; scene.add(floor);
      scene.add(model.root);
      model.root.updateMatrixWorld(true);
      const framing = new T.Box3().setFromObject(model.root, true), cameraTarget = framing.getCenter(new T.Vector3()), cameraBase = new T.Vector3();
      fitCompanionCamera(camera, framing, 1); cameraBase.copy(camera.position);
      let zoom = 1, animationTime = performance.now();
      let angle = 0, petStarted = -10000, frame = 0, lastFrame = 0, onScreen = true, drag: { x: number; y: number; angle: number; moved: boolean; pointer: number } | null = null;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      const rotate = (delta: number) => { angle += delta; draw(performance.now()); };
      const resumeForInteraction = () => { if (!reduced.matches) { pausedRef.current = false; setPaused(false); } };
      const pet = () => { resumeForInteraction(); petStarted = performance.now(); model.greet(reduced.matches); setGreeting(true); syncLoop(); };
      const interact = (next: CompanionAction) => { resumeForInteraction(); model.play(next, reduced.matches); syncLoop(); };
      const adjustZoom = () => { camera.position.copy(cameraBase).sub(cameraTarget).multiplyScalar(1 / zoom).add(cameraTarget); camera.lookAt(cameraTarget); };
      const changeZoom = (delta: number) => { zoom = T.MathUtils.clamp(zoom + delta, .8, 1.45); adjustZoom(); draw(performance.now()); };
      const reset = () => { angle = 0; zoom = 1; adjustZoom(); model.look(0, 0); draw(performance.now()); };
      sceneHandle.current = { rotate, pet, reset, refresh: () => syncLoop(), interact, zoom: changeZoom };
      function draw(now: number) {
        const t = now / 1000, animate = !pausedRef.current && !reduced.matches;
        const bounce = animate && model.action === 'happy' ? Math.max(0, 1 - (now - petStarted) / 1300) : 0;
        model.root.rotation.y = angle + (animate ? Math.sin(t * .55) * .075 : 0);
        const breathing = model.action === 'sleep' ? .7 : 1.8;
        model.body.position.y = (animate ? Math.sin(t * breathing) * .018 : 0) + Math.abs(Math.sin((now - petStarted) / 115)) * bounce * .22;
        model.body.scale.setScalar(1 + (animate ? Math.sin(t * breathing) * .008 : 0));
        if (animate) model.update(Math.min((now - animationTime) / 1000, .06));
        animationTime = now;
        canvas.dataset.action = model.action; canvas.dataset.zoom = zoom.toFixed(2); canvas.dataset.rotation = angle.toFixed(2); canvas.dataset.stage = String(model.stage); canvas.dataset.form = String(model.dex); canvas.dataset.motion = animate ? 'playing' : 'paused';
        renderer.render(scene, camera);
      }
      const tick = (now: number) => { frame = requestAnimationFrame(tick); if (now - lastFrame < 33) return; lastFrame = now; draw(now); };
      const syncLoop = () => {
        cancelAnimationFrame(frame); frame = 0;
        if (!document.hidden && onScreen && !suspendedRef.current) { draw(performance.now()); if (!pausedRef.current && !reduced.matches) frame = requestAnimationFrame(tick); }
      };
      const resize = new ResizeObserver(() => { const { width, height } = element.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); fitCompanionCamera(camera, framing, width / height); cameraBase.copy(camera.position); adjustZoom(); syncLoop(); });
      resize.observe(element);
      const intersection = new IntersectionObserver(entries => { onScreen = entries[0].isIntersecting; syncLoop(); }); intersection.observe(element);
      const down = (event: PointerEvent) => { if (event.button !== 0) return; drag = { x: event.clientX, y: event.clientY, angle, moved: false, pointer: event.pointerId }; };
      const move = (event: PointerEvent) => {
        if (!drag) { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; model.look((event.clientX - rect.left) / rect.width * 2 - 1, (event.clientY - rect.top) / rect.height * 2 - 1); return; }
        if (event.pointerId !== drag.pointer) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.moved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { drag = null; return; }
        if (Math.abs(dx) > 6) { drag.moved = true; canvas.setPointerCapture(event.pointerId); }
        if (drag.moved) { angle = drag.angle + dx * .012; draw(performance.now()); }
      };
      const up = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.pointer) return;
        if (!drag.moved) pet();
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        drag = null;
      };
      const cancel = () => { drag = null; model.look(0, 0); };
      const contextLost = (event: Event) => { event.preventDefault(); setStatus('fallback'); cancelAnimationFrame(frame); };
      canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('pointerleave', cancel);
      canvas.addEventListener('webglcontextlost', contextLost);
      document.addEventListener('visibilitychange', syncLoop); reduced.addEventListener('change', syncLoop);
      cleanup = () => {
        cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', syncLoop); reduced.removeEventListener('change', syncLoop);
        canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('pointerleave', cancel); canvas.removeEventListener('webglcontextlost', contextLost);
        sceneHandle.current = null; scene.remove(model.root); model.dispose(); disposeScene(scene); disposeLighting(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
      };
      draw(performance.now()); syncLoop(); setStatus('ready');
    }).catch(() => { cleanup(); if (!disposed) setStatus('fallback'); });
    return () => { disposed = true; controller.abort(); cleanup(); };
  }, [character, equipped, form.level, revision]);

  useEffect(() => { sceneHandle.current?.refresh(); }, [paused,suspended]);
  useEffect(() => { if (!greeting) return; const timer = window.setTimeout(() => setGreeting(false), 1800); return () => window.clearTimeout(timer); }, [greeting]);
  return <div className="companion-3d" data-testid="companion-3d" data-character={character} data-level={level} data-status={status} data-action={action}>
    <div className="companion-3d-viewport" ref={host} role="img" aria-label={zh ? `${name}的实时 3D 形象，等级 ${level}` : `${name} in real-time 3D, level ${level}`} />
    {status !== 'ready' && <div className="companion-3d-fallback"><CompanionAvatar character={character} equipped={equipped} level={level} /><span role="status">{status === 'loading' ? (zh ? '正在唤醒 3D 伙伴…' : 'Waking up your 3D friend…') : (zh ? '当前设备暂时无法显示 3D，已显示伙伴图片。' : '3D is unavailable on this device. Showing your companion portrait.')}</span>{status === 'fallback' && <button className="text-button" onClick={() => setRevision(value => value + 1)}>{zh ? '重试 3D' : 'Retry 3D'}</button>}</div>}
    <span className="companion-3d-greeting" role="status">{greeting ? (zh ? '好开心，你来啦 ♡' : 'Happy to see you ♡') : ''}</span>
    <p className="companion-3d-hint">{zh ? '拖动旋转 · 轻点回应 · 拉近看细节' : 'Drag to turn · tap to react · zoom in for details'}</p>
    <div className="companion-3d-controls" role="group" aria-label={zh ? '3D 伙伴操作' : '3D companion controls'}>
      <button type="button" disabled={status !== 'ready'} aria-label={zh ? '向左旋转' : 'Rotate left'} onClick={() => sceneHandle.current?.rotate(-Math.PI / 4)}><RotateCcw size={16} /></button>
      <button type="button" disabled={status !== 'ready'} aria-label={zh ? '向右旋转' : 'Rotate right'} onClick={() => sceneHandle.current?.rotate(Math.PI / 4)}><RotateCw size={16} /></button>
      <button type="button" disabled={status !== 'ready'} aria-label={zh ? '拉近观察' : 'Zoom in'} onClick={() => sceneHandle.current?.zoom(.15)}><ZoomIn size={16} /></button>
      <button type="button" disabled={status !== 'ready'} aria-label={zh ? '拉远观察' : 'Zoom out'} onClick={() => sceneHandle.current?.zoom(-.15)}><ZoomOut size={16} /></button>
      <button type="button" disabled={status !== 'ready'} aria-label={zh ? (paused ? '播放伙伴动画' : '暂停伙伴动画') : (paused ? 'Play animation' : 'Pause animation')} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
      <button type="button" disabled={status !== 'ready'} onClick={() => sceneHandle.current?.reset()}>{zh ? '正面' : 'Front'}</button>
    </div>
    <div className="companion-3d-actions" role="group" aria-label={zh ? '和伙伴互动' : 'Interact with your companion'}>
      <button type="button" disabled={status !== 'ready'} aria-pressed={action === 'happy'} onClick={() => sceneHandle.current?.pet()}><Heart size={16} />{zh ? '摸摸' : 'Pet'}</button>
      <button type="button" disabled={status !== 'ready'||!availableActions.includes('walk')} aria-pressed={action === 'walk'} onClick={() => sceneHandle.current?.interact('walk')}><Footprints size={16} />{zh ? '走两步' : 'Walk'}</button>
      <button type="button" disabled={status !== 'ready'||!availableActions.includes('sleep')} aria-pressed={action === 'sleep'} onClick={() => sceneHandle.current?.interact(action === 'sleep' ? 'idle' : 'sleep')}>{action === 'sleep' ? <Sun size={16} /> : <Moon size={16} />}{zh ? (action === 'sleep' ? '叫醒' : '打个盹') : (action === 'sleep' ? 'Wake up' : 'Nap')}</button>
    </div>
    <label className="companion-animation-picker">{zh?`${form.dex===446?'伙伴动画':'原始动画'} · ${availableActions.length} 段`:`${form.dex===446?'Companion':'Original'} animations · ${availableActions.length}`}<select aria-label={zh?'选择伙伴动画':'Choose companion animation'} disabled={status!=='ready'} value={action} onChange={event=>sceneHandle.current?.interact(event.target.value as CompanionAction)}>{availableActions.map(id=><option key={id} value={id}>{zh?{idle:'待机',happy:'开心',walk:'行走',sleep:'睡眠',run:'奔跑',attack:'招式展示'}[id]:{idle:'Idle',happy:'Happy',walk:'Walk',sleep:'Sleep',run:'Run',attack:'Move demonstration'}[id]}</option>)}</select></label>
    <p className="companion-3d-action-status" role="status">{action === 'sleep' ? (zh ? '睡着啦…轻点我就醒来。' : 'Zzz… tap me to wake up.') : action === 'walk'||action==='run' ? (zh ? '陪你活动一下，结束就回来。' : 'A little movement, then back to you.') : action==='attack'?(zh?'给你展示一个小招式。':'A little move to show you.'): action === 'happy' ? (zh ? '好开心，你来啦 ♡' : 'Happy to see you ♡') : (zh ? '在这里，陪着你。' : 'Right here with you.')}</p>
    {action === 'sleep' && <span className="companion-3d-zzz" aria-hidden="true">Z z z</span>}
  </div>;
}
