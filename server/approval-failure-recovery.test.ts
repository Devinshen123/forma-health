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
  const base = `http://127.0.0.1:${address.port}/api`;
  t.after(async () => {
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    for (const peer of peers) peer.close();
    service.close();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-approval-failure-'));
    rmSync(target, { recursive: true, force: true });
  });
  const request = async (method: string, path: string, account?: Account, body?: unknown) => {
    const response = await fetch(base + path, { method, headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json', ...(account ? { Cookie: account.cookie, 'X-Forma-Account': account.id } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
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
  const receiptCount = (account: Account, id: string) => service.store.db.prepare('SELECT COUNT(*) AS count FROM sync_mutations WHERE owner_id=? AND mutation_id=?').get(account.id, id)?.count;
  return { request, register, snapshot, photoDraft, sync, receiptCount, store: service.store, peer: () => { const peer = new Store(directory); peers.push(peer); return peer; }, providerCalls: () => providerCalls };
}

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
