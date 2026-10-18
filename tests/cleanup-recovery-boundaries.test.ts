import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../server/store';
import { parseState } from '../server/validation';
import { mutationHash } from '../server/sync';
import type { Report, SyncChange, SyncMutation } from '../src/types';

const NOW = '2026-10-18T12:00:00.000Z';
const PDF = Buffer.from('%PDF-1.4\nSynthetic private boundary document\n%%EOF');
const change = (value: Report, baseVersion = 0): SyncChange => ({ collection: 'reports', id: value.id, kind: 'upsert', value, baseVersion });
const mutation = (...changes: SyncChange[]): SyncMutation => ({ mutationId: randomUUID(), changes });
const report = (assetId: string): Report => ({ id: randomUUID(), name: 'Synthetic boundary report', date: '2026-10-18', assetId, markers: [], extractionStatus: 'manual', createdAt: NOW });
const apply = (store: Store, ownerId: string, body: SyncMutation) => store.sync(ownerId, body, (_previous, next) => parseState(next));

function fixture(t: TestContext) {
  const base = resolve(process.env.FORMA_TEST_OUTPUT ?? tmpdir());
  mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, 'forma-q18-boundary-'));
  const stores: Store[] = [];
  const closers: (() => Promise<void>)[] = [];
  const open = () => { const store = new Store(directory); stores.push(store); return store; };
  const store = open();
  const account = () => {
    const user = store.createAccount(`boundary-${randomUUID()}@example.test`, 'Synthetic boundary account', 'unused-synthetic-hash', 'unused-synthetic-salt');
    const token = randomBytes(32).toString('hex');
    store.createSession(user.id, token, Date.now() + 60_000);
    return { ...user, cookie: `forma_session=${token}` };
  };
  const owner = account(), other = account();
  const asset = (id = owner.id) => store.addAsset(id, 'synthetic-boundary.pdf', 'application/pdf', PDF);
  const evidence = (name: string, data: unknown) => writeFileSync(join(base, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
  t.after(async () => {
    for (const close of closers.reverse()) await close();
    for (const item of stores) item.close();
    const target = resolve(directory);
    assert.ok(target.startsWith(base + sep) && target.includes('forma-q18-boundary-'));
    rmSync(target, { recursive: true, force: true });
  });
  return { directory, store, owner, other, asset, open, evidence, defer: (close: () => Promise<void>) => closers.push(close) };
}

async function http(f: ReturnType<typeof fixture>) {
  const { createApp } = await import('../server/app');
  const service = createApp({ dataDir: f.directory, secureCookies: false, ai: { apiKey: '' } });
  const server: Server = service.app.listen(0, '127.0.0.1');
  await new Promise<void>(done => server.once('listening', done));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  f.defer(async () => {
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    service.close();
  });
  const request = async (method: string, path: string, account: { id: string; cookie: string }, body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api${path}`, {
      method, headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json', Cookie: account.cookie, 'X-Forma-Account': account.id },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { status: response.status, bytes, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(bytes.toString()) : undefined };
  };
  return { store: service.store, request };
}

function abruptlyExit(mode: 'sync' | 'cleanup', directory: string, ownerId: string, payload: unknown) {
  const child = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./fixtures/cleanup-crash-child.mts', import.meta.url)), mode, directory, ownerId, JSON.stringify(payload)], {
    encoding: 'utf8', timeout: 15_000, windowsHide: true, env: process.env,
  });
  assert.ifError(child.error);
  assert.equal(child.status, 73, `child must reach the intended boundary: ${child.stderr}`);
  assert.equal(child.signal, null);
  assert.ok(child.stdout.includes(`"mode":"${mode}"`), 'child must attest the exact failpoint');
  return { status: child.status, signal: child.signal, stdout: child.stdout, stderr: child.stderr };
}

test('legacy hash-only receipt: replay preserves unknown candidates and other owners without inventing cleanup history', async t => {
  const f = fixture(t), removed = f.asset(), candidate = f.asset(), foreign = f.asset(f.other.id), original = report(removed.id);
  apply(f.store, f.owner.id, mutation(change(original)));
  const deletion = mutation({ collection: 'reports', id: original.id, kind: 'delete', baseVersion: 1 });
  // Model the exact persisted shape of a pre-intent removal: updated state + hash receipt,
  // with no historical asset list. No old database or real account is opened.
  const before = f.store.snapshot(f.owner.id);
  assert.equal(f.store.save(f.owner.id, { ...before.state, reports: [] }, before.revision), true);
  f.store.db.prepare('INSERT INTO sync_mutations VALUES (?,?,?,?)').run(f.owner.id, deletion.mutationId, mutationHash(deletion), NOW);
  const snapshot = f.store.syncSnapshot(f.owner.id);
  f.store.close();
  const h = await http(f);
  const replay = await h.request('POST', '/sync', f.owner, deletion);
  assert.equal(replay.status, 200); assert.deepEqual(replay.body, snapshot);
  assert.deepEqual(h.store.assetCleanupIntents(f.owner.id, deletion.mutationId), []);
  for (const asset of [removed, candidate]) {
    const response = await h.request('GET', `/assets/${asset.id}`, f.owner);
    assert.equal(response.status, 200); assert.deepEqual(response.bytes, PDF);
  }
  assert.equal((await h.request('GET', `/assets/${foreign.id}`, f.owner)).status, 404);
  assert.deepEqual((await h.request('GET', `/assets/${foreign.id}`, f.other)).bytes, PDF);
  const changed = await h.request('POST', '/sync', f.owner, { ...deletion, changes: [change(report(candidate.id))] });
  assert.equal(changed.status, 409);
  assert.deepEqual(h.store.syncSnapshot(f.owner.id), snapshot);
  assert.equal(h.store.db.prepare('SELECT COUNT(*) AS count FROM asset_cleanup_intents').get()?.count, 0);
  f.evidence('legacy-receipt', { replay: replay.status, changedPayload: changed.status, sameSnapshot: true, intentCount: 0, removedAssetRetained: true, candidateRetained: true, otherOwnerIsolated: true, historicalCleanupCandidatesRecoverable: false });
});

test('sync pre-COMMIT abrupt exit rolls back state, versions, receipt and intent together while preserving bytes', t => {
  const f = fixture(t), asset = f.asset(), original = report(asset.id);
  apply(f.store, f.owner.id, mutation(change(original)));
  const baseline = f.store.syncSnapshot(f.owner.id);
  const deletion = mutation({ collection: 'reports', id: original.id, kind: 'delete', baseVersion: 1 });
  f.store.close();
  const child = abruptlyExit('sync', f.directory, f.owner.id, deletion);
  const reopened = f.open();
  assert.deepEqual(reopened.syncSnapshot(f.owner.id), baseline);
  assert.equal(reopened.db.prepare('SELECT COUNT(*) AS count FROM sync_mutations WHERE owner_id=? AND mutation_id=?').get(f.owner.id, deletion.mutationId)?.count, 0);
  assert.deepEqual(reopened.assetCleanupIntents(f.owner.id, deletion.mutationId), []);
  assert.deepEqual(reopened.assetBytes(reopened.asset(f.owner.id, asset.id)!), PDF);
  f.evidence('sync-crash-control', { child, snapshotUnchanged: true, receiptCount: 0, intentCount: 0, bytesIntact: true });
});

test('cleanup pre-COMMIT abrupt exit must not restore readable metadata without its private bytes', async t => {
  const f = fixture(t), removed = f.asset(), candidate = f.asset(), foreign = f.asset(f.other.id), original = report(removed.id);
  apply(f.store, f.owner.id, mutation(change(original)));
  const deletion = mutation({ collection: 'reports', id: original.id, kind: 'delete', baseVersion: 1 });
  apply(f.store, f.owner.id, deletion);
  assert.deepEqual(f.store.assetCleanupIntents(f.owner.id, deletion.mutationId), [removed.id]);
  f.store.close();
  const child = abruptlyExit('cleanup', f.directory, f.owner.id, { mutationId: deletion.mutationId, assetId: removed.id });
  const h = await http(f);
  const metadataRestored = !!h.store.asset(f.owner.id, removed.id);
  const bytesPresent = existsSync(join(f.directory, 'uploads', f.owner.id, removed.id));
  const restoredIntents = h.store.assetCleanupIntents(f.owner.id, deletion.mutationId);
  const beforeReference = await h.request('GET', `/assets/${removed.id}`, f.owner);
  const restoredReference = report(removed.id);
  const reference = await h.request('POST', '/sync', f.owner, mutation(change(restoredReference)));
  const replay = await h.request('POST', '/sync', f.owner, deletion);
  const afterReference = await h.request('GET', `/assets/${removed.id}`, f.owner);
  const candidateResponse = await h.request('GET', `/assets/${candidate.id}`, f.owner);
  const foreignRead = await h.request('GET', `/assets/${foreign.id}`, f.other);
  const crossOwner = await h.request('GET', `/assets/${removed.id}`, f.other);
  const current = h.store.syncSnapshot(f.owner.id);
  f.evidence('cleanup-crash-observation', { child, metadataRestored, bytesPresent, restoredIntents, getBeforeReference: beforeReference.status, referenceStatus: reference.status, oldReceiptReplayStatus: replay.status, getAfterReference: afterReference.status, currentReportReferencesMissingAsset: current.state.reports.some(item => item.assetId === removed.id), intentsAfterReplay: h.store.assetCleanupIntents(f.owner.id, deletion.mutationId), candidateStatus: candidateResponse.status, foreignOwnerStatus: foreignRead.status, crossOwnerStatus: crossOwner.status, expected: 'If metadata survives restart, its original private bytes must still be readable.' });
  assert.equal(candidateResponse.status, 200); assert.deepEqual(candidateResponse.bytes, PDF);
  assert.equal(foreignRead.status, 200); assert.deepEqual(foreignRead.bytes, PDF);
  assert.equal(crossOwner.status, 404);
  assert.ok(!metadataRestored || beforeReference.status === 200, 'cleanup rollback restored asset metadata but rmSync irreversibly removed its bytes before COMMIT');
  if (reference.status === 200)
    assert.equal(afterReference.status, 200, 'an accepted record reference must not point at unreadable bytes after cleanup replay');
});
