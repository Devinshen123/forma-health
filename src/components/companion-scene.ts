import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCompanionAnimator, type CompanionAction } from './companion-animation';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import type { CompanionCharacter, CompanionItem } from '../companion';
import { companionForm, companionGrowthStage, COMPANION_ART_VERSION } from '../companion-growth';

// Only the selected form is requested. No CDN dependency or health/account data enters this loader.
export async function createCompanionModel(character: CompanionCharacter, equipped: CompanionItem | null, level: number, signal?: AbortSignal, onActionChange: (action: CompanionAction) => void = () => {}) {
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
  const eyeUvs: { attribute: T.BufferAttribute | T.InterleavedBufferAttribute; values: Float32Array }[] = [];
  if (form.dex === 446) mesh.traverse(object => {
    if (object instanceof T.Mesh && !Array.isArray(object.material) && object.material.name === 'REye') {
      const attribute = object.geometry.getAttribute('uv');
      eyeUvs.push({ attribute, values: Float32Array.from({ length: attribute.count }, (_, i) => attribute.getY(i)) });
    }
  });
  const animator = createCompanionAnimator(mesh, gltf.animations, action => {
    for (const { attribute, values } of eyeUvs) { for (let i = 0; i < attribute.count; i++) attribute.setY(i, values[i] + (action === 'sleep' ? .5 : 0)); attribute.needsUpdate = true; }
    onActionChange(action);
  });
  animator.update(.1); mesh.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(mesh, true), size = bounds.getSize(new T.Vector3());
  const scale = 2.65 / Math.max(size.x, size.y, size.z);
  mesh.scale.multiplyScalar(scale);
  mesh.position.set(-(bounds.min.x + bounds.max.x) * scale / 2, -bounds.min.y * scale, -(bounds.min.z + bounds.max.z) * scale / 2);
  const materials = new Map<T.Material, T.MeshPhysicalMaterial>();
  mesh.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    object.castShadow = true; object.receiveShadow = true;
    const upgrade = (original: T.Material) => {
      if (!(original instanceof T.MeshStandardMaterial)) return original;
      if (materials.has(original)) return materials.get(original)!;
      const eye = /eye/i.test(original.name), fur = [133,134,135,136].includes(form.dex);
      const physical = new T.MeshPhysicalMaterial({
        name: original.name, color: original.color, map: original.map,
        normalMap: original.normalMap, normalScale: original.normalScale.clone().multiplyScalar(.65),
        roughnessMap: original.roughnessMap, metalness: 0, roughness: eye ? (form.dex === 446 ? .48 : .28) : fur ? .86 : form.dex === 446 ? .73 : .57,
        emissive: original.emissive, emissiveMap: original.emissiveMap, emissiveIntensity: original.emissiveIntensity,
        alphaMap: original.alphaMap, alphaTest: original.alphaTest, transparent: original.transparent, opacity: original.opacity,
        side: original.side, depthWrite: original.depthWrite, vertexColors: original.vertexColors,
        clearcoat: eye ? (form.dex === 446 ? .08 : .28) : fur ? 0 : .045, clearcoatRoughness: .36,
        sheen: fur && !eye ? .22 : 0, sheenColor: new T.Color('#e1d3c0'), sheenRoughness: .85, envMapIntensity: eye && form.dex === 446 ? .25 : .8,
      });
      materials.set(original, physical); return physical;
    };
    object.material = Array.isArray(object.material) ? object.material.map(upgrade) : upgrade(object.material);
  });
  materials.forEach((_, original) => original.dispose());
  if (form.dex === 446) {
    // Repair the source's hidden feet; attach in world space so the authored leg tracks carry them.
    for (const [boneName, side] of [['LFoot_025', 1], ['RFoot_032', -1]] as const) {
      const foot = new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.MeshPhysicalMaterial({ color: '#f1d49a', roughness: .72 }));
      foot.name = `repaired:${boneName}`; foot.scale.set(.18, .11, .25); foot.position.set(side * .34, .105, .48);
      foot.castShadow = true; foot.receiveShadow = true; body.add(foot); root.updateMatrixWorld(true);
      mesh.getObjectByName(boneName)?.attach(foot);
    }
  }
  // Keepsakes sit beside the model so they cannot obscure eyes or intersect a different evolved head.
  if (equipped) {
    const charm = new T.Group(); charm.name = `keepsake:${equipped}`; charm.position.set(-1.08, .20, .8);
    const colors = { leaf: '#9fbd79', cap: '#a9cbd8', star: '#edce73', scarf: '#d5a28a', flower: '#edb7cb', crown: '#edce73' };
    const material = new T.MeshStandardMaterial({ color: colors[equipped], roughness: .75 });
    const shape = new T.Shape();
    if (equipped === 'leaf') {
      shape.moveTo(-.14, -.12); shape.bezierCurveTo(-.22, .15, .03, .25, .17, .15); shape.bezierCurveTo(.19, -.08, .06, -.19, -.14, -.12);
    } else if (equipped === 'cap') {
      shape.moveTo(-.19, -.04); shape.quadraticCurveTo(-.15, .21, .09, .15); shape.quadraticCurveTo(.18, .10, .16, -.02); shape.lineTo(.27, -.06); shape.lineTo(.27, -.10); shape.lineTo(-.19, -.10);
    } else if (equipped === 'scarf') {
      shape.moveTo(-.17, .10); shape.lineTo(.17, .10); shape.lineTo(.17, -.01); shape.lineTo(.10, -.01); shape.lineTo(.15, -.22); shape.lineTo(.02, -.24); shape.lineTo(-.02, -.01); shape.lineTo(-.17, -.01);
    } else if (equipped === 'crown') {
      for (const [i, point] of [[-.18,-.1],[-.23,.15],[-.10,.05],[0,.23],[.10,.05],[.23,.15],[.18,-.1]].entries()) { if (!i) shape.moveTo(...point as [number,number]); else shape.lineTo(...point as [number,number]); }
    } else {
      const points = equipped === 'star' ? 10 : 40;
      for (let i = 0; i < points; i++) {
        const a = Math.PI / 2 + i * 2 * Math.PI / points, r = equipped === 'star' ? (i % 2 ? .08 : .18) : .13 + .04 * Math.cos(a * 5);
        if (!i) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
    }
    shape.closePath();
    const token = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: .055, bevelEnabled: true, bevelSize: .014, bevelThickness: .014, bevelSegments: 3, steps: 1 }), material);
    charm.add(token); body.add(charm);
  }
  return {
    root, body, stage: companionGrowthStage(level, character), dex: form.dex,
    get action() { return animator.action; },
    actions: animator.actions,
    update(delta: number) { animator.update(delta); },
    look(x: number, y: number) { animator.look(x, y); },
    play(action: CompanionAction, still = false) { animator.play(action, still); },
    greet(still = false) { animator.play(animator.action === 'sleep' ? 'idle' : 'happy', still); },
    dispose() { animator.dispose(); disposeScene(root); },
  };

}

