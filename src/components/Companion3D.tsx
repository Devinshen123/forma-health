import { useEffect, useRef, useState } from 'react';
import { Heart, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import type { CompanionCharacter, CompanionItem } from '../companion';
import { COMPANION_CHARACTER_DETAILS } from '../companion';
import CompanionAvatar from './CompanionAvatar';

interface Props { character: CompanionCharacter; equipped: CompanionItem | null; level: number; zh: boolean }
type SceneHandle = { rotate: (delta: number) => void; pet: () => void; reset: () => void; refresh: () => void };

export default function Companion3D(props: Props) {
  // Each character/stage owns its resources. Late imports cannot mount into another identity.
  return <CompanionScene key={`${props.character}:${props.equipped}:${props.level}`} {...props} />;
}

function CompanionScene({ character, equipped, level, zh }: Props) {
  const host = useRef<HTMLDivElement>(null), sceneHandle = useRef<SceneHandle | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [revision, setRevision] = useState(0), [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const [greeting, setGreeting] = useState(false);
  const name = COMPANION_CHARACTER_DETAILS[character][zh ? 'zh' : 'en'];

  useEffect(() => {
    let disposed = false, cleanup = () => {};
    const element = host.current;
    if (!element) return;
    setStatus('loading');
    void import('./companion-scene').then(({ T, createCompanionModel, disposeScene, fitCompanionCamera }) => {
      if (disposed) return;
      let renderer: InstanceType<typeof T.WebGLRenderer>;
      try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
      catch { setStatus('fallback'); return; }
      const canvas = renderer.domElement;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x000000, 0); renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      canvas.setAttribute('aria-hidden', 'true'); canvas.dataset.testid = 'companion-3d-canvas';
      element.appendChild(canvas);
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(35, 1, .1, 30); camera.position.set(0, 2.15, character === 'bunny' ? 6.4 : 5.8); camera.lookAt(0, character === 'bunny' ? 1.46 : 1.18, 0);
      scene.add(new T.HemisphereLight('#fff7ef', '#e4d9cf', 2));
      const key = new T.DirectionalLight('#fff2e3', 2.5); key.position.set(-3, 6, 5);
      scene.add(key);
      const fill = new T.DirectionalLight('#eef0ff', 1.4); fill.position.set(3, 3, -3); scene.add(fill);
      const platform = new T.Mesh(new T.SphereGeometry(1, 48, 24), new T.MeshStandardMaterial({ color: '#f0e7d9', roughness: 1 })); platform.scale.set(1.3, .10, .98); platform.position.y = -.07; scene.add(platform);
      // A soft contact shadow, without the jagged directional shadow of the old model.
      const shadowPixels = new Uint8Array(64 * 64 * 4);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const i = (y * 64 + x) * 4, r = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5); shadowPixels.set([105, 91, 75, Math.round(Math.pow(Math.max(0, 1 - r * r), 3) * 56)], i); }
      const shadowTexture = new T.DataTexture(shadowPixels, 64, 64); shadowTexture.needsUpdate = true;
      const floor = new T.Mesh(new T.PlaneGeometry(2.6, 2.0), new T.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.y = .035; scene.add(floor);
      const model = createCompanionModel(character, equipped, level); scene.add(model.root);
      let angle = 0, petStarted = -10000, frame = 0, lastFrame = 0, onScreen = true, drag: { x: number; y: number; angle: number; moved: boolean; pointer: number } | null = null;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      const rotate = (delta: number) => { angle += delta; draw(performance.now()); };
      const pet = () => { petStarted = performance.now(); setGreeting(true); draw(petStarted); };
      const reset = () => { angle = 0; draw(performance.now()); };
      sceneHandle.current = { rotate, pet, reset, refresh: () => syncLoop() };
      function draw(now: number) {
        const t = now / 1000, animate = !pausedRef.current && !reduced.matches;
        const bounce = animate ? Math.max(0, 1 - (now - petStarted) / 1300) : 0;
        model.root.rotation.y = angle + (animate ? Math.sin(t * .55) * .075 : 0);
        model.body.position.y = (animate ? Math.sin(t * 1.8) * .025 : 0) + Math.abs(Math.sin((now - petStarted) / 115)) * bounce * .22;
        model.body.scale.setScalar(1 + (animate ? Math.sin(t * 1.8) * .008 : 0));
        model.head.rotation.z = animate ? Math.sin(t * .85) * .035 + bounce * .1 : 0;
        model.eyes.scale.y = animate && t % 5 < .13 ? .13 : 1;
        model.arms[1].rotation.z = animate ? -bounce * (.65 + Math.sin(t * 16) * .25) : 0;
        model.satellites.rotation.y = animate ? Math.sin(t * .5) * .2 : 0;
        canvas.dataset.rotation = angle.toFixed(2); canvas.dataset.stage = String(model.stage); canvas.dataset.motion = animate ? 'playing' : 'paused';
        renderer.render(scene, camera);
      }
      const tick = (now: number) => { frame = requestAnimationFrame(tick); if (now - lastFrame < 33) return; lastFrame = now; draw(now); };
      const syncLoop = () => {
        cancelAnimationFrame(frame); frame = 0;
        if (!document.hidden && onScreen) { draw(performance.now()); if (!pausedRef.current && !reduced.matches) frame = requestAnimationFrame(tick); }
      };
      const resize = new ResizeObserver(() => { const { width, height } = element.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); fitCompanionCamera(camera, model.root, width / height); syncLoop(); });
      resize.observe(element);
      const intersection = new IntersectionObserver(entries => { onScreen = entries[0].isIntersecting; syncLoop(); }); intersection.observe(element);
      const down = (event: PointerEvent) => { if (event.button !== 0) return; drag = { x: event.clientX, y: event.clientY, angle, moved: false, pointer: event.pointerId }; };
      const move = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.pointer) return;
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
      const cancel = () => { drag = null; };
      const contextLost = (event: Event) => { event.preventDefault(); setStatus('fallback'); cancelAnimationFrame(frame); };
      canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('pointerleave', cancel);
      canvas.addEventListener('webglcontextlost', contextLost);
      document.addEventListener('visibilitychange', syncLoop); reduced.addEventListener('change', syncLoop);
      cleanup = () => {
        cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', syncLoop); reduced.removeEventListener('change', syncLoop);
        canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('pointerleave', cancel); canvas.removeEventListener('webglcontextlost', contextLost);
        sceneHandle.current = null; disposeScene(scene); shadowTexture.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
      };
      draw(performance.now()); syncLoop(); setStatus('ready');
    }).catch(() => { if (!disposed) setStatus('fallback'); });
    return () => { disposed = true; cleanup(); };
  }, [character, equipped, level, revision]);

  useEffect(() => { sceneHandle.current?.refresh(); }, [paused]);
  useEffect(() => { if (!greeting) return; const timer = window.setTimeout(() => setGreeting(false), 1800); return () => window.clearTimeout(timer); }, [greeting]);
  return <div className="companion-3d" data-testid="companion-3d" data-character={character} data-level={level} data-status={status}>
    <div className="companion-3d-viewport" ref={host} role="img" aria-label={zh ? `${name}的实时 3D 形象，等级 ${level}` : `${name} in real-time 3D, level ${level}`} />
    {status !== 'ready' && <div className="companion-3d-fallback"><CompanionAvatar character={character} equipped={equipped} level={level} /><span role="status">{status === 'loading' ? (zh ? '正在唤醒 3D 伙伴…' : 'Waking up your 3D friend…') : (zh ? '当前设备暂时无法显示 3D，已显示伙伴图片。' : '3D is unavailable on this device. Showing your companion portrait.')}</span>{status === 'fallback' && <button className="text-button" onClick={() => setRevision(value => value + 1)}>{zh ? '重试 3D' : 'Retry 3D'}</button>}</div>}
    <span className="companion-3d-greeting" role="status">{greeting ? (zh ? '好开心，你来啦 ♡' : 'Happy to see you ♡') : ''}</span>
    <p className="companion-3d-hint">{zh ? '左右拖动看一看 · 轻点和我打招呼' : 'Drag to turn · tap to say hello'}</p>
    <div className="companion-3d-controls" role="group" aria-label={zh ? '3D 伙伴操作' : '3D companion controls'}>
      <button type="button" disabled={status !== 'ready'} aria-label={zh ? '向左旋转' : 'Rotate left'} onClick={() => sceneHandle.current?.rotate(-Math.PI / 4)}><RotateCcw size={16} /></button>
      <button type="button" disabled={status !== 'ready'} aria-label={zh ? '向右旋转' : 'Rotate right'} onClick={() => sceneHandle.current?.rotate(Math.PI / 4)}><RotateCw size={16} /></button>
      <button type="button" disabled={status !== 'ready'} onClick={() => { sceneHandle.current?.pet(); setGreeting(true); }}><Heart size={15} />{zh ? '摸摸' : 'Say hello'}</button>
      <button type="button" disabled={status !== 'ready'} aria-label={zh ? (paused ? '播放伙伴动画' : '暂停伙伴动画') : (paused ? 'Play animation' : 'Pause animation')} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
      <button type="button" disabled={status !== 'ready'} onClick={() => sceneHandle.current?.reset()}>{zh ? '正面' : 'Front'}</button>
    </div>
  </div>;
}
