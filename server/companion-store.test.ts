import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from './store';
import { CompanionError } from './companion';
import { SyncConflict } from './sync';
import { emptyState, type AppState, type Profile, type Meal, type Workout, type Sleep } from '../src/types';

const profile: Profile = { name: 'Synthetic', goal: 'habits', experience: 'new', trainingDays: 3, timeMinutes: 30, equipment: 'home', allergies: '', restrictions: '', language: 'en', units: 'metric', timezone: 'UTC', sleepGoal: 8, cloudConsent: false, aiConsent: false };
const meal = (day: string, id = randomUUID()): Meal => ({ id, date: day, name: 'Synthetic meal', type: 'lunch', grams: 100, referenceGrams: 100, kcal: 50, protein: 2, carbs: 4, fat: 1, source: 'manual', createdAt: `${day}T12:00:00.000Z` });
const workout = (day: string): Workout => ({ id: randomUUID(), date: day, name: 'Synthetic workout', duration: 10, rpe: null, exercises: [{ name: 'Synthetic exercise', sets: 1, reps: 2, weight: 0 }], notes: '', createdAt: `${day}T12:00:00.000Z` });
function harness(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-companion-store-'));
  let now = Date.parse('2026-10-19T12:00:00.000Z');
  const store = new Store(directory, () => now);
  const account = store.createAccount('synthetic@companion-store.test', 'Synthetic', 'unused', 'unused');
  const owner = account.id;
  t.after(() => {
    store.close();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.includes('forma-companion-store-'));
    rmSync(directory, { recursive: true, force: true });
  });
  const save = (state: AppState) => { assert.equal(store.save(owner, state, store.snapshot(owner).revision), true); };
  return { store, directory, owner, save, setNow: (value: string) => { now = Date.parse(value); } };
}

