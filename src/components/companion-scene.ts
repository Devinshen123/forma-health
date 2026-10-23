import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import type { CompanionCharacter, CompanionItem } from '../companion';
import { companionForm, companionGrowthStage, COMPANION_ART_VERSION } from '../companion-growth';

// Only the selected form is requested. No CDN dependency or health/account data enters this loader.
export async function createCompanionModel(character: CompanionCharacter, equipped: CompanionItem | null, level: number, signal?: AbortSignal) {
  const form = companionForm(character, level);
  const decoder = new DRACOLoader().setDecoderPath('/companions/draco/');
  const loader = new GLTFLoader().setDRACOLoader(decoder);
  let gltf;
  try {
    const response = await fetch(`/companions/models/${form.dex}.glb${COMPANION_ART_VERSION}`, { signal });
    if (!response.ok) throw new Error('Companion model unavailable');
    gltf = await loader.parseAsync(await response.arrayBuffer(), '/companions/models/');
  } finally { decoder.dispose(); }
  if (signal?.aborted) { disposeScene(gltf.scene); throw new DOMException('Aborted', 'AbortError'); }
  const root = new T.Group(), body = new T.Group(), mesh = gltf.scene;
  root.add(body); body.add(mesh);
  if (form.dex === 446) {
    mesh.getObjectByName('LShoulder_013')?.rotateZ(-.85);
    mesh.getObjectByName('RShoulder_018')?.rotateZ(.85);
    // This source atlas exports the two eyes in different expression columns.
    // Select the same open-eye column for both, keeping the atlas's eyelid shape.
    mesh.traverse(object => {
      if (!(object instanceof T.Mesh) || Array.isArray(object.material) || object.material.name !== 'REye') return;
      const uv = object.geometry.getAttribute('uv');
      let mean = 0; for (let i = 0; i < uv.count; i++) mean += uv.getX(i) / uv.count;
      const column = Math.floor(mean * 4) / 4;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) - column);
      uv.needsUpdate = true;
    });
  }
  const mixer = new T.AnimationMixer(mesh);
  const idleClip = T.AnimationClip.findByName(gltf.animations, 'idle');
  const happyClip = T.AnimationClip.findByName(gltf.animations, 'happy');
  const idle = idleClip ? mixer.clipAction(idleClip).play() : null;
  // Evaluate a real idle pose before measuring the skinned mesh, not its bind/T-pose.
  mixer.update(.1); mesh.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(mesh, true), size = bounds.getSize(new T.Vector3());
  const scale = 2.65 / Math.max(size.x, size.y, size.z);
  mesh.scale.multiplyScalar(scale);
  mesh.position.set(-(bounds.min.x + bounds.max.x) * scale / 2, -bounds.min.y * scale, -(bounds.min.z + bounds.max.z) * scale / 2);
  mesh.traverse(object => {
    if (object instanceof T.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof T.MeshStandardMaterial) { material.metalness = 0; material.roughness = Math.max(.68, material.roughness); }
    }
  });
  // Keepsakes sit beside the model so they cannot obscure eyes or intersect a different evolved head.
  if (equipped) {
    const charm = new T.Group(); charm.name = `keepsake:${equipped}`; charm.position.set(-1.08, .20, .8);
    const colors = { leaf: '#9fbd79', cap: '#a9cbd8', star: '#edce73', scarf: '#d5a28a', flower: '#edb7cb', crown: '#edce73' };
    const material = new T.MeshStandardMaterial({ color: colors[equipped], roughness: .75 });
    const shape = new T.Shape();
    const points = equipped === 'star' || equipped === 'crown' ? 10 : equipped === 'flower' ? 40 : 32;
    for (let i = 0; i < points; i++) {
      const a = Math.PI / 2 + i * 2 * Math.PI / points;
      const r = equipped === 'star' || equipped === 'crown' ? (i % 2 ? .08 : .18) : equipped === 'flower' ? .13 + .04 * Math.cos(a * 5) : .14;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (!i) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const token = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: .055, bevelEnabled: true, bevelSize: .014, bevelThickness: .014, bevelSegments: 3, steps: 1 }), material);
    charm.add(token); body.add(charm);
  }
  let happy: T.AnimationAction | null = null;
  const finishHappy = () => { if (happy) { happy.fadeOut(.2); idle?.reset().fadeIn(.2).play(); } };
  mixer.addEventListener('finished', finishHappy);
  return {
    root, body, stage: companionGrowthStage(level, character), dex: form.dex,
    update(delta: number) { mixer.update(Math.min(delta, .06)); },
    greet() {
      if (!happyClip) return;
      happy?.stop(); happy = mixer.clipAction(happyClip); happy.reset().setLoop(T.LoopOnce, 1); happy.clampWhenFinished = true;
      idle?.fadeOut(.2); happy.fadeIn(.2).play();
    },
    dispose() { mixer.removeEventListener('finished', finishHappy); mixer.stopAllAction(); mixer.uncacheRoot(mesh); disposeScene(root); },
  };
}

export function fitCompanionCamera(camera: T.PerspectiveCamera, model: T.Object3D, aspect: number) {
  model.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(model, true), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
  const tan = Math.tan(camera.fov * Math.PI / 360), pitch = .10;
  const height = size.y * Math.cos(pitch) + size.z * Math.sin(pitch), depth = size.z * Math.cos(pitch) + size.y * Math.sin(pitch);
  const distance = (Math.max(height / (2 * tan), size.x / (2 * tan * aspect)) + depth / 2) * 1.19;
  camera.aspect = aspect; camera.position.set(center.x, center.y + Math.sin(pitch) * distance, center.z + Math.cos(pitch) * distance); camera.lookAt(center); camera.updateProjectionMatrix();
}

export function disposeScene(scene: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>(), skeletons = new Set<T.Skeleton>();
  scene.traverse(object => {
    if (object instanceof T.SkinnedMesh) skeletons.add(object.skeleton);
    if (object instanceof T.Mesh) {
      geometries.add(object.geometry);
      for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(mat); for (const value of Object.values(mat)) if (value instanceof T.Texture) textures.add(value);
      }
    }
  });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  const bitmaps = new Set<ImageBitmap>();
  textures.forEach(texture => { if (typeof ImageBitmap !== 'undefined' && texture.source.data instanceof ImageBitmap) bitmaps.add(texture.source.data); texture.dispose(); });
  bitmaps.forEach(bitmap => bitmap.close()); skeletons.forEach(skeleton => skeleton.dispose());
}
export { T };
