import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Store } from '../server/store';
import { emptyState } from '../src/types';
import { test } from 'node:test';
import { Box3, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { companionLevel, COMPANION_CHARACTERS } from '../src/companion';
import { companionForm, companionGrowthStage, COMPANION_EVOLUTIONS, nextCompanionEvolution } from '../src/companion-growth';
import { disposeScene, fitCompanionCamera } from '../src/components/companion-scene';

test('all six saved families evolve at exact XP boundaries and stop at a valid final species', () => {
  const expected = {sprout:[1,2,3],bunny:[25,26],otter:[7,8,9],cloud:[39,40],bear:[446,143],seal:[133,136]};
  for (const character of COMPANION_CHARACTERS) {
    assert.deepEqual(COMPANION_EVOLUTIONS[character].map(form=>form.dex),expected[character]);
    const forms=COMPANION_EVOLUTIONS[character];
    for(let i=1;i<forms.length;i++){
      const xp=(forms[i].level-1)*100;
      assert.equal(companionForm(character,companionLevel(xp-1)).dex,forms[i-1].dex);
      assert.equal(companionForm(character,companionLevel(xp)).dex,forms[i].dex);
      assert.equal(nextCompanionEvolution(character,xp-1)?.remainingXp,1);
    }
    assert.equal(companionForm(character,9999).dex,forms.at(-1)!.dex);
    assert.equal(nextCompanionEvolution(character,999999),null);
    for(const invalid of [NaN,Infinity,0,-1])assert.equal(companionGrowthStage(invalid,character),0);
  }
});

test('earned evolution persists across store reopen and changing families preserves the same earned XP', async t => {
  const directory=await mkdtemp(join(tmpdir(),'forma-earned-evolution-'));
  let now=Date.parse('2026-09-01T12:00:00Z'),store=new Store(directory,()=>now);
  t.after(async()=>{store.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));await rm(directory,{recursive:true,force:true});});
  const owner=store.createAccount('earned@synthetic.test','Synthetic','unused','unused').id;
  store.save(owner,{...emptyState(),profile:{name:'Synthetic',goal:'habits',experience:'new',trainingDays:3,timeMinutes:30,equipment:'home',allergies:'',restrictions:'',language:'en',units:'metric',timezone:'UTC',sleepGoal:8,cloudConsent:false,aiConsent:false}},0);
  for(let day=0;day<40;day++){
    now=Date.parse('2026-09-01T12:00:00Z')+day*86400000;
    const earned=store.claimCompanion(owner,true);assert.equal(earned.xp,(day+1)*10);
    assert.equal(store.claimCompanion(owner,true).xp,earned.xp,'repeated claim cannot accelerate evolution');
    if(day===19||day===39){
      const expected=day===19?2:3;assert.equal(companionForm(earned.character,earned.level).dex,expected);
      store.close();store=new Store(directory,()=>now);
      const restored=store.companionSnapshot(owner);assert.deepEqual(restored,earned);
      for(const family of COMPANION_CHARACTERS){const changed=store.selectCompanionCharacter(owner,family);assert.equal(changed.xp,earned.xp);assert.equal(changed.level,earned.level);assert.equal(companionGrowthStage(changed.level,family),Math.min(day===19?1:2,COMPANION_EVOLUTIONS[family].length-1));}
      store.selectCompanionCharacter(owner,'sprout');
    }
  }
});

test('all fourteen packaged forms have pinned provenance, unique geometry, embedded textures and matching hashes', async () => {
  const manifest=JSON.parse(await readFile('public/companions/model-manifest.json','utf8'));
  const expected=Object.values(COMPANION_EVOLUTIONS).flat().map(form=>form.dex).sort((a,b)=>a-b);
  assert.deepEqual(manifest.models.map((model:any)=>model.dex).sort((a:number,b:number)=>a-b),expected);
  const hashes=new Set<string>();let total=0;
  for(const model of manifest.models){
    const bytes=await readFile(`public/companions/models/${model.dex}.glb`);
    assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),model.sha256);assert.equal(bytes.length,model.bytes);
    assert.match(model.sourceRevision,/^[a-f0-9]{40}$/);assert.ok(model.sourceUrl.includes(model.sourceRevision));hashes.add(model.sha256);total+=bytes.length;
    const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    assert.ok(json.meshes.length>0);assert.ok(json.skins.length>0);
    assert.ok(json.images.every((image:any)=>image.bufferView!==undefined&&!image.uri&&image.mimeType==='image/webp'));
    assert.deepEqual((json.animations??[]).map((clip:any)=>clip.name).sort(),model.animations.toSorted());
    for(const view of json.bufferViews){assert.equal(view.buffer,0);assert.ok((view.byteOffset??0)+view.byteLength<=json.buffers[0].byteLength);}
    for(const clip of json.animations??[])for(const channel of clip.channels)assert.ok(json.nodes[channel.target.node]);
    assert.ok(bytes.length<2_000_000,'one selected mobile model stays below 2 MB');
  }
  assert.equal(hashes.size,14);assert.ok(total<16_000_000);
});

test('real animated model geometry is finite and fits desktop, phone and rotated portrait cameras', async () => {
  // Strip only materials in this Node-only geometry check; browser QA exercises real texture decoding.
  for(const form of Object.values(COMPANION_EVOLUTIONS).flat().filter(form=>form.dex!==446)){
    const bytes=await readFile(`public/companions/models/${form.dex}.glb`),length=bytes.readUInt32LE(12);
    const json=JSON.parse(bytes.subarray(20,20+length).toString());
    delete json.images;delete json.textures;delete json.materials;
    for(const mesh of json.meshes)for(const primitive of mesh.primitives)delete primitive.material;
    const text=Buffer.from(JSON.stringify(json)),padding=(4-text.length%4)%4,header=Buffer.from(bytes.subarray(0,20));
    header.writeUInt32LE(28+text.length+padding+bytes.subarray(28+length).length,8);header.writeUInt32LE(text.length+padding,12);
    const packed=Buffer.concat([header,text,Buffer.alloc(padding,32),bytes.subarray(20+length)]);
    const gltf=await new GLTFLoader().parseAsync(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.length),'');
    const root=gltf.scene;root.updateMatrixWorld(true);
    const raw=new Box3().setFromObject(root,true),size=raw.getSize(new Vector3());
    assert.ok(size.toArray().every(value=>Number.isFinite(value)&&value>0));
    root.scale.setScalar(2.65/Math.max(size.x,size.y,size.z));
    root.traverse(object=>{if(object instanceof Mesh)assert.ok(object.geometry.getAttribute('position').count>0);});
    for(const angle of [0,Math.PI/4,Math.PI/2]){
      root.rotation.y=angle;
      for(const aspect of [1,.85,1.5]){
        const camera=new PerspectiveCamera(35,aspect,.1,30);fitCompanionCamera(camera,root,aspect);camera.updateMatrixWorld(true);
        const bounds=new Box3().setFromObject(root,true);
        for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
          const projected=new Vector3(x,y,z).project(camera);
          assert.ok(Math.abs(projected.x)<=1&&Math.abs(projected.y)<=1&&Math.abs(projected.z)<=1,`${form.en} fits ${aspect}, ${angle}`);
        }
      }
    }
    disposeScene(root);
  }
});
