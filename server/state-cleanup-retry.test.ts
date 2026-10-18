import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import type { AppState } from '../src/types';

interface Account { id: string; cookie: string }
interface Snapshot { state: AppState; revision: number }
const NOW = '2026-10-18T12:00:00.000Z';
const CLEANUP_FAULT = "CREATE TRIGGER synthetic_put_cleanup_failure BEFORE DELETE ON assets BEGIN SELECT RAISE(ABORT,'synthetic PUT cleanup failure'); END";

/** Only synthetic HTTP accounts, private PDF bytes and a disposable SQLite database. */
async function harness(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-state-cleanup-'));
  const { createApp } = await import('./app');
  const open = async () => {
    const service = createApp({ dataDir: directory, secureCookies: false,
      aiFetch: async () => { throw new Error('External AI is forbidden in this fixture'); },
    });
    const server: Server = service.app.listen(0, '127.0.0.1');
    await new Promise<void>(done => server.once('listening', done));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    return { service, server, base: `http://127.0.0.1:${address.port}/api` };
  };
  const close = async (running: Awaited<ReturnType<typeof open>>) => {
    await new Promise<void>((done, reject) => running.server.close(error => error ? reject(error) : done()));
    running.service.close();
  };
  let running = await open();
  t.after(async () => {
    await close(running);
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-state-cleanup-'));
    rmSync(target, { recursive: true, force: true });
  });
  const request = async (method: string, path: string, account?: Account, body?: unknown) => {
    const response = await fetch(running.base + path, { method,
      headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json',
        ...(account ? { Cookie: account.cookie, 'X-Forma-Account': account.id } : {}),
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { status: response.status, bytes, headers: response.headers,
      body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(bytes.toString('utf8')) : undefined,
    };
  };
  const register = async (): Promise<Account> => {
    const result = await request('POST', '/auth/register', undefined,
      { email: `put-cleanup-${randomUUID()}@example.test`, password: 'synthetic-put-password-2026', name: 'Synthetic PUT account' });
    assert.equal(result.status, 201);
    const cookie = result.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
    return { id: result.body.user.id, cookie };
  };
  const snapshot = async (account: Account): Promise<Snapshot> => {
    const result = await request('GET', '/state', account); assert.equal(result.status, 200); return result.body;
  };
  const pdf = async (account: Account) => {
    const bytes = Buffer.from(`%PDF-1.7\nSynthetic private fixture ${randomUUID()}\n%%EOF`);
    const result = await request('POST', '/assets', account,
      { name: 'synthetic-put.pdf', mime: 'application/pdf', base64: bytes.toString('base64') });
    assert.equal(result.status, 201); return { id: result.body.id as string, bytes };
  };
  const put = (account: Account, body: Snapshot) => request('PUT', '/state', account, body);
  return { request, register, snapshot, pdf, put, get store() { return running.service.store; },
    restart: async () => { await close(running); running = await open(); },
  };
}

const report = (assetId: string) => ({ id: randomUUID(), name: 'Synthetic attached report', date: '2026-10-18',
  assetId, markers: [], extractionStatus: 'manual' as const, createdAt: NOW });

test('PUT: a failed post-commit cleanup resumes after restart while stale retries remain 409', async t => {
  const h = await harness(t), owner = await h.register();
  const old = await h.pdf(owner), unsaved = await h.pdf(owner), initial = await h.snapshot(owner);
  assert.equal((await h.put(owner, { ...initial, state: { ...initial.state, reports: [report(old.id)] } })).status, 200);
  const before = await h.snapshot(owner), removal = { ...before, state: { ...before.state, reports: [] } };
  h.store.db.exec(CLEANUP_FAULT);
  assert.equal((await h.put(owner, removal)).status, 500, 'only post-commit cleanup fails');
  const committed = await h.snapshot(owner);
  assert.equal(committed.revision, before.revision + 1);
  assert.deepEqual(committed.state.reports, []);
  assert.deepEqual((await h.request('GET', `/assets/${old.id}`, owner)).bytes, old.bytes);
  assert.equal((await h.put(owner, removal)).status, 409, 'an ongoing cleanup fault does not change the stale PUT contract');
  assert.deepEqual(await h.snapshot(owner), committed);
  h.store.db.exec('DROP TRIGGER synthetic_put_cleanup_failure');
  await h.restart();
  const retry = await h.put(owner, removal);
  assert.equal(retry.status, 409, 'a stale PUT never silently becomes a successful write');
  assert.equal(retry.body.revision, committed.revision);
  assert.equal((await h.request('GET', `/assets/${old.id}`, owner)).status, 404, 'the committed removal retains durable authority to finish cleanup');
  assert.deepEqual((await h.request('GET', `/assets/${unsaved.id}`, owner)).bytes, unsaved.bytes, 'an unsaved upload is never a cleanup candidate');
  assert.equal((await h.put(owner, removal)).status, 409);
  assert.deepEqual(await h.snapshot(owner), committed, 'repeated retries do not increment revision or rewrite state');
});

test('PUT: intent insertion failure rolls back the state, revision and entity versions', async t => {
  const h = await harness(t), owner = await h.register(), old = await h.pdf(owner), initial = await h.snapshot(owner);
  assert.equal((await h.put(owner, { ...initial, state: { ...initial.state, reports: [report(old.id)] } })).status, 200);
  const before = await h.snapshot(owner), syncBefore = await h.request('GET', '/sync', owner);
  const removal = { ...before, state: { ...before.state, reports: [] } };
  h.store.db.exec("CREATE TRIGGER synthetic_put_intent_failure BEFORE INSERT ON asset_cleanup_intents BEGIN SELECT RAISE(ABORT,'synthetic PUT intent failure'); END");
  assert.equal((await h.put(owner, removal)).status, 500);
  assert.deepEqual(await h.snapshot(owner), before, 'the intent and state commit are one transaction');
  assert.deepEqual((await h.request('GET', '/sync', owner)).body, syncBefore.body, 'entity versions also roll back');
  assert.deepEqual((await h.request('GET', `/assets/${old.id}`, owner)).bytes, old.bytes);
  h.store.db.exec('DROP TRIGGER synthetic_put_intent_failure');
  assert.equal((await h.put(owner, removal)).status, 200, 'the original revision remains usable after rollback');
  assert.equal((await h.request('GET', `/assets/${old.id}`, owner)).status, 404);
});

test('PUT: retries are authenticated, parsed and owner-scoped before consuming cleanup authority', async t => {
  const h = await harness(t), owner = await h.register(), other = await h.register();
  const old = await h.pdf(owner), candidate = await h.pdf(owner), foreign = await h.pdf(other), initial = await h.snapshot(owner);
  assert.equal((await h.put(owner, { ...initial, state: { ...initial.state, reports: [report(old.id)] } })).status, 200);
  const before = await h.snapshot(owner), removal = { ...before, state: { ...before.state, reports: [] } };
  h.store.db.exec(CLEANUP_FAULT);
  assert.equal((await h.put(owner, removal)).status, 500);
  h.store.db.exec('DROP TRIGGER synthetic_put_cleanup_failure');
  assert.equal((await h.put(other, removal)).status, 409, 'another account at a different revision cannot resume the owner cleanup');
  assert.equal((await h.put({ id: owner.id, cookie: other.cookie }, removal)).status, 401, 'a stale account hint never reaches cleanup');
  assert.equal((await h.request('PUT', '/state', owner, { revision: before.revision, state: {} })).status, 400, 'malformed state never reaches cleanup');
  assert.deepEqual((await h.request('GET', `/assets/${old.id}`, owner)).bytes, old.bytes, 'the real owner intent still awaits its valid retry');
  const unrelatedPayload = { ...removal, state: { ...removal.state, reports: [report(foreign.id)] } };
  assert.equal((await h.put(owner, unrelatedPayload)).status, 409, 'stale payload content is never applied or used to choose cleanup candidates');
  assert.equal((await h.request('GET', `/assets/${old.id}`, owner)).status, 404);
  assert.deepEqual((await h.request('GET', `/assets/${candidate.id}`, owner)).bytes, candidate.bytes);
  assert.deepEqual((await h.request('GET', `/assets/${foreign.id}`, other)).bytes, foreign.bytes);
  assert.equal((await h.request('GET', `/assets/${foreign.id}`, owner)).status, 404);
  assert.deepEqual((await h.snapshot(owner)).state.reports, []);
});

test('PUT: a fresh reference added before an old retry protects the private attachment bytes', async t => {
  const h = await harness(t), owner = await h.register(), old = await h.pdf(owner), initial = await h.snapshot(owner);
  assert.equal((await h.put(owner, { ...initial, state: { ...initial.state, reports: [report(old.id)] } })).status, 200);
  const before = await h.snapshot(owner), removal = { ...before, state: { ...before.state, reports: [] } };
  h.store.db.exec(CLEANUP_FAULT);
  assert.equal((await h.put(owner, removal)).status, 500);
  h.store.db.exec('DROP TRIGGER synthetic_put_cleanup_failure');
  const committed = await h.snapshot(owner), restored = { ...committed, state: { ...committed.state, reports: [report(old.id)] } };
  assert.equal((await h.put(owner, restored)).status, 200);
  const latest = await h.snapshot(owner);
  assert.equal((await h.put(owner, removal)).status, 409);
  assert.deepEqual(await h.snapshot(owner), latest, 'old retry cannot delete the later record');
  assert.deepEqual((await h.request('GET', `/assets/${old.id}`, owner)).bytes, old.bytes, 'latest references are rechecked under the cleanup write lock');
  assert.equal((await h.put(owner, { ...latest, state: { ...latest.state, reports: [] } })).status, 200);
  assert.equal((await h.request('GET', `/assets/${old.id}`, owner)).status, 404, 'the later actual removal records its own cleanup authority');
});

test('PUT: moving the same attachment between reports does not select it for cleanup', async t => {
  const h = await harness(t), owner = await h.register(), kept = await h.pdf(owner), removed = await h.pdf(owner), candidate = await h.pdf(owner);
  const initial = await h.snapshot(owner);
  assert.equal((await h.put(owner, { ...initial, state: { ...initial.state, reports: [report(kept.id), report(removed.id)] } })).status, 200);
  const before = await h.snapshot(owner);
  assert.equal((await h.put(owner, { ...before, state: { ...before.state, reports: [report(kept.id)] } })).status, 200);
  assert.equal((await h.request('GET', `/assets/${removed.id}`, owner)).status, 404);
  assert.deepEqual((await h.request('GET', `/assets/${kept.id}`, owner)).bytes, kept.bytes);
  assert.deepEqual((await h.request('GET', `/assets/${candidate.id}`, owner)).bytes, candidate.bytes);
});
