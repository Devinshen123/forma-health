import * as T from 'three';
export type CompanionAction = 'idle' | 'happy' | 'walk' | 'sleep';
export const COMPANION_ACTIONS = ['idle', 'happy', 'walk', 'sleep'] as const;

// Owns clip transitions and head tracking independently of rendering or account state.
export function createCompanionAnimator(root: T.Object3D, sourceClips: T.AnimationClip[], onChange: (action: CompanionAction) => void = () => {}) {
  const mixer = new T.AnimationMixer(root), clips = new Map(sourceClips.map(clip => [clip.name, clip]));
  const head = root.getObjectByName('head') ?? root.getObjectByName('Head_05');
  const arm = root.getObjectByName('RArm_019');
  const neutralHead = head?.quaternion.clone(), neutralArm = arm?.quaternion.clone();
  const inverseHeadBasis = head?.getWorldQuaternion(new T.Quaternion()).invert() ?? new T.Quaternion();
  // Imported rigs use different local axes. Derive gaze axes from world up/right.
  const yawAxis = new T.Vector3(0, 1, 0).applyQuaternion(inverseHeadBasis).normalize();
  const pitchAxis = new T.Vector3(1, 0, 0).applyQuaternion(inverseHeadBasis).normalize();
  // The one static upstream model receives real bone tracks, rather than claiming missing source clips.
  for (const action of COMPANION_ACTIONS) if (!clips.has(action)) {
    const duration = action === 'sleep' ? 5 : action === 'walk' ? 1.2 : action === 'happy' ? 1.8 : 4;
    const times = [0, duration / 4, duration / 2, duration * 3 / 4, duration];
    const tracks: T.KeyframeTrack[] = [];
    if (head && neutralHead) {
      const values = times.flatMap((_, index) => neutralHead.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(0, action === 'sleep' ? .18 + index % 2 * .015 : Math.sin(index * Math.PI / 2) * (action === 'happy' ? .13 : .025), 0))).toArray());
      tracks.push(new T.QuaternionKeyframeTrack(`${head.name}.quaternion`, times, values));
    }
    if (arm && neutralArm && action !== 'sleep') {
      const values = times.flatMap((_, index) => neutralArm.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(0, 0, Math.sin(index * Math.PI / 2) * (action === 'happy' ? .55 : action === 'walk' ? .22 : .015)))).toArray());
      tracks.push(new T.QuaternionKeyframeTrack(`${arm.name}.quaternion`, times, values));
    }
    if (action === 'walk') for (const [name, side] of [['LThigh_024', 1], ['RThigh_031', -1]] as const) {
      const leg = root.getObjectByName(name);
      if (!leg) continue;
      const neutral = leg.quaternion.clone();
      const values = times.flatMap((_, index) => neutral.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(0, Math.sin(index * Math.PI / 2) * side * .28, 0))).toArray());
      tracks.push(new T.QuaternionKeyframeTrack(`${name}.quaternion`, times, values));
    }
    clips.set(action, new T.AnimationClip(action, duration, tracks));
  }
  let current: CompanionAction = 'idle', disposed = false;
  let selected: T.AnimationAction | null = null;
  const target = new T.Vector2(), gaze = new T.Vector2(), zero = new T.Vector2(), offset = new T.Quaternion(), inverseOffset = new T.Quaternion(), pitchOffset = new T.Quaternion();
  let applied = false;
  const clearGaze = () => { if (head && applied) head.quaternion.multiply(inverseOffset.copy(offset).invert()); applied = false; };
  const play = (action: CompanionAction, still = false) => {
    if (disposed) return;
    clearGaze();
    const next = mixer.clipAction(clips.get(action)!);
    if (still) mixer.stopAllAction(); else if (selected && selected !== next) selected.fadeOut(.22);
    next.reset().setEffectiveWeight(1).setLoop(action === 'happy' ? T.LoopOnce : T.LoopRepeat, action === 'happy' ? 1 : action === 'walk' ? 2 : Infinity);
    next.clampWhenFinished = action === 'happy' || action === 'walk';
    if (!still) next.fadeIn(.22);
    next.play(); selected = next; current = action;
    if (still) { next.time = action === 'sleep' ? next.getClip().duration * .65 : .1; mixer.update(0); }
    onChange(action);
  };
  const finished = (event: { action: T.AnimationAction }) => { if (event.action === selected && (current === 'happy' || current === 'walk')) play('idle'); };
  mixer.addEventListener('finished', finished);
  play('idle', true);
  return {
    get action() { return current; },
    play,
    look(x: number, y: number) { target.set(T.MathUtils.clamp(x, -1, 1), T.MathUtils.clamp(y, -1, 1)); },
    update(delta: number) {
      if (disposed) return;
      clearGaze(); mixer.update(Math.min(Math.max(0, delta), .06));
      const sleeping = current === 'sleep';
      gaze.lerp(sleeping ? zero : target, 1 - Math.exp(-delta * 8));
      if (head) {
        // Small offsets preserve the authored expression and never twist the neck through a full turn.
        offset.setFromAxisAngle(yawAxis, gaze.x * .16).multiply(pitchOffset.setFromAxisAngle(pitchAxis, gaze.y * .10));
        head.quaternion.multiply(offset); applied = true;
      }
    },
    dispose() { disposed = true; clearGaze(); mixer.removeEventListener('finished', finished); mixer.stopAllAction(); mixer.uncacheRoot(root); },
  };
}
