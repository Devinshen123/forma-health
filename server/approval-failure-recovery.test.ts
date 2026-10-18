import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Store } from './store';
import { parseState } from './validation';
import type { FoodPhotoDraft, Meal, SyncChange, SyncMutation, SyncSnapshot } from '../src/types';

const NOW = '2026-10-17T12:00:00.000Z';
const RAW_DRAFT = { isFood: true, items: [{ name: 'Synthetic rice', grams: 150, per100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } }], warnings: [] };
interface Account { id: string; cookie: string }
const upsert = <T extends { id: string }>(collection: SyncChange['collection'], value: T, baseVersion = 0): SyncChange => ({ collection, id: value.id, baseVersion, kind: 'upsert', value });
const mutation = (...changes: SyncChange[]): SyncMutation => ({ mutationId: randomUUID(), changes });

/** Public HTTP assertions with deterministic faults confined to a disposable SQLite database. */
async function harness(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-approval-failure-'));
  const peers: Store[] = [];
  let providerCalls = 0;
  const { createApp } = await import('./app');
  const open = async () => {
    const service = createApp({
      dataDir: directory, secureCookies: false,
      ai: { apiKey: 'synthetic-failure-fixture-only', timeoutMs: 1000, retryDelayMs: 0 },
      aiNow: () => Date.parse(NOW),
      aiFetch: async () => {
        providerCalls++;
        return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(RAW_DRAFT) }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    });
    const server: Server = service.app.listen(0, '127.0.0.1');
    await new Promise<void>(done => server.once('listening', done));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    return { service, server, base: `http://127.0.0.1:${address.port}/api` };
  };
  const shut = async (running: Awaited<ReturnType<typeof open>>) => {
    await new Promise<void>((done, reject) => running.server.close(error => error ? reject(error) : done()));
    running.service.close();
  };
  let running = await open();
  t.after(async () => {
    await shut(running);
    for (const peer of peers) peer.close();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-approval-failure-'));
    rmSync(target, { recursive: true, force: true });
  });
  const request = async (method: string, path: string, account?: Account, body?: unknown) => {
    const response = await fetch(running.base + path, { method, headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json', ...(account ? { Cookie: account.cookie, 'X-Forma-Account': account.id } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { status: response.status, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(bytes.toString('utf8')) : undefined, bytes, headers: response.headers };
  };
  const register = async (): Promise<Account> => {
    const result = await request('POST', '/auth/register', undefined, { email: `approval-failure-${randomUUID()}@example.test`, password: 'synthetic-failure-password-2026', name: 'Synthetic fault account' });
    assert.equal(result.status, 201);
    const cookie = result.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
    return { id: result.body.user.id, cookie };
  };
  const snapshot = async (account: Account): Promise<SyncSnapshot> => {
    const result = await request('GET', '/sync', account); assert.equal(result.status, 200); return result.body;
  };
  const photoDraft = async (account: Account): Promise<FoodPhotoDraft> => {
    const { default: sharp } = await import('sharp');
    const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ddd' } }).png().toBuffer();
    const uploaded = await request('POST', '/assets', account, { name: 'synthetic-failure.png', mime: 'image/png', base64: bytes.toString('base64') });
    assert.equal(uploaded.status, 201);
    const analyzed = await request('POST', '/food-photo-drafts', account, { assetId: uploaded.body.id, consent: true, language: 'en' });
    assert.equal(analyzed.status, 201); return analyzed.body;
  };
  const sync = (account: Account, body: SyncMutation) => request('POST', '/sync', account, body);
  const receiptCount = (account: Account, id: string) => running.service.store.db.prepare('SELECT COUNT(*) AS count FROM sync_mutations WHERE owner_id=? AND mutation_id=?').get(account.id, id)?.count;
  /** Closes the HTTP server and its Store, then serves the same SQLite file and uploads from a fresh process-like instance. */
  const restart = async () => { await shut(running); running = await open(); };
  return { request, register, snapshot, photoDraft, sync, receiptCount, restart, get store() { return running.service.store; }, peer: () => { const peer = new Store(directory); peers.push(peer); return peer; }, providerCalls: () => providerCalls };
}

const CLEANUP_FAULT = "CREATE TRIGGER synthetic_cleanup_failure BEFORE DELETE ON assets BEGIN SELECT RAISE(ABORT,'synthetic cleanup failure'); END";

function meal(draft: FoodPhotoDraft, id = randomUUID()): Meal {
  return { id, date: '2026-10-17', name: 'Reviewed synthetic rice', type: 'lunch', grams: 150, referenceGrams: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, source: 'ai_estimate', assetId: draft.assetId, aiDraftId: draft.id, aiItemIndex: 0, createdAt: NOW };
}

test('a second Store reference committed between approval and cleanup protects the same private photo', async t => {
  const h = await harness(t), account = await h.register(), draft = await h.photoDraft(account), approved = meal(draft);
  assert.equal((await h.sync(account, mutation(upsert('meals', approved)))).status, 200);
  const peer = h.peer();
  const report = { id: randomUUID(), name: 'Synthetic concurrent reference', date: '2026-10-17', assetId: draft.assetId, markers: [], extractionStatus: 'manual', createdAt: NOW };
  const removal = mutation({ collection: 'meals', id: approved.id, baseVersion: 1, kind: 'delete' });
  const originalSync = h.store.sync.bind(h.store);
  h.store.sync = (...args) => {
    const result = originalSync(...args);
    if (args[1].mutationId === removal.mutationId && result.previous)
      peer.sync(account.id, mutation(upsert('reports', report)), (_previous, next) => parseState(next));
    return result;
  };
  assert.equal((await h.sync(account, removal)).status, 200);
  const latest = await h.snapshot(account);
  assert.deepEqual(latest.state.meals, []); assert.deepEqual(latest.state.reports, [report]);
  assert.equal((await h.request('GET', `/assets/${draft.assetId}`, account)).status, 200, 'cleanup must recheck the latest references atomically, not its earlier result snapshot');
  const exported = await h.request('GET', '/export', account);
  assert.equal(exported.body.assets[0]?.id, draft.assetId); assert.equal(exported.body.aiDrafts[0]?.id, draft.id);
  assert.equal((await h.request('DELETE', `/assets/${draft.assetId}`, account, {})).status, 409);
  assert.equal(h.providerCalls(), 1);
});

test('HTTP: same-receipt retry finishes a failed post-commit photo cleanup once, owner-scoped and without touching unsaved candidates', async t => {
  const h = await harness(t), account = await h.register(), other = await h.register();
  const oldDraft = await h.photoDraft(account), nextDraft = await h.photoDraft(account), candidate = await h.photoDraft(account);
  const original = meal(oldDraft), replacement = meal(nextDraft, original.id);
  assert.equal((await h.sync(account, mutation(upsert('meals', original)))).status, 200);
  h.store.db.exec(CLEANUP_FAULT);
  const approval = mutation(upsert('meals', replacement, 1));
  assert.equal((await h.sync(account, approval)).status, 500, 'cleanup failure after commit stays an uncertain 500 so the client retries the same mutation');
  const committed = await h.snapshot(account);
  assert.deepEqual(committed.state.meals, [replacement]); assert.equal(committed.revision, 2); assert.equal(h.receiptCount(account, approval.mutationId), 1);
  assert.equal((await h.request('GET', `/assets/${oldDraft.assetId}`, account)).status, 200);
  assert.equal((await h.sync(account, approval)).status, 500, 'a retry that fails again keeps the cleanup retryable');
  h.store.db.exec('DROP TRIGGER synthetic_cleanup_failure');
  assert.notEqual((await h.sync(other, approval)).status, 200, 'another account reusing the mutation ID cannot drive this owner cleanup');
  assert.equal((await h.request('GET', `/assets/${oldDraft.assetId}`, account)).status, 200);
  assert.equal((await h.request('GET', `/assets/${oldDraft.assetId}`, other)).status, 404);
  const replay = await h.sync(account, approval);
  assert.equal(replay.status, 200); assert.deepEqual(replay.body, committed);
  assert.equal((await h.request('GET', `/assets/${oldDraft.assetId}`, account)).status, 404, 'same receipt retry must finish the failed cleanup');
  assert.equal((await h.request('GET', `/assets/${nextDraft.assetId}`, account)).status, 200);
  assert.equal((await h.request('GET', `/assets/${candidate.assetId}`, account)).status, 200, 'an uploaded candidate that no saved record ever referenced is not garbage-collected');
  const again = await h.sync(account, approval);
  assert.equal(again.status, 200); assert.deepEqual(again.body, committed, 'repeat replay is idempotent');
  const exported = await h.request('GET', '/export', account);
  assert.deepEqual(exported.body.assets.map((asset: { id: string }) => asset.id).sort(), [nextDraft.assetId, candidate.assetId].sort());
  assert.deepEqual(exported.body.aiDrafts.map((draft: FoodPhotoDraft) => draft.id).sort(), [nextDraft.id, candidate.id].sort());
  assert.equal(h.providerCalls(), 3, 'saving and retrying never invoke the injected provider');
});

test('HTTP: a failed post-commit cleanup survives a server restart and completes on same-receipt retry', async t => {
  const h = await harness(t), account = await h.register(), oldDraft = await h.photoDraft(account), nextDraft = await h.photoDraft(account);
  const original = meal(oldDraft), replacement = meal(nextDraft, original.id);
  assert.equal((await h.sync(account, mutation(upsert('meals', original)))).status, 200);
  h.store.db.exec(CLEANUP_FAULT);
  const approval = mutation(upsert('meals', replacement, 1));
  assert.equal((await h.sync(account, approval)).status, 500);
  const committed = await h.snapshot(account);
  await h.restart();
  h.store.db.exec('DROP TRIGGER synthetic_cleanup_failure');
  const replay = await h.sync(account, approval);
  assert.equal(replay.status, 200); assert.deepEqual(replay.body, committed);
  assert.equal((await h.request('GET', `/assets/${oldDraft.assetId}`, account)).status, 404, 'the cleanup intent must not live only in process memory');
  assert.equal((await h.request('GET', `/assets/${nextDraft.assetId}`, account)).status, 200);
});

test('a stale cleanup candidate cannot delete bytes referenced by another Store commit', t => {
  const directory = mkdtempSync(join(tmpdir(), 'forma-approval-failure-race-'));
  const store = new Store(directory), peer = new Store(directory);
  t.after(() => {
    peer.close(); store.close();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-approval-failure-race-'));
    rmSync(target, { recursive: true, force: true });
  });
  const account = store.createAccount(`race-${randomUUID()}@example.test`, 'Synthetic race account', 'synthetic-unused-hash', 'synthetic-unused-salt');
  const bytes = Buffer.from('synthetic private photo bytes');
  const asset = store.addAsset(account.id, 'synthetic-race.png', 'image/png', bytes);
  const original = { id: randomUUID(), date: '2026-10-17', name: 'Synthetic meal', type: 'lunch', grams: 100, referenceGrams: 100, kcal: 100, protein: 5, carbs: 10, fat: 2, source: 'manual', assetId: asset.id, createdAt: NOW };
  store.sync(account.id, mutation(upsert('meals', original)), (_previous, next) => parseState(next));
  const removed = store.sync(account.id, mutation({ collection: 'meals', id: original.id, baseVersion: 1, kind: 'delete' }), (_previous, next) => parseState(next));
  assert.equal(removed.previous?.meals[0].assetId, asset.id); assert.deepEqual(removed.snapshot.state.meals, []);
  const report = { id: randomUUID(), name: 'Synthetic peer reference', date: '2026-10-17', assetId: asset.id, markers: [], extractionStatus: 'manual', createdAt: NOW };
  const latest = peer.sync(account.id, mutation(upsert('reports', report)), (_previous, next) => parseState(next)).snapshot;
  assert.equal(store.deleteAsset(account.id, asset.id), false, 'a previous removal candidate is not authority to delete a currently referenced photo');
  assert.deepEqual(peer.syncSnapshot(account.id), latest);
  const kept = peer.asset(account.id, asset.id); assert.ok(kept);
  assert.deepEqual(peer.assetBytes(kept), bytes);
  assert.equal(store.deleteAsset(randomUUID(), asset.id), false, 'another owner cannot delete the private photo');
  peer.sync(account.id, mutation({ collection: 'reports', id: report.id, baseVersion: 1, kind: 'delete' }), (_previous, next) => parseState(next));
  assert.equal(store.deleteAsset(account.id, asset.id), true, 'actual final removal still allows targeted cleanup');
  assert.equal(peer.asset(account.id, asset.id), undefined);
});

function cleanupStores(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-cleanup-intent-'));
  const store = new Store(directory), peer = new Store(directory);
  t.after(() => {
    peer.close(); store.close();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-cleanup-intent-'));
    rmSync(target, { recursive: true, force: true });
  });
  const account = () => store.createAccount(`intent-${randomUUID()}@example.test`, 'Synthetic intent account', 'synthetic-unused-hash', 'synthetic-unused-salt');
  const photo = (ownerId: string) => store.addAsset(ownerId, 'synthetic-intent.png', 'image/png', Buffer.from(`synthetic bytes ${randomUUID()}`));
  const apply = (target: Store, ownerId: string, body: SyncMutation) => target.sync(ownerId, body, (_previous, next) => parseState(next));
  const intents = (ownerId: string) => (store.db.prepare('SELECT mutation_id,asset_id FROM asset_cleanup_intents WHERE owner_id=? ORDER BY created_at,mutation_id').all(ownerId) as { mutation_id: string; asset_id: string }[]).map(row => ({ mutation_id: row.mutation_id, asset_id: row.asset_id }));
  return { store, peer, account, photo, apply, intents };
}
const manualMeal = (assetId?: string) => ({ id: randomUUID(), date: '2026-10-17', name: 'Synthetic meal', type: 'lunch', grams: 100, referenceGrams: 100, kcal: 100, protein: 5, carbs: 10, fat: 2, source: 'manual', ...(assetId ? { assetId } : {}), createdAt: NOW });
const syntheticReport = (assetId: string) => ({ id: randomUUID(), name: 'Synthetic report', date: '2026-10-17', assetId, markers: [], extractionStatus: 'manual', createdAt: NOW });

test('Store: cleanup intents are recorded only for exact previous-to-next removals of the owner attachments', t => {
  const s = cleanupStores(t), owner = s.account();
  const removed = s.photo(owner.id), moved = s.photo(owner.id), candidate = s.photo(owner.id);
  const first = manualMeal(removed.id), second = manualMeal(moved.id);
  const created = mutation(upsert('meals', first), upsert('meals', second));
  s.apply(s.store, owner.id, created);
  assert.deepEqual(s.intents(owner.id), [], 'adding references records nothing');
  const report = syntheticReport(moved.id);
  const change = mutation({ collection: 'meals', id: first.id, baseVersion: 1, kind: 'delete' }, { collection: 'meals', id: second.id, baseVersion: 1, kind: 'delete' }, upsert('reports', report));
  s.apply(s.store, owner.id, change);
  assert.deepEqual(s.intents(owner.id), [{ mutation_id: change.mutationId, asset_id: removed.id }], 'a reference moved to a report and a never-saved candidate are not cleanup intents');
  assert.ok(s.store.asset(owner.id, candidate.id));
  assert.deepEqual(s.store.assetCleanupIntents(s.account().id, change.mutationId), [], 'another owner sees no intent for the same mutation ID');
});

test('Store: a reference committed by another Store after the intent keeps the photo and consumes only that intent', t => {
  const s = cleanupStores(t), owner = s.account(), asset = s.photo(owner.id), original = manualMeal(asset.id);
  s.apply(s.store, owner.id, mutation(upsert('meals', original)));
  const removal = mutation({ collection: 'meals', id: original.id, baseVersion: 1, kind: 'delete' });
  s.apply(s.store, owner.id, removal);
  const report = syntheticReport(asset.id);
  s.apply(s.peer, owner.id, mutation(upsert('reports', report)));
  assert.equal(s.store.completeAssetCleanup(owner.id, removal.mutationId, asset.id), false);
  assert.ok(s.peer.asset(owner.id, asset.id), 'latest reference wins over the recorded intent');
  assert.deepEqual(s.intents(owner.id), []);
  assert.equal(s.store.completeAssetCleanup(owner.id, removal.mutationId, asset.id), false, 'repeating a consumed intent is a no-op');
  const finalRemoval = mutation({ collection: 'reports', id: report.id, baseVersion: 1, kind: 'delete' });
  s.apply(s.peer, owner.id, finalRemoval);
  assert.deepEqual(s.store.assetCleanupIntents(owner.id, finalRemoval.mutationId), [asset.id], 'the later real removal records its own intent');
  assert.equal(s.peer.completeAssetCleanup(owner.id, finalRemoval.mutationId, asset.id), true);
  assert.equal(s.store.completeAssetCleanup(owner.id, finalRemoval.mutationId, asset.id), false, 'a second Store consuming the same intent after deletion is safe');
  assert.equal(s.store.asset(owner.id, asset.id), undefined);
});

test('Store: an old replay for the same photo neither deletes it while re-referenced nor drops a newer mutation intent', t => {
  const s = cleanupStores(t), owner = s.account(), asset = s.photo(owner.id);
  const meal1 = manualMeal(asset.id);
  s.apply(s.store, owner.id, mutation(upsert('meals', meal1)));
  const older = mutation({ collection: 'meals', id: meal1.id, baseVersion: 1, kind: 'delete' });
  s.apply(s.store, owner.id, older);
  const meal2 = manualMeal(asset.id);
  s.apply(s.store, owner.id, mutation(upsert('meals', meal2)));
  const newer = mutation({ collection: 'meals', id: meal2.id, baseVersion: 1, kind: 'delete' });
  s.apply(s.store, owner.id, newer);
  assert.deepEqual(s.intents(owner.id).map(row => row.mutation_id).sort(), [older.mutationId, newer.mutationId].sort());
  const meal3 = manualMeal(asset.id);
  s.apply(s.store, owner.id, mutation(upsert('meals', meal3)));
  assert.equal(s.store.completeAssetCleanup(owner.id, older.mutationId, asset.id), false);
  assert.ok(s.store.asset(owner.id, asset.id));
  assert.deepEqual(s.intents(owner.id).map(row => row.mutation_id), [newer.mutationId], 'consuming the old intent leaves the newer one');
  s.apply(s.store, owner.id, mutation({ collection: 'meals', id: meal3.id, baseVersion: 1, kind: 'delete' }));
  assert.equal(s.store.completeAssetCleanup(owner.id, newer.mutationId, asset.id), true, 'the newer intent still completes cleanup once the photo is unreferenced');
  assert.deepEqual(s.intents(owner.id), [], 'deleting the photo retires every intent that targeted it');
});

test('Store: completing cleanup without the exact recorded intent has no side effect', t => {
  const s = cleanupStores(t), owner = s.account(), bytes = Buffer.from(`synthetic unsaved candidate ${randomUUID()}`);
  const candidate = s.store.addAsset(owner.id, 'synthetic-candidate.png', 'image/png', bytes);
  assert.equal(s.store.completeAssetCleanup(owner.id, randomUUID(), candidate.id), false, 'no intent exists for an unsaved candidate');
  assert.deepEqual(s.store.assetBytes(s.store.asset(owner.id, candidate.id)!), bytes);
  const removed = s.photo(owner.id), original = manualMeal(removed.id);
  s.apply(s.store, owner.id, mutation(upsert('meals', original)));
  const removal = mutation({ collection: 'meals', id: original.id, baseVersion: 1, kind: 'delete' });
  s.apply(s.store, owner.id, removal);
  assert.equal(s.store.completeAssetCleanup(owner.id, randomUUID(), removed.id), false, 'a mismatched mutation ID is not authority to delete');
  assert.equal(s.store.completeAssetCleanup(owner.id, removal.mutationId, candidate.id), false, 'a real mutation ID does not cover an asset it never removed');
  assert.ok(s.store.asset(owner.id, removed.id)); assert.deepEqual(s.store.assetBytes(s.store.asset(owner.id, candidate.id)!), bytes);
  assert.deepEqual(s.store.assetCleanupIntents(owner.id, removal.mutationId), [removed.id], 'mismatched calls leave the real intent intact');
  assert.equal(s.store.completeAssetCleanup(owner.id, removal.mutationId, removed.id), true);
  assert.equal(s.store.completeAssetCleanup(owner.id, removal.mutationId, removed.id), false, 'repeating the consumed intent is a no-op');
  assert.equal(s.store.asset(owner.id, removed.id), undefined);
  assert.deepEqual(s.store.assetBytes(s.store.asset(owner.id, candidate.id)!), bytes);
});

test('Store: a failed intent write rolls back the commit and receipt; a failed delete keeps the intent', t => {
  const s = cleanupStores(t), owner = s.account(), asset = s.photo(owner.id), original = manualMeal(asset.id);
  s.apply(s.store, owner.id, mutation(upsert('meals', original)));
  const baseline = s.store.syncSnapshot(owner.id);
  const removal = mutation({ collection: 'meals', id: original.id, baseVersion: 1, kind: 'delete' });
  s.store.db.exec("CREATE TRIGGER synthetic_intent_failure BEFORE INSERT ON asset_cleanup_intents BEGIN SELECT RAISE(ABORT,'synthetic intent failure'); END");
  assert.throws(() => s.apply(s.store, owner.id, removal), /synthetic intent failure/);
  assert.deepEqual(s.store.syncSnapshot(owner.id), baseline, 'state, revision and versions are unchanged');
  assert.equal(s.store.db.prepare('SELECT COUNT(*) AS count FROM sync_mutations WHERE owner_id=? AND mutation_id=?').get(owner.id, removal.mutationId)?.count, 0);
  s.store.db.exec('DROP TRIGGER synthetic_intent_failure');
  s.apply(s.store, owner.id, removal);
  s.store.db.exec(CLEANUP_FAULT);
  assert.throws(() => s.store.completeAssetCleanup(owner.id, removal.mutationId, asset.id), /synthetic cleanup failure/);
  assert.deepEqual(s.store.assetCleanupIntents(owner.id, removal.mutationId), [asset.id]);
  assert.ok(s.store.assetBytes(s.store.asset(owner.id, asset.id)!).length > 0, 'bytes stay with their row when the row delete fails');
  s.store.db.exec('DROP TRIGGER synthetic_cleanup_failure');
  assert.equal(s.peer.completeAssetCleanup(owner.id, removal.mutationId, asset.id), true, 'a reopened or peer Store resumes the persisted intent');
  assert.deepEqual(s.store.assetCleanupIntents(owner.id, removal.mutationId), []);
});

test('SQL failures after state updates roll back the whole approval batch and leave its mutation ID retryable', async t => {
  for (const table of ['sync_entities', 'sync_mutations']) await t.test(`aborted ${table} write`, async subtest => {
    const directory = mkdtempSync(join(tmpdir(), 'forma-approval-failure-sql-'));
    const store = new Store(directory);
    subtest.after(() => {
      store.close();
      const target = resolve(directory);
      assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-approval-failure-sql-'));
      rmSync(target, { recursive: true, force: true });
    });
    const account = store.createAccount(`sql-${randomUUID()}@example.test`, 'Synthetic SQL account', 'synthetic-unused-hash', 'synthetic-unused-salt');
    const baseline = store.syncSnapshot(account.id);
    const first = { id: randomUUID(), date: '2026-10-17', name: 'Synthetic first meal', type: 'lunch', grams: 100, referenceGrams: 100, kcal: 100, protein: 5, carbs: 10, fat: 2, source: 'manual', createdAt: NOW };
    const second = { ...first, id: randomUUID(), name: 'Synthetic second meal' };
    const approval = mutation(upsert('meals', first), upsert('meals', second));
    // The entity fault fires only after state and the first meal version have been written.
    const condition = table === 'sync_entities' ? ` WHEN NEW.entity_key='meals:${second.id}'` : '';
    store.db.exec(`CREATE TRIGGER synthetic_write_failure BEFORE INSERT ON ${table}${condition} BEGIN SELECT RAISE(ABORT,'synthetic approval write failure'); END`);
    assert.throws(() => store.sync(account.id, approval, (_previous, next) => parseState(next)), /synthetic approval write failure/);
    assert.deepEqual(store.syncSnapshot(account.id), baseline, 'state, revision and entity versions remain exactly unchanged');
    assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM sync_mutations WHERE owner_id=? AND mutation_id=?').get(account.id, approval.mutationId)?.count, 0);
    store.db.exec('DROP TRIGGER synthetic_write_failure');
    const saved = store.sync(account.id, approval, (_previous, next) => parseState(next)).snapshot;
    assert.deepEqual(saved.state.meals, [first, second]); assert.equal(saved.revision, baseline.revision + 1);
    assert.equal(saved.entityVersions[`meals:${first.id}`], 1); assert.equal(saved.entityVersions[`meals:${second.id}`], 1);
    assert.deepEqual(store.sync(account.id, approval, (_previous, next) => parseState(next)).snapshot, saved);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM sync_mutations WHERE owner_id=? AND mutation_id=?').get(account.id, approval.mutationId)?.count, 1);
  });
});
