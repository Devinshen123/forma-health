import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bone, Group, Quaternion } from 'three';
import { COMPANION_EVOLUTIONS } from '../src/companion-growth';
import { createCompanionAnimator } from '../src/components/companion-animation';
import { disposeScene } from '../src/components/companion-scene';
import { companionGeometryFixture } from './companion-model-fixture';

test('every shipped animated form walks, returns to idle, stays asleep and wakes without a dead transition', async () => {
  for(const form of Object.values(COMPANION_EVOLUTIONS).flat().filter(form=>form.dex!==446)){
    const gltf=await companionGeometryFixture(form.dex),animator=createCompanionAnimator(gltf.scene,gltf.animations);
    for(const action of ['idle','happy','walk','sleep'])assert.ok(gltf.animations.some(clip=>clip.name===action),`${form.en} ships authored ${action}`);
    const advance=(seconds:number)=>{for(let frame=0;frame<Math.ceil(seconds/.05);frame++)animator.update(.05);};
    animator.play('walk');assert.equal(animator.action,'walk');advance(gltf.animations.find(clip=>clip.name==='walk')!.duration*2+.5);assert.equal(animator.action,'idle');
    animator.play('sleep');advance(gltf.animations.find(clip=>clip.name==='sleep')!.duration*2+1);assert.equal(animator.action,'sleep');
    animator.play('happy');advance(gltf.animations.find(clip=>clip.name==='happy')!.duration+.5);assert.equal(animator.action,'idle');
    gltf.scene.traverse(object=>{assert.ok([...object.position,...object.quaternion,...object.scale].every(Number.isFinite));});
    animator.dispose();disposeScene(gltf.scene);
  }
});

function staticRig(){const root=new Group(),head=new Bone(),arm=new Bone();head.name='Head_05';arm.name='RArm_019';root.add(head,arm);return{root,head,arm};}
test('the static source also gets real bone reactions and reduced-motion poses apply without playback',()=>{
  const {root,head,arm}=staticRig(),animator=createCompanionAnimator(root,[]),initial=arm.quaternion.clone();
  animator.play('happy');for(let i=0;i<10;i++)animator.update(.05);assert.ok(initial.angleTo(arm.quaternion)>.1);
  animator.play('sleep',true);assert.equal(animator.action,'sleep');assert.ok(new Quaternion().angleTo(head.quaternion)>.1);
  animator.play('idle',true);assert.equal(animator.action,'idle');assert.ok(new Quaternion().angleTo(head.quaternion)<.05);
  animator.dispose();
});

test('pointer tracking stays bounded, recenters without rotation drift and cannot restart disposed animation',()=>{
  const tracked=staticRig(),baseline=staticRig(),a=createCompanionAnimator(tracked.root,[]),b=createCompanionAnimator(baseline.root,[]);
  a.look(100,100);for(let i=0;i<200;i++){a.update(.05);b.update(.05);}
  const offset=tracked.head.quaternion.angleTo(baseline.head.quaternion);assert.ok(offset>.1&&offset<.3);
  a.look(0,0);for(let i=0;i<200;i++){a.update(.05);b.update(.05);}
  assert.ok(tracked.head.quaternion.angleTo(baseline.head.quaternion)<.001,'gaze must not accumulate onto the authored head pose');
  a.dispose();a.play('walk');assert.equal(a.action,'idle');b.dispose();
});

test('head tracking turns around world up even when an imported rig uses rotated local axes',()=>{
  const tracked=staticRig(),baseline=staticRig();tracked.root.rotation.z=Math.PI/2;baseline.root.rotation.z=Math.PI/2;
  const a=createCompanionAnimator(tracked.root,[]),b=createCompanionAnimator(baseline.root,[]);a.look(1,0);
  for(let i=0;i<200;i++){a.update(.05);b.update(.05);}
  const delta=tracked.head.getWorldQuaternion(new Quaternion()).multiply(baseline.head.getWorldQuaternion(new Quaternion()).invert());
  assert.ok(Math.abs(delta.y)>.05&&Math.abs(delta.x)<.005&&Math.abs(delta.z)<.005,'horizontal pointer movement must turn toward the pointer rather than nod');
  a.dispose();b.dispose();
});
