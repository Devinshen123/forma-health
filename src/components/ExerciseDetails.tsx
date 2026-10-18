import { useEffect, useState } from 'react';
import type { CatalogExercise, Language } from '../types';
import { parseExerciseContent, type ExerciseContent } from '../catalog/content';
import ExerciseAnimation from './ExerciseAnimation';

type ContentState = { id: string; content?: ExerciseContent; error?: boolean };

export default function ExerciseDetails({ exercise, lang }: { exercise: CatalogExercise; lang: Language }) {
  const zh = lang === 'zh';
  const [state, setState] = useState<ContentState>({ id: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!exercise.instructionUrl || !exercise.sourceId) return;
    const controller = new AbortController();
    setState({ id: exercise.id });
    void (async () => {
      try {
        const response = await fetch(exercise.instructionUrl!, { signal: controller.signal });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw Error('Content unavailable');
        const content = parseExerciseContent(await response.json(), exercise.sourceId!);
        if (!controller.signal.aborted) setState({ id: exercise.id, content });
      } catch {
        if (!controller.signal.aborted) setState({ id: exercise.id, error: true });
      }
    })();
    return () => controller.abort();
  }, [exercise.id, exercise.sourceId, exercise.instructionUrl, attempt]);
  const remote = !!exercise.instructionUrl;
  const content = state.id === exercise.id ? state.content : undefined;
  const failed = state.id === exercise.id && state.error;
  const translated = remote ? content?.instructionsZh : exercise.instructionsZh;
  const instructions = zh && translated ? translated : remote ? content?.instructions : exercise.instructions;
  const description = zh && content?.descriptionZh ? content.descriptionZh : content?.description;
  return <div className="stack exercise-details">
    {exercise.video || exercise.animation ? <ExerciseAnimation exercise={exercise} lang={lang} /> : <p className="hint">{zh ? '此动作提供文字说明，暂无动画。' : 'Text instructions are available; no animation for this exercise.'}</p>}
    {description ? <p>{description}</p> : null}
    {remote && !content && !failed ? <p className="hint" role="status">{zh ? '正在载入动作步骤…' : 'Loading exercise instructions…'}</p> : null}
    {failed ? <div role="status"><p className="hint">{zh ? '动作步骤暂时无法加载，请联网后重试。' : 'Instructions could not load. Retry when connected.'}</p><button className="btn btn-secondary" type="button" onClick={() => setAttempt(value => value + 1)}>{zh ? '重试步骤' : 'Retry instructions'}</button></div> : null}
    {instructions?.length ? <ol>{instructions.map((step, index) => <li key={index}>{step}</li>)}</ol> : null}
    {instructions?.length && zh && !translated ? <p className="hint">动作步骤保留来源英文，尚无中文版本。</p> : null}
  </div>;
}

export function ExerciseDisclosure(props: { exercise: CatalogExercise; lang: Language }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{props.lang === 'zh' ? '教学与说明' : 'Demonstration and instructions'}</summary>
    {open ? <ExerciseDetails {...props} /> : null}
  </details>;
}
