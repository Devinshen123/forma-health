import * as T from 'three';
import type { CompanionCharacter, CompanionItem } from '../companion';
import { companionGrowthStage } from '../companion-growth';

const palettes: Record<CompanionCharacter, [string, string, string]> = {
  sprout: ['#badb85', '#e9f2c8', '#779b51'], bunny: ['#fff0e1', '#fff8ee', '#efa9b6'],
  otter: ['#dba787', '#ffe2c1', '#ad7256'], cloud: ['#d9e9f5', '#f2f8ff', '#90b9d5'],
  bear: ['#e6bb72', '#ffebc4', '#bc8c4f'], seal: ['#c4bee7', '#f0e9ff', '#9294c6'],
};

export function createCompanionModel(character: CompanionCharacter, equipped: CompanionItem | null, level: number) {
  const root = new T.Group(), body = new T.Group(), head = new T.Group();
  root.add(body); body.add(head); head.position.y = 1.88;
  const [fur, cream, accent] = palettes[character];
  const materials = new Map<string, T.MeshStandardMaterial>();
  const material = (color: string, glossy = false) => {
    const key = color + glossy;
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness: glossy ? .18 : .57, metalness: 0 }));
    return materials.get(key)!;
  };
  const sphere = new T.SphereGeometry(1, 32, 24);
  function ball(parent: T.Object3D, color: string, p: [number, number, number], s: [number, number, number], glossy = false) {
    const mesh = new T.Mesh(sphere, material(color, glossy)); mesh.position.set(...p); mesh.scale.set(...s);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function ring(parent: T.Object3D, color: string, radius: number, tube: number, p: [number, number, number], arc = Math.PI * 2) {
    const mesh = new T.Mesh(new T.TorusGeometry(radius, tube, 8, 48, arc), material(color)); mesh.position.set(...p); parent.add(mesh); return mesh;
  }
  function leaf(parent: T.Object3D, p: [number, number, number], size: number, rotation: number, color = accent) {
    const mesh = ball(parent, color, p, [.17 * size, .42 * size, .075 * size]); mesh.rotation.z = rotation; return mesh;
  }
  function star(parent: T.Object3D, p: [number, number, number], size: number) {
    const shape = new T.Shape();
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = size * (i % 2 ? .48 : 1); const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y); }
    shape.closePath();
    const mesh = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: .045, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .02, bevelThickness: .02 }), material('#ffda7a'));
    mesh.position.set(...p); parent.add(mesh); return mesh;
  }
  const isSeal = character === 'seal', isCloud = character === 'cloud';
  ball(body, fur, [0, 1.03, 0], [isSeal ? .77 : .62, .83, .52]);
  ball(body, cream, [0, 1.03, .43], [.43, .55, .14]);
  ball(head, fur, [0, 0, 0], [.83, .73, .64]);
  const arms: T.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new T.Group(); arm.position.set(side * .57, 1.35, .02); body.add(arm); arms.push(arm);
    ball(arm, fur, [side * .12, -.2, .03], [isSeal ? .19 : .18, .36, .22]).rotation.z = side * (isSeal ? -.65 : .3);
    ball(body, fur, [side * .33, .24, .21], [.29, .23, .38]);
    if (character === 'bunny') {
      const ear = new T.Group(); ear.position.set(side * .37, .53, -.02); ear.rotation.z = side * -.14; head.add(ear);
      ball(ear, fur, [0, .51, 0], [.21, .69, .18]); ball(ear, '#efbdc2', [0, .54, .15], [.105, .47, .055]);
    } else if (character === 'bear' || character === 'otter') {
      ball(head, fur, [side * .64, .51, -.03], [.28, .28, .2]); ball(head, accent, [side * .64, .51, .14], [.15, .15, .055]);
    }
    // Tiny cheeks are geometry, so they remain attached when the model turns.
    ball(head, '#eda4a5', [side * .56, -.14, .48], [.16, .085, .035]);
  }
  if (isCloud) {
    for (const [x, y, s] of [[-.61, .23, .4], [-.26, .57, .4], [.21, .59, .42], [.63, .2, .39]]) ball(head, fur, [x, y, -.07], [s, s, .52]);
  }
  if (character === 'sprout') {
    leaf(head, [-.18, .86, 0], .85, .75, '#86b65a'); leaf(head, [.18, .99, 0], .95, -.65, '#9dcb67');
    ball(head, accent, [0, .72, 0], [.065, .23, .065]);
  }
  if (isSeal) {
    for (const side of [-1, 1]) ball(body, fur, [side * .25, .28, -.61], [.3, .13, .45]).rotation.y = side * .65;
  } else ball(body, fur, [0, .66, -.54], character === 'otter' ? [.23, .19, .61] : [.22, .22, .22]);
  ball(head, cream, [0, -.14, .55], [.36, .24, .14]);
  const eyes = new T.Group(); head.add(eyes);
  for (const side of [-1, 1]) {
    ball(eyes, '#363d36', [side * .285, .075, .593], [.071, .092, .048], true);
    ball(eyes, '#ffffff', [side * .285 - .018, .103, .633], [.022, .026, .012], true);
  }
  ball(head, '#69554f', [0, -.095, .712], [.07, .045, .038], true);
  const mouth = ring(head, '#80665b', .105, .012, [0, -.18, .688], Math.PI); mouth.rotation.z = Math.PI;

  // Free wardrobe items have actual volume and follow the head/body in 3D.
  if (equipped === 'leaf') leaf(body, [-.38, 1.23, .53], .43, .7, '#8bb95b');
  if (equipped === 'star') star(body, [-.36, 1.22, .53], .15);
  if (equipped === 'flower') {
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ball(head, '#f0b5bb', [.56 + Math.cos(a) * .13, .48 + Math.sin(a) * .13, .42], [.105, .105, .05]); }
    ball(head, '#ffdc84', [.56, .48, .47], [.08, .08, .06]);
  }
  if (equipped === 'cap') { ball(head, '#a8cddd', [0, .61, 0], [.67, .26, .53]); ball(head, '#8bb3c8', [0, .52, .48], [.65, .065, .39]); }
  if (equipped === 'scarf') { const scarf = ring(body, '#d69c86', .51, .095, [0, 1.52, 0]); scarf.rotation.x = Math.PI / 2; ball(body, '#d69c86', [.32, 1.21, .5], [.12, .34, .09]).rotation.z = -.15; }
  if (equipped === 'crown') {
    const band = new T.Mesh(new T.CylinderGeometry(.42, .39, .16, 32, 1, true), material('#efc86b')); band.position.set(0, head.position.y + .73, 0); body.add(band);
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; const point = new T.Mesh(new T.ConeGeometry(.12, .28, 5), material('#efc86b')); point.position.set(Math.cos(a) * .34, head.position.y + .9, Math.sin(a) * .34); body.add(point); }
  }
  const stage = companionGrowthStage(level), growth = new T.Group(); body.add(growth);
  if (stage >= 1) for (const side of [-1, 1]) leaf(growth, [side * .71, 1.22, -.37], stage >= 2 ? 1.65 : 1.12, side * -.95, '#a4c991');
  const satellites = new T.Group(); root.add(satellites);
  if (stage >= 2) { star(satellites, [-1.08, 2.23, -.08], .16); star(satellites, [1.08, 1.45, .08], .115); }
  if (stage >= 3) {
    const halo = ring(growth, '#e9c779', .55, .025, [0, 2.9, -.2]); halo.rotation.x = Math.PI / 2.6;
    for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; leaf(root, [Math.cos(a) * 1.02, .075, Math.sin(a) * .78], .55, Math.PI / 2, i % 2 ? '#e5c0ce' : '#c0d9a5').rotation.x = Math.PI / 2; }
  }
  return { root, body, head, eyes, arms, satellites, stage };
}

export function disposeScene(scene: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
  scene.traverse(object => { if (object instanceof T.Mesh) { geometries.add(object.geometry); for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat); } });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(mat => mat.dispose());
}

export { T };
