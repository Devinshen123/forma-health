import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Mesh, MeshStandardMaterial } from 'three';
import { companionLevel, COMPANION_CHARACTERS, COMPANION_ITEMS } from '../src/companion';
import { companionGrowthStage, COMPANION_GROWTH_STAGES } from '../src/companion-growth';
import { createCompanionModel, disposeScene } from '../src/components/companion-scene';

test('saved XP unlocks each appearance exactly at its level threshold', () => {
  for (const [xp, level, stage] of [[0, 1, 0], [199, 2, 0], [200, 3, 1], [399, 4, 1], [400, 5, 2], [899, 9, 2], [900, 10, 3], [20000, 201, 3]]) {
    assert.equal(companionLevel(xp), level); assert.equal(companionGrowthStage(companionLevel(xp)), stage);
  }
  for (const invalid of [NaN, Infinity, -5, 0]) assert.equal(companionGrowthStage(invalid), 0);
});

test('all six characters and every growth stage contain finite, distinct 3D geometry', () => {
  const signatures = new Set<string>();
  for (const character of COMPANION_CHARACTERS) {
    let previousCount = 0;
    for (const stage of COMPANION_GROWTH_STAGES) {
      const model = createCompanionModel(character, null, stage.level);
      let count = 0; const signature: unknown[] = [];
      model.root.traverse(object => {
        assert.ok([...object.position, ...object.scale, object.rotation.x, object.rotation.y, object.rotation.z].every(Number.isFinite));
        if (object instanceof Mesh) {
          count++; assert.ok(object.geometry.getAttribute('position').count > 0);
          object.geometry.computeBoundingSphere(); assert.ok(Number.isFinite(object.geometry.boundingSphere!.radius));
          signature.push([object.position.toArray(), object.scale.toArray(), (object.material as MeshStandardMaterial).color.getHex()]);
        }
      });
      assert.ok(count > previousCount, 'each growth milestone adds visible geometry'); assert.ok(count < 100, 'keep each single mobile scene modest');
      if (stage.level === 1) signatures.add(JSON.stringify(signature));
      previousCount = count; disposeScene(model.root);
    }
  }
  assert.equal(signatures.size, 6);
});

test('every owned keepsake is represented in 3D without changing the growth stage', () => {
  for (const character of COMPANION_CHARACTERS) {
    const plain = createCompanionModel(character, null, 5);
    let plainMeshes = 0; plain.root.traverse(object => { if (object instanceof Mesh) plainMeshes++; }); disposeScene(plain.root);
    for (const item of COMPANION_ITEMS) {
      const model = createCompanionModel(character, item, 5); let meshes = 0;
      model.root.traverse(object => { if (object instanceof Mesh) meshes++; });
      assert.ok(meshes > plainMeshes, `${character} wears ${item}`); assert.equal(model.stage, 2); disposeScene(model.root);
    }
  }
});
