import * as T from 'three';
import type { CompanionCharacter, CompanionItem } from '../companion';
import { companionGrowthStage } from '../companion-growth';

// Pokémon references requested by the user; persisted account IDs stay unchanged.
const palettes: Record<CompanionCharacter, [string, string, string]> = {
  sprout: ['#86cbb3', '#a5dfc2', '#578f74'], bunny: ['#f6d65d', '#ffe99b', '#795840'],
  otter: ['#94cddd', '#f5e2b8', '#b58b65'], cloud: ['#edb7cd', '#f7d3e0', '#5aa7bd'],
  bear: ['#4c7881', '#f2e4c5', '#354f56'], seal: ['#be936e', '#f2dfba', '#675047'],
};

export function createCompanionModel(character: CompanionCharacter, equipped: CompanionItem | null, level: number) {
  const root = new T.Group(), body = new T.Group(), head = new T.Group(), eyes = new T.Group();
  root.add(body); body.add(head); head.add(eyes);
  const [fur, cream, accent] = palettes[character], materials = new Map<string, T.MeshStandardMaterial>();
  const material = (color: string, glossy = false) => {
    const key = color + glossy;
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness: glossy ? .22 : .88, metalness: 0 }));
    return materials.get(key)!;
  };
  const sphere = new T.SphereGeometry(1, 40, 28);
  function ball(parent: T.Object3D, color: string, p: [number, number, number], s: [number, number, number], glossy = false) {
    const mesh = new T.Mesh(sphere, material(color, glossy)); mesh.position.set(...p); mesh.scale.set(...s); parent.add(mesh); return mesh;
  }
  function ring(parent: T.Object3D, color: string, radius: number, tube: number, p: [number, number, number], arc = Math.PI * 2) {
    const mesh = new T.Mesh(new T.TorusGeometry(radius, tube, 8, 48, arc), material(color)); mesh.position.set(...p); parent.add(mesh); return mesh;
  }
  function stroke(parent: T.Object3D, color: string, points: [number, number, number][], radius = .012) {
    const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
    const mesh = new T.Mesh(new T.TubeGeometry(curve, 24, radius, 6, false), material(color)); parent.add(mesh); return mesh;
  }
  function leaf(parent: T.Object3D, p: [number, number, number], size: number, rotation: number, color = accent) {
    const mesh = ball(parent, color, p, [.17 * size, .42 * size, .075 * size]); mesh.rotation.z = rotation; return mesh;
  }
  function polygon(parent: T.Object3D, color: string, points: [number, number][], depth: number, z: number) {
    const shape = new T.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
    const mesh = new T.Mesh(new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .025, bevelThickness: .025 }), material(color)); mesh.position.z = z; parent.add(mesh); return mesh;
  }
  function star(parent: T.Object3D, p: [number, number, number], size: number) {
    const points: [number, number][] = Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + i * Math.PI / 5, r = size * (i % 2 ? .48 : 1); return [Math.cos(a) * r, Math.sin(a) * r]; });
    const mesh = polygon(parent, '#ffdc86', points, .045, 0); mesh.position.set(...p); return mesh;
  }
  const pikachu = character === 'bunny', snorlax = character === 'bear', jiggly = character === 'cloud';
  const bulbasaur = character === 'sprout', squirtle = character === 'otter', eevee = character === 'seal';
  head.position.y = bulbasaur ? 1.02 : jiggly ? 1.11 : snorlax ? 1.70 : 1.43;
  const headScale: [number, number, number] = bulbasaur ? [1.01, .71, .76] : jiggly ? [.99, .96, .83] : snorlax ? [.82, .66, .70] : [.94, .79, .74];
  ball(body, fur, [0, snorlax ? .81 : .69, bulbasaur ? -.35 : 0], snorlax ? [1.02, .88, .79] : bulbasaur ? [.86, .50, .88] : [.77, .67, .64]);
  if (!jiggly && !bulbasaur && !pikachu) ball(body, cream, [0, snorlax ? .82 : .69, snorlax ? .65 : .55], [snorlax ? .83 : .53, snorlax ? .73 : .48, .19]);
  const headMesh = ball(head, fur, [0, 0, 0], headScale); headMesh.name = 'character-head';
  if (snorlax) {
    ball(head, cream, [0, -.10, .52], [.69, .43, .20]);
    for (const side of [-1, 1]) ball(head, cream, [side * .30, .12, .55], [.35, .35, .17]);
  }
  const arms: T.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new T.Group(); arm.position.set(side * (snorlax ? .87 : bulbasaur ? .70 : .66), snorlax ? .91 : bulbasaur ? .48 : .87, .42); body.add(arm); arms.push(arm);
    ball(arm, fur, [0, 0, .02], snorlax ? [.30, .37, .30] : bulbasaur ? [.25, .34, .28] : [.24, .26, .26]).rotation.z = side * -.18;
    ball(body, snorlax ? cream : fur, [side * (snorlax ? .56 : .43), .24, .46], snorlax ? [.36, .29, .40] : [.32, .24, .35]);
    if (snorlax) {
      ball(body, '#a9a384', [side * .56, .25, .82], [.18, .15, .025]);
      for (const dx of [-.15, 0, .15]) ball(body, '#fff9e9', [side * .56 + dx, .44, .69], [.055, .08, .065]);
    }
    if (pikachu || eevee) {
      const ear = new T.Group(); ear.position.set(side * .47, .54, -.06); ear.rotation.z = side * (eevee ? -.47 : -.24); head.add(ear);
      ball(ear, fur, [0, .41, 0], [eevee ? .25 : .18, eevee ? .58 : .64, .16]);
      if (pikachu) ball(ear, '#4d4440', [0, .85, 0], [.147, .24, .14]);
      else ball(ear, accent, [0, .45, .145], [.14, .41, .036]);
    } else if (snorlax || jiggly || bulbasaur) {
      const profile = [[0,-.18],[.19,-.18],[.22,-.08],[.18,.08],[.10,.27],[.025,.36],[0,.37]].map(([x,y])=>new T.Vector2(x,y));
      const ear = new T.Mesh(new T.LatheGeometry(profile,24),material(fur)); ear.position.set(side*.65,.47,-.04); ear.rotation.z=side*-.15; head.add(ear);
      if (jiggly) polygon(head, '#705762', [[side * .58, .52], [side * .67, .80], [side * .78, .55]], .025, .16);
    }
    if (pikachu) ball(head, '#de7773', [side * .61, -.16, .56], [.19, .18, .065]);
    if (eevee || jiggly) ball(head, '#e8a6ad', [side * .60, -.20, .57], [.14, .075, .025]);
    if (bulbasaur) {
      ball(head, accent, [side * .58, .27, .52], [.14, .085, .022]).rotation.z = side * .5;
      ball(body, accent, [side * .82, .61, -.1], [.035, .15, .20]);
      for (const dx of [-.10, .10]) ball(body, '#f6edda', [side * .43 + dx, .15, .77], [.04, .04, .045]);
    }
  }
  if (pikachu) {
    polygon(body, '#f6d65d', [[.54,.49],[.84,.59],[.73,.90],[1.02,.95],[.93,1.20],[1.23,1.37],[1.45,.97],[1.14,.81],[1.20,.58],[.94,.50],[.78,.22]], .12, -.53).name = 'lightning-tail';
    ball(body, accent, [.60,.37,-.55], [.22,.14,.13]).rotation.z = -.65;
    for (const y of [.88,1.15]) ball(body, accent, [0,y,-.57], [.47,.075,.06]);
  }
  if (bulbasaur) {
    ball(body, '#77a85d', [0, 1.01, -.65], [.73, .73, .62]);
    for (const side of [-1, 1]) leaf(body, [side * .31, 1.28, -.64], 1.45, side * -.39, '#699a55');
    leaf(body, [0, 1.48, -.65], 1.1, 0, '#8fbb70');
    ball(head, accent, [0,.43,.53], [.12,.095,.022]);
  }
  if (squirtle) {
    ball(body, accent, [0,.87,-.34], [.84,.89,.49]);
    const rim = ring(body, '#e4d9b5', .79, .065, [0,.87,-.30]); rim.scale.set(1,1.07,1);
    stroke(body, '#8e684f', [[0,.15,-.55],[0,.63,-.84],[0,1.28,-.72],[0,1.62,-.39]], .018);
    for (const y of [.54,1.11]) stroke(body, '#8e684f', [[-.67,y,-.55],[0,y+.06,-.83],[.67,y,-.55]], .018);
    for (const y of [.48,.78]) stroke(body, '#dbc69b', [[-.40,y,.68],[0,y-.04,.755],[.40,y,.68]], .012);
    stroke(body, '#dbc69b', [[0,.23,.68],[0,.72,.75],[0,1.10,.64]], .012);
    const tailPoints: [number,number,number][] = Array.from({length:40},(_,i)=>{const a=i/39*Math.PI*3,r=.32*(1-i/54);return [.61+Math.cos(a)*r,.45+Math.sin(a)*r,-.89];});
    stroke(body, fur, tailPoints, .11);
  }
  if (jiggly) {
    const curl: [number,number,number][] = Array.from({length:32},(_,i)=>{const a=i/31*Math.PI*2.1,r=.28*(1-i/41);return [-.04+Math.cos(a)*r,.72+Math.sin(a)*r,.61];});
    stroke(head, '#e5a4c1', curl, .075); ball(head, cream, [-.21,.72,.64], [.055,.04,.02]);
  }
  if (eevee) {
    for (let i=0;i<9;i++) {const a=i/8*Math.PI; ball(body,cream,[Math.cos(a)*.55,.90+Math.sin(a)*.14,.41+Math.sin(a)*.16],[.22,.23,.20]);}
    ball(body,fur,[.49,.61,-.63],[.39,.47,.59]).rotation.z=-.45;
    ball(body,cream,[.66,.95,-.91],[.27,.30,.33]).rotation.z=-.45;
  }
  for (const side of [-1,1]) {
    if (snorlax) stroke(eyes, '#3d4d46', [[side*.30-.10,.045,.726],[side*.30,.025,.75],[side*.30+.10,.045,.726]], .016);
    else {
      const large = jiggly || bulbasaur, x=side*(jiggly?.37:.32), z=jiggly?.77:.70;
      if (large) ball(eyes,'#fffaf2',[x,.045,z],[jiggly?.22:.13,jiggly?.27:.18,.07]);
      ball(eyes, jiggly ? '#589bb8' : bulbasaur ? '#b46d76' : '#46372f', [x,.035,z+.04], [jiggly?.16:bulbasaur?.09:.065,jiggly?.22:bulbasaur?.14:.077,.045], true);
      if (large) ball(eyes,'#3a4449',[x,.025,z+.076],[jiggly?.075:.038,jiggly?.13:.085,.015],true);
      ball(eyes,'#fffdf7',[x-.024,.085,z+.084],[large?.034:.023,large?.039:.024,.011],true);
    }
  }
  if (pikachu || eevee) ball(head,'#74584b',[0,-.105,.76],[.045,.031,.024],true);
  if (squirtle) for (const side of [-1,1]) ball(head,'#729eaa',[side*.10,-.085,.75],[.016,.012,.009]);
  if (snorlax) stroke(head,'#705f4b',[[-.17,-.19,.75],[0,-.22,.76],[.17,-.19,.75]],.012);
  else if (jiggly) ball(head,'#9c6078',[0,-.28,.795],[.055,.055,.023]);
  else if (bulbasaur) stroke(head,'#597e69',[[-.23,-.22,.72],[0,-.27,.76],[.23,-.22,.72]],.014);
  else if (squirtle) stroke(head,'#78979a',[[-.18,-.16,.75],[0,-.22,.77],[.18,-.16,.75]],.013);
  else for(const side of [-1,1]) {const smile=ring(head,'#896952',.068,.010,[side*.065,-.15,.757],Math.PI);smile.rotation.z=Math.PI;}

  if (equipped === 'leaf') leaf(body,[-.26,.84,.74],.32,.75,'#b4cc8a');
  if (equipped === 'star') star(body,[-.26,.84,.74],.115);
  if (equipped === 'flower') {for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ball(head,'#efbdd0',[.70+Math.cos(a)*.11,.44+Math.sin(a)*.11,.47],[.09,.09,.045]);}ball(head,'#ffe1a2',[.70,.44,.51],[.065,.065,.04]);}
  if (equipped === 'cap') {ball(head,'#b9d7e3',[0,.67,0],[.72,.23,.56]);ball(head,'#a7c9d9',[0,.60,.48],[.69,.06,.38]);}
  if (equipped === 'scarf') {const scarf=ring(body,'#e2b4a5',.59,.085,[0,head.position.y-.48,0]);scarf.rotation.x=Math.PI/2;ball(body,'#e2b4a5',[.35,head.position.y-.66,.56],[.11,.21,.09]).rotation.z=-.15;}
  if (equipped === 'crown') {const band=new T.Mesh(new T.CylinderGeometry(.35,.33,.12,32,1,true),material('#efd28c'));band.position.set(0,head.position.y+.81,0);body.add(band);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const point=new T.Mesh(new T.ConeGeometry(.09,.19,5),material('#efd28c'));point.position.set(Math.cos(a)*.29,head.position.y+.92,Math.sin(a)*.29);body.add(point);}}
  const stage=companionGrowthStage(level),growth=new T.Group();body.add(growth);
  if(stage>=1)for(const side of [-1,1])leaf(growth,[side*.82,.77,-.37],stage>=2?1.1:.75,side*-1.05,'#bed8a8');
  const satellites=new T.Group();root.add(satellites);
  if(stage>=2){star(satellites,[-1.18,1.75,-.08],.12);star(satellites,[1.12,1.08,.08],.09);}
  if(stage>=3){const halo=ring(growth,'#edcf8c',.49,.018,[0,head.position.y+1.06,-.2]);halo.rotation.x=Math.PI/2.6;for(let i=0;i<7;i++){const a=i*Math.PI*2/7;leaf(root,[Math.cos(a)*1.02,.075,Math.sin(a)*.78],.55,Math.PI/2,i%2?'#e5c0ce':'#c0d9a5').rotation.x=Math.PI/2;}}
  return { root, body, head, eyes, arms, satellites, stage };
}

export function fitCompanionCamera(camera: T.PerspectiveCamera, model: T.Object3D, aspect: number) {
  const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const tan=Math.tan(camera.fov*Math.PI/360),pitch=.10;
  const height=size.y*Math.cos(pitch)+size.z*Math.sin(pitch),depth=size.z*Math.cos(pitch)+size.y*Math.sin(pitch);
  const distance=(Math.max(height/(2*tan),size.x/(2*tan*aspect))+depth/2)*1.08;
  camera.aspect=aspect;camera.position.set(center.x,center.y+Math.sin(pitch)*distance,center.z+Math.cos(pitch)*distance);camera.lookAt(center);camera.updateProjectionMatrix();
}

export function disposeScene(scene: T.Object3D) {
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
  scene.traverse(object=>{if(object instanceof T.Mesh){geometries.add(object.geometry);for(const mat of Array.isArray(object.material)?object.material:[object.material])materials.add(mat);}});
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(mat=>mat.dispose());
}
export { T };
