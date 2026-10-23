import * as T from 'three';
import type { CompanionCharacter, CompanionItem } from '../companion';
import { companionGrowthStage } from '../companion-growth';

const palettes: Record<CompanionCharacter, [string, string, string]> = {
  sprout: ['#c3dd96', '#edf2cf', '#83a65d'], bunny: ['#fff0e3', '#fff7ed', '#f1b5bb'],
  otter: ['#e3b395', '#ffe7d1', '#bb886a'], cloud: ['#dcecf5', '#f3f9ff', '#a1c1db'],
  bear: ['#ecc58b', '#fff0d4', '#c59861'], seal: ['#cec9eb', '#f3eeff', '#a4a2ca'],
};

export function createCompanionModel(character: CompanionCharacter, equipped: CompanionItem | null, level: number) {
  const root = new T.Group(), body = new T.Group(), head = new T.Group();
  root.add(body); body.add(head);
  const [fur, cream, accent] = palettes[character];
  const materials = new Map<string, T.MeshStandardMaterial>();
  const material = (color: string, glossy = false) => {
    const key = color + glossy;
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness: glossy ? .2 : .9, metalness: 0 }));
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
  const isSeal = character === 'seal', isCloud = character === 'cloud', isSprout = character === 'sprout';
  head.position.y = isSeal ? 1.03 : isCloud ? 1.12 : isSprout ? 1.23 : 1.49;
  // Seated plush proportions: broad pear cheeks, overlapping head/belly and little paws.
  // The plant, cloud and seal keep their own silhouette rather than sharing a standing body.
  if (isSprout) {
    const pot = new T.Mesh(new T.CylinderGeometry(.81, .65, .56, 64), material('#ebddc8')); pot.position.y = .35; body.add(pot);
    const rim = ring(body, '#f3e8d8', .80, .07, [0, .63, 0]); rim.rotation.x = Math.PI / 2;
    ball(body, '#839b68', [0, .61, 0], [.73, .08, .68]);
  } else if (isCloud) {
    ball(body, fur, [0, .54, 0], [.84, .43, .59]);
  } else {
    ball(body, fur, [0, isSeal ? .54 : .72, 0], [isSeal ? 1.02 : .79, isSeal ? .51 : .69, isSeal ? .77 : .66]);
    ball(body, cream, [0, isSeal ? .5 : .73, isSeal ? .66 : .56], [isSeal ? .65 : .55, isSeal ? .3 : .46, .17]);
  }
  const cheekShape = new T.SphereGeometry(1, 48, 32), cheekVertices = cheekShape.getAttribute('position');
  for (let i = 0; i < cheekVertices.count; i++) cheekVertices.setX(i, cheekVertices.getX(i) * (1 + .12 * (1 - cheekVertices.getY(i)) / 2));
  cheekShape.computeVertexNormals();
  const headMesh = new T.Mesh(cheekShape, material(fur)); headMesh.scale.set(isSprout ? .87 : isCloud ? .87 : .96, isSprout ? .71 : isSeal ? .69 : .79, .74); head.add(headMesh);
  const arms: T.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new T.Group(); arm.position.set(side * (isSeal ? .88 : isSprout ? .67 : .65), isSeal ? .4 : isSprout ? .79 : isCloud ? .59 : .89, .4); body.add(arm); arms.push(arm);
    ball(arm, fur, [0, 0, .02], isSeal ? [.33, .12, .29] : isSprout ? [.21, .18, .21] : [.25, .25, .27]).rotation.z = side * (isSeal ? -.35 : -.18);
    if (!isSprout) {
      ball(body, fur, [side * .44, isSeal ? .15 : .25, .43], isSeal ? [.32, .12, .32] : [.34, .25, .38]);
      if (!isSeal && !isCloud) ball(body, cream, [side * .44, .27, .76], [.22, .15, .035]);
    }
    if (character === 'bunny') {
      const ear = new T.Group(); ear.position.set(side * .43, .58, -.05); ear.rotation.z = side * -.29; head.add(ear);
      ball(ear, fur, [0, .35, 0], [.24, .48, .21]); ball(ear, '#f2c1c5', [0, .37, .17], [.13, .32, .055]);
    } else if (character === 'bear' || character === 'otter') {
      ball(head, fur, [side * .74, .58, -.10], character === 'bear' ? [.28, .27, .23] : [.23, .21, .19]); ball(head, accent, [side * .74, .58, .09], [.14, .13, .045]);
    }
    // Tiny cheeks are geometry, so they remain attached when the model turns.
    ball(head, '#f4c3bf', [side * .59, -.17, .564], [.23, .14, .085]);
    ball(head, '#f3b6b5', [side * .59, -.17, .638], [.14, .08, .012]);
  }
  if (isCloud) {
    for (const [x, y, s] of [[-.74, .02, .4], [-.49, .45, .39], [0, .58, .43], [.49, .4, .4], [.76, .01, .38]]) ball(head, fur, [x, y, -.06], [s, s, .54]);
  }
  if (character === 'sprout') {
    leaf(head, [-.23, .82, -.04], 1.0, 1.02, '#95bc6f'); leaf(head, [.21, .91, -.04], 1.05, -.95, '#b2d580');
    ball(head, accent, [0, .71, 0], [.055, .18, .055]);
  }
  if (isSeal) {
    for (const side of [-1, 1]) ball(body, fur, [side * .23, .19, -.68], [.32, .12, .43]).rotation.y = side * .65;
  } else if (!isSprout && !isCloud) ball(body, fur, [0, .45, -.56], character === 'otter' ? [.27, .19, .54] : [.23, .23, .23]);
  const hasMuzzle = character === 'bear' || character === 'otter' || isSeal;
  if (hasMuzzle) ball(head, cream, [0, -.15, .65], [.34, .22, .15]);
  const eyes = new T.Group(); head.add(eyes);
  for (const side of [-1, 1]) {
    ball(eyes, '#4c3b35', [side * .32, .015, .702], [.065, .077, .042], true);
    ball(eyes, '#fffaf3', [side * .32 - .018, .041, .739], [.022, .024, .009], true);
  }
  const faceFront = hasMuzzle ? .809 : .757;
  ball(head, character === 'bunny' ? '#d999a0' : '#886653', [0, -.105, faceFront], [.046, .031, .026], true);
  for (const side of [-1, 1]) { const smile = ring(head, '#986f5c', .068, .010, [side * .065, -.144, faceFront - .002], Math.PI); smile.rotation.z = Math.PI; }

  // Free wardrobe items have actual volume and follow the head/body in 3D.
  if (equipped === 'leaf') leaf(body, [-.26, isSprout ? .38 : .86, isSprout ? .78 : .72], .32, .75, '#a4c77f');
  if (equipped === 'star') star(body, [-.26, isSprout ? .38 : .86, isSprout ? .78 : .72], .115);
  if (equipped === 'flower') {
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ball(head, '#f0bdc6', [.72 + Math.cos(a) * .11, .44 + Math.sin(a) * .11, .47], [.09, .09, .045]); }
    ball(head, '#ffe1a2', [.72, .44, .51], [.065, .065, .04]);
  }
  if (equipped === 'cap') { ball(head, '#b9d7e3', [0, .67, 0], [.72, .23, .56]); ball(head, '#a7c9d9', [0, .60, .48], [.69, .06, .38]); }
  if (equipped === 'scarf') { const scarf = ring(body, '#e2b4a5', .59, .085, [0, head.position.y - .48, 0]); scarf.rotation.x = Math.PI / 2; ball(body, '#e2b4a5', [.35, head.position.y - .66, .56], [.11, .21, .09]).rotation.z = -.15; }
  if (equipped === 'crown') {
    const band = new T.Mesh(new T.CylinderGeometry(.35, .33, .12, 32, 1, true), material('#efd28c')); band.position.set(0, head.position.y + .81, 0); body.add(band);
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; const point = new T.Mesh(new T.ConeGeometry(.09, .19, 5), material('#efd28c')); point.position.set(Math.cos(a) * .29, head.position.y + .92, Math.sin(a) * .29); body.add(point); }
  }
  const stage = companionGrowthStage(level), growth = new T.Group(); body.add(growth);
  if (stage >= 1) for (const side of [-1, 1]) leaf(growth, [side * .82, .77, -.37], stage >= 2 ? 1.1 : .75, side * -1.05, '#bed8a8');
  const satellites = new T.Group(); root.add(satellites);
  if (stage >= 2) { star(satellites, [-1.18, 1.75, -.08], .12); star(satellites, [1.12, 1.08, .08], .09); }
  if (stage >= 3) {
    const halo = ring(growth, '#edcf8c', .49, .018, [0, head.position.y + 1.06, -.2]); halo.rotation.x = Math.PI / 2.6;
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