test('companion save atomically rolls back health, observed identities and XP after a ledger error', t => {
  const h = harness(t), next = { ...emptyState(), profile, meals: [meal('2026-10-19')] };
  h.store.db.exec("CREATE TRIGGER synthetic_reward_failure BEFORE INSERT ON companion_rewards BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
  assert.throws(() => h.save(next), /synthetic failure/);
  assert.equal(h.store.snapshot(h.owner).revision, 0);
  assert.deepEqual(h.store.snapshot(h.owner).state.meals, []);
  assert.equal(h.store.companionSnapshot(h.owner).xp, 0);
  assert.equal((h.store.db.prepare('SELECT COUNT(*) AS count FROM companion_seen_facts').get() as { count: number }).count, 0);
  h.store.db.exec('DROP TRIGGER synthetic_reward_failure');
  h.save(next);
  assert.equal(h.store.companionSnapshot(h.owner).xp, 10);
  assert.equal(h.store.save(h.owner, { ...next, meals: [...next.meals, meal('2026-10-19')] }, 0), false);
  assert.equal(h.store.companionSnapshot(h.owner).xp, 10);
});

test('companion only rewards first observation; claim, timezone/date edits and delete/recreate never backfill', t => {
  const h = harness(t), old = meal('2026-10-18');
  // Existing pre-feature records are deliberately introduced without invoking the new write path.
  h.store.db.prepare('UPDATE states SET state_json=? WHERE owner_id=?').run(JSON.stringify({ ...emptyState(), profile, meals: [old] }), h.owner);
  assert.equal(h.store.claimCompanion(h.owner).xp, 0);
  h.save({ ...h.store.snapshot(h.owner).state, meals: [{ ...old, date: '2026-10-19' }] });
  assert.equal(h.store.claimCompanion(h.owner).xp, 0);
  h.save({ ...h.store.snapshot(h.owner).state, meals: [] });
  h.save({ ...h.store.snapshot(h.owner).state, meals: [{ ...old, date: '2026-10-19' }] });
  assert.equal(h.store.companionSnapshot(h.owner).xp, 0);
  h.setNow('2026-10-20T00:30:00.000Z');
  h.save({ ...h.store.snapshot(h.owner).state, profile: { ...profile, timezone: 'America/Los_Angeles' } });
  assert.equal(h.store.claimCompanion(h.owner).xp, 0);
  h.save({ ...h.store.snapshot(h.owner).state, meals: [old, meal('2026-10-19')] });
  assert.equal(h.store.companionSnapshot(h.owner).xp, 10);
  h.setNow('2026-10-21T12:00:00.000Z');
  const earned = h.store.snapshot(h.owner).state.meals[1];
  h.save({ ...h.store.snapshot(h.owner).state, meals: [{ ...earned, date: '2026-10-21' }] });
  assert.equal(h.store.claimCompanion(h.owner).xp, 10);
});

test('sync validation/conflict failure and replay do not mint rewards or observed facts', t => {
  const h = harness(t), first = meal('2026-10-19');
  const mutation = { mutationId: randomUUID(), changes: [{ collection: 'meals' as const, id: first.id, baseVersion: 0, kind: 'upsert' as const, value: first }, { collection: 'profile' as const, id: 'profile', baseVersion: 0, kind: 'upsert' as const, value: profile }] };
  assert.throws(() => h.store.sync(h.owner, mutation, () => { throw new Error('synthetic validation failure'); }), /synthetic validation/);
  assert.equal(h.store.companionSnapshot(h.owner).xp, 0);
  const result = h.store.sync(h.owner, mutation, (_before, next) => next);
  assert.equal(result.snapshot.state.meals.length, 1);
  assert.equal(h.store.companionSnapshot(h.owner).xp, 10);
  h.store.sync(h.owner, mutation, () => { throw new Error('a replay must not validate twice'); });
  assert.equal(h.store.companionSnapshot(h.owner).xp, 10);
  assert.throws(() => h.store.sync(h.owner, { ...mutation, mutationId: randomUUID() }, (_before, next) => next), SyncConflict);
});

test('late workbench failure rolls back projected facts and rewards; successful retry settles once', t => {
  const h = harness(t); h.save({ ...emptyState(), profile });
  const projected = workout('2026-10-19'), write = { state: { workouts: [], routines: [] }, baseRev: 0, stamped: true };
  h.store.db.exec("CREATE TRIGGER synthetic_workbench_failure BEFORE INSERT ON workbench_states BEGIN SELECT RAISE(ABORT,'synthetic workbench failure'); END;");
  assert.throws(() => h.store.saveWorkbench(h.owner, write, { workouts: [projected], warnings: [] }), /synthetic workbench failure/);
  assert.equal(h.store.companionSnapshot(h.owner).xp, 0);
  assert.deepEqual(h.store.snapshot(h.owner).state.workouts, []);
  assert.equal(h.store.workbenchSnapshot(h.owner).rev, 0);
  h.store.db.exec('DROP TRIGGER synthetic_workbench_failure');
  h.store.saveWorkbench(h.owner, write, { workouts: [projected], warnings: [] });
  h.store.saveWorkbench(h.owner, write, { workouts: [projected], warnings: [] });
  assert.equal(h.store.companionSnapshot(h.owner).xp, 10);
  assert.equal(h.store.snapshot(h.owner).state.workouts.length, 1);
});

test('rest and workout share movement; three active UTC days unlock one deterministic chest', t => {
  const h = harness(t); h.save({ ...emptyState(), profile });
  for (let day = 19; day <= 21; day++) {
    h.setNow(`2026-10-${day}T12:00:00.000Z`);
    h.store.claimCompanion(h.owner, true);
    h.store.claimCompanion(h.owner, true);
    h.save({ ...h.store.snapshot(h.owner).state, workouts: [...h.store.snapshot(h.owner).state.workouts, workout(`2026-10-${day}`)] });
  }
  const snapshot = h.store.companionSnapshot(h.owner);
  assert.equal(snapshot.xp, 30); assert.equal(snapshot.activeDays, 3); assert.equal(snapshot.chests.length, 1);
  const chest = snapshot.chests[0];
  assert.equal(chest.milestone, 3); assert.equal(chest.item, null);
  const opened = h.store.openCompanionChest(h.owner, chest.id);
  assert.deepEqual(opened.inventory, ['leaf']);
  h.setNow('2026-10-21T13:00:00.000Z');
  assert.deepEqual(h.store.openCompanionChest(h.owner, chest.id).chests, opened.chests);
  assert.equal(h.store.equipCompanion(h.owner, 'leaf').equipped, 'leaf');
  assert.throws(() => h.store.equipCompanion(h.owner, 'crown'), (error: unknown) => error instanceof CompanionError && error.code === 'ITEM_NOT_OWNED');
});

test('challenge counts only post-join rewards, exports self only, and member deletion revokes the invitation', t => {
  const h = harness(t); h.save({ ...emptyState(), profile });
  h.store.claimCompanion(h.owner, true);
  const created = h.store.companionChallenge(h.owner, 'create').challenge!;
  assert.equal(created.participants[0].days, 0);
  const b = h.store.createAccount('other@companion-store.test', 'Other', 'unused', 'unused');
  h.store.save(b.id, { ...emptyState(), profile }, 0);
  const joined = h.store.companionChallenge(b.id, 'join', created.code).challenge!;
  assert.equal(joined.participants.length, 2);
  h.store.companionChallenge(b.id, 'join', created.code);
  h.save({ ...h.store.snapshot(h.owner).state, meals: [meal('2026-10-19')] });
  assert.equal(h.store.companionSnapshot(h.owner).challenge!.participants[0].days, 1);
  assert.equal(h.store.companionSnapshot(b.id).challenge!.participants.find(member => !member.self)!.days, 1);
  const exported = h.store.exportCompanion(b.id);
  assert.equal(JSON.stringify(exported).includes(h.owner), false);
  assert.equal(exported.challenges[0].days, 0);
  h.store.deleteAccount(b.id);
  assert.equal(h.store.companionSnapshot(h.owner).challenge, null);
  assert.throws(() => h.store.companionChallenge(h.owner, 'join', created.code), (error: unknown) => error instanceof CompanionError && error.status === 404);
  assert.equal((h.store.db.prepare('SELECT COUNT(*) AS count FROM companion_seen_facts WHERE owner_id=?').get(b.id) as { count: number }).count, 0);
});

test('travel sleep eligibility follows the sleep record wake zone while reward quotas follow profile-local and UTC days', t => {
  const h = harness(t); h.setNow('2026-10-20T00:30:00.000Z');
  const travelProfile = { ...profile, timezone: 'America/Los_Angeles' };
  const sleep: Sleep = { id: randomUUID(), date: '2026-10-20', start: '2026-10-19T16:00:00.000Z', end: '2026-10-20T00:00:00.000Z', timezone: 'Asia/Tokyo', quality: 3, energy: 3, source: 'manual', createdAt: '2026-10-20T00:01:00.000Z' };
  h.save({ ...emptyState(), profile: travelProfile, sleeps: [sleep] });
  assert.equal(h.store.companionSnapshot(h.owner).xp, 10);
  const [reward] = h.store.exportCompanion(h.owner).rewards;
  assert.equal(reward.day, '2026-10-20'); assert.equal(reward.localDay, '2026-10-19');
  const b = h.store.createAccount('stale-travel@companion-store.test', 'Synthetic stale sleep', 'unused', 'unused');
  const stale = { ...sleep, id: randomUUID(), date: '2026-10-19', start: '2026-10-19T06:00:00.000Z', end: '2026-10-19T14:00:00.000Z' };
  h.store.save(b.id, { ...emptyState(), profile: travelProfile, sleeps: [stale] }, 0);
  assert.equal(h.store.companionSnapshot(b.id).xp, 0);
});

test('ended challenge results remain read-only for 48 hours, permit a new challenge and can be dismissed', t => {
  const h = harness(t); h.save({ ...emptyState(), profile });
  const first = h.store.companionChallenge(h.owner, 'create').challenge!;
  h.store.claimCompanion(h.owner, true);
  h.setNow(first.endsAt);
  const ended = h.store.companionSnapshot(h.owner).challenge!;
  assert.equal(ended.id, first.id); assert.equal(ended.participants[0].days, 1);
  h.store.claimCompanion(h.owner, true);
  assert.equal(h.store.companionSnapshot(h.owner).challenge!.participants[0].days, 1);
  h.setNow('2026-10-27T23:59:59.999Z');
  assert.equal(h.store.companionSnapshot(h.owner).challenge!.id, first.id);
  h.setNow('2026-10-28T00:00:00.000Z');
  assert.equal(h.store.companionSnapshot(h.owner).challenge, null);
  const second = h.store.companionChallenge(h.owner, 'create').challenge!;
  assert.notEqual(second.id, first.id);
  h.setNow(second.endsAt);
  assert.equal(h.store.companionSnapshot(h.owner).challenge!.id, second.id);
  assert.equal(h.store.companionChallenge(h.owner, 'leave').challenge, null);
  const third = h.store.companionChallenge(h.owner, 'create').challenge!;
  h.setNow(third.endsAt);
  const fourth = h.store.companionChallenge(h.owner, 'create').challenge!;
  assert.notEqual(fourth.id, third.id);
  assert.equal(h.store.companionSnapshot(h.owner).challenge!.id, fourth.id);
});

test('snapshot and non-rest claim use deferred reads while an independent WAL connection holds the writer', t => {
  const h = harness(t); h.save({ ...emptyState(), profile });
  const writer = new DatabaseSync(join(h.directory, 'forma.sqlite'));
  h.store.db.exec('PRAGMA busy_timeout=0');
  writer.exec('PRAGMA busy_timeout=0; BEGIN IMMEDIATE');
  try {
    assert.equal(h.store.companionSnapshot(h.owner).xp, 0);
    assert.equal(h.store.claimCompanion(h.owner).xp, 0);
    assert.throws(() => h.store.claimCompanion(h.owner, true), /locked/);
  } finally { writer.exec('ROLLBACK'); writer.close(); }
  assert.equal(h.store.claimCompanion(h.owner, true).xp, 10);
});