export function fitCompanionCamera(camera: T.PerspectiveCamera, model: T.Object3D | T.Box3, aspect: number) {
  if (!(model instanceof T.Box3)) model.updateMatrixWorld(true);
  const bounds = model instanceof T.Box3 ? model : new T.Box3().setFromObject(model, true), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
  const tan = Math.tan(camera.fov * Math.PI / 360), pitch = .10;
  const height = size.y * Math.cos(pitch) + size.z * Math.sin(pitch), depth = size.z * Math.cos(pitch) + size.y * Math.sin(pitch);
  const distance = (Math.max(height / (2 * tan), size.x / (2 * tan * aspect)) + depth / 2) * 1.19;
  camera.aspect = aspect; camera.position.set(center.x, center.y + Math.sin(pitch) * distance, center.z + Math.cos(pitch) * distance); camera.lookAt(center); camera.updateProjectionMatrix();
}

export function disposeScene(scene: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>(), skeletons = new Set<T.Skeleton>();
  scene.traverse(object => {
    if (object instanceof T.DirectionalLight) object.shadow.dispose();
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
export function installCompanionLighting(renderer: T.WebGLRenderer, scene: T.Scene, shadowSize = 512) {
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .96;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.VSMShadowMap;
  const room = new RoomEnvironment(), generator = new T.PMREMGenerator(renderer);
  const environment = generator.fromScene(room, .04); generator.dispose(); room.dispose();
  scene.environment = environment.texture; scene.environmentIntensity = .7;
  scene.add(new T.HemisphereLight('#fff7ed', '#cdd8e0', .65));
  const key = new T.DirectionalLight('#fff0dc', 2.6); key.position.set(-3, 6, 5); key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize); key.shadow.radius = 3; key.shadow.blurSamples = 8;
  key.shadow.bias = -.0002; key.shadow.normalBias = .025;
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: .1, far: 18 });
  key.shadow.camera.updateProjectionMatrix(); scene.add(key);
  const fill = new T.DirectionalLight('#dbe9ff', 1.0); fill.position.set(4, 3, -3); scene.add(fill);
  return () => { scene.environment = null; environment.dispose(); };
}
export { T };
