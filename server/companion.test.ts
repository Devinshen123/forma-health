import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { COMPANION_CHARACTERS } from '../src/companion';
import { emptyState, type Profile } from '../src/types';
import { Store } from './store';

const profile: Profile = { name: 'Synthetic character test', goal: 'habits', experience: 'new', trainingDays: 3, timeMinutes: 30, equipment: 'home', allergies: '', restrictions: '', language: 'en', units: 'metric', timezone: 'UTC', sleepGoal: 8, cloudConsent: false, aiConsent: false };
function harness(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-companion-character-'));
  let now = Date.parse('2026-10-20T12:00:00.000Z');
  let store = new Store(directory, () => now);
  const owner = store.createAccount('synthetic@character.test', 'Synthetic', 'unused', 'unused').id;
  t.after(() => {
    store.close();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.includes('forma-companion-character-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    directory, owner, get store() { return store; },
    setNow(value: string) { now = Date.parse(value); },
    reopen() { store.close(); store = new Store(directory, () => now); },
  };
}
function earnedProfile(h: ReturnType<typeof harness>) {
  assert.equal(h.store.save(h.owner, { ...emptyState(), profile }, 0), true);
  for (let day = 20; day <= 22; day++) {
    h.setNow(`2026-10-${day}T12:00:00.000Z`);
    h.store.claimCompanion(h.owner, true);
  }
  const [chest] = h.store.companionSnapshot(h.owner).chests;
  h.store.openCompanionChest(h.owner, chest.id);
  h.store.equipCompanion(h.owner, 'leaf');
  h.store.companionChallenge(h.owner, 'create');
}

test('every character selection persists without changing health, progression, gear or challenges', t => {
  const h = harness(t);
  assert.equal(h.store.companionSnapshot(h.owner).character, 'sprout');
  earnedProfile(h);
  const original = h.store.companionSnapshot(h.owner), health = h.store.snapshot(h.owner);
  assert.equal(original.xp, 30); assert.equal(original.equipped, 'leaf');
  for (const character of COMPANION_CHARACTERS) {
    assert.deepEqual(h.store.selectCompanionCharacter(h.owner, character), { ...original, character });
    assert.deepEqual(h.store.snapshot(h.owner), health);
    h.reopen();
    assert.deepEqual(h.store.companionSnapshot(h.owner), { ...original, character });
    assert.deepEqual(h.store.selectCompanionCharacter(h.owner, character), { ...original, character });
  }
  assert.equal(h.store.equipCompanion(h.owner, null).character, 'seal');
  assert.equal(h.store.equipCompanion(h.owner, 'leaf').character, 'seal');
});

test('old two-column profiles migrate in place with default sprout and retain existing game data', t => {
  const h = harness(t); earnedProfile(h);
  const second = h.store.createAccount('legacy-empty@character.test', 'Legacy empty', 'unused', 'unused').id;
  const noProfile = h.store.createAccount('legacy-unset@character.test', 'Legacy unset', 'unused', 'unused').id;
  const original = h.store.companionSnapshot(h.owner), health = h.store.snapshot(h.owner);
  h.store.close();
  const legacy = new DatabaseSync(join(h.directory, 'forma.sqlite'));
  try {
    // Reproduce the exact pre-character table in a synthetic database, retaining
    // its real reward/chest/challenge fixtures and account foreign keys.
    legacy.exec('PRAGMA foreign_keys=ON; DROP TABLE companion_profiles; CREATE TABLE companion_profiles(owner_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,equipped TEXT);');
    legacy.prepare('INSERT INTO companion_profiles(owner_id,equipped) VALUES (?,?)').run(h.owner, 'leaf');
    legacy.prepare('INSERT INTO companion_profiles(owner_id,equipped) VALUES (?,NULL)').run(second);
  } finally { legacy.close(); }
  h.reopen();
  assert.deepEqual(h.store.companionSnapshot(h.owner), original);
  assert.deepEqual(h.store.snapshot(h.owner), health);
  assert.equal(h.store.companionSnapshot(second).character, 'sprout');
  assert.equal(h.store.companionSnapshot(noProfile).character, 'sprout');
  assert.equal((h.store.db.prepare('SELECT character FROM companion_profiles WHERE owner_id=?').get(second) as { character: string }).character, 'sprout');
  assert.throws(() => h.store.db.prepare('UPDATE companion_profiles SET character=? WHERE owner_id=?').run('unknown', h.owner), /CHECK constraint failed/);
  assert.throws(() => h.store.db.prepare('UPDATE companion_profiles SET character=NULL WHERE owner_id=?').run(h.owner), /NOT NULL constraint failed/);
  const selected = h.store.selectCompanionCharacter(h.owner, 'bear');
  h.reopen();
  assert.deepEqual(h.store.companionSnapshot(h.owner), selected);
  assert.equal((h.store.db.prepare('PRAGMA table_info(companion_profiles)').all() as { name: string }[]).filter(column => column.name === 'character').length, 1);
});

test('character export and deletion stay isolated to the account', t => {
  const h = harness(t), other = h.store.createAccount('other@character.test', 'Other', 'unused', 'unused').id;
  h.store.selectCompanionCharacter(h.owner, 'bunny');
  h.store.selectCompanionCharacter(other, 'cloud');
  assert.equal(h.store.companionSnapshot(h.owner).character, 'bunny');
  assert.equal(h.store.exportCompanion(h.owner).character, 'bunny');
  const exported = h.store.exportCompanion(other);
  assert.equal(exported.character, 'cloud');
  assert.equal(JSON.stringify(exported).includes(h.owner), false);
  h.store.deleteAccount(other);
  assert.equal((h.store.db.prepare('SELECT COUNT(*) AS count FROM companion_profiles WHERE owner_id=?').get(other) as { count: number }).count, 0);
  assert.equal(h.store.companionSnapshot(h.owner).character, 'bunny');
});

test('the six-character schema expands additively, keeps earned data, and retains new species across restart',t=>{
  const h=harness(t);earnedProfile(h);
  const original=h.store.selectCompanionCharacter(h.owner,'bear'),health=h.store.snapshot(h.owner);
  h.store.close();
  const legacy=new DatabaseSync(join(h.directory,'forma.sqlite'));
  try { legacy.exec('ALTER TABLE companion_profiles DROP COLUMN pokemon_character'); } finally {legacy.close();}
  h.reopen();assert.deepEqual(h.store.companionSnapshot(h.owner),original);
  assert.deepEqual(h.store.snapshot(h.owner),health);
  const selected=h.store.selectCompanionCharacter(h.owner,'pokemon-151');
  assert.deepEqual(selected,{...original,character:'pokemon-151'});
  h.reopen();assert.deepEqual(h.store.companionSnapshot(h.owner),selected);
  assert.equal((h.store.db.prepare('SELECT character FROM companion_profiles WHERE owner_id=?').get(h.owner) as {character:string}).character,'bear','original column survives for older app versions');
  assert.throws(()=>h.store.db.prepare('UPDATE companion_profiles SET pokemon_character=? WHERE owner_id=?').run('pokemon-999',h.owner),/CHECK constraint failed/);
  assert.deepEqual(h.store.selectCompanionCharacter(h.owner,'cloud'),{...original,character:'cloud'});
});

test('failed profile writes roll back character selection and retain the previous snapshot', t => {
  const h = harness(t); earnedProfile(h);
  const before = h.store.selectCompanionCharacter(h.owner, 'otter');
  h.store.db.exec("CREATE TRIGGER synthetic_character_failure BEFORE UPDATE ON companion_profiles BEGIN SELECT RAISE(ABORT,'synthetic character failure'); END;");
  assert.throws(() => h.store.selectCompanionCharacter(h.owner, 'seal'), /synthetic character failure/);
  assert.deepEqual(h.store.companionSnapshot(h.owner), before);
  h.store.db.exec('DROP TRIGGER synthetic_character_failure');
  assert.deepEqual(h.store.selectCompanionCharacter(h.owner, 'seal'), { ...before, character: 'seal' });
});
