import { useRef, useState } from 'react';
import type { CatalogExercise, Language } from '../types';

export default function ExerciseVideo({ exercise, lang }: { exercise: CatalogExercise; lang: Language }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const zh = lang === 'zh';
  if (!exercise.video) return null;
  return <section className="exercise-animation exercise-video" aria-label={zh ? '动作动画' : 'Exercise animation'}>
    <video ref={ref} src={exercise.video.src} poster={exercise.video.poster} controls muted loop playsInline preload="none" onError={() => setFailed(true)} onLoadedData={() => setFailed(false)} aria-label={zh ? `${exercise.nameZh ?? exercise.name}动作动画` : `${exercise.name} animation`}>
      {zh ? '浏览器不支持此视频，请阅读动作步骤。' : 'Your browser cannot play this video. Read the instructions below.'}
    </video>
    {failed ? <div role="status"><p className="hint">{zh ? '动画暂时无法加载；可继续阅读步骤，联网后重试。' : 'The animation could not load. Read the steps, or retry when connected.'}</p><button type="button" className="btn btn-secondary" onClick={() => { setFailed(false); ref.current?.load(); }}>{zh ? '重试动画' : 'Retry animation'}</button></div> : null}
    <p className="hint">{zh ? '点播放查看动作；可暂停或拖动进度。' : 'Press play to view the movement; pause or seek at any time.'}</p>
    <p className="exercise-credit">{exercise.video.credit}</p>
  </section>;
}
