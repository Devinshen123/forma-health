import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createApp } from './app';
import { emptyState, type AppState, type PlanVersion, type Suggestion, type SyncSnapshot } from '../src/types';
import { diffStates } from '../src/sync/changes';
import { request as clientRequest, ApiError } from '../src/api';

const NOW = '2026-11-04T12:00:00.000Z';
const plan = (parentId: string | null = null, trainingMinutes = 45): PlanVersion => ({
  id: randomUUID(), parentId, createdAt: NOW, reason: 'Synthetic schedule',
  trainingMinutes, trainingDays: 3, sleepHours: 8, calorieTarget: null, proteinTarget: null,
});
async function harness(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'forma-plan-base-'));
  const service = createApp({ dataDir: dir, secureCookies: false, ai: {} });
  const server = service.app.listen(0, '127.0.0.1');
  await new Promise<void>(ready => server.once('listening', ready));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const accounts = new Map<string, string>();
  t.after(async () => {
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    service.close(); rmSync(dir, { recursive: true, force: true });
  });
  const request = async (path: string, cookie?: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', expectedAccount?: string) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api${path}`, {
      method, headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie, 'X-Forma-Account': expectedAccount ?? accounts.get(cookie)! } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    const newCookie = response.headers.get('set-cookie')?.split(';')[0];
    if (newCookie && data.user) accounts.set(newCookie, data.user.id);
    return { status: response.status, data, cookie: newCookie };
  };
  const register = async () => {
    const result = await request('/auth/register', undefined, { email: `${randomUUID()}@example.com`, password: 'synthetic-password-123', name: 'Fixture' });
    assert.equal(result.status, 201); assert.ok(result.cookie);
    return { cookie: result.cookie, id: result.data.user.id as string };
  };
  const snapshot = async (cookie: string): Promise<SyncSnapshot> => (await request('/sync', cookie)).data;
  const seed = async (cookie: string, advance = true) => {
    const base = plan();
    let state: AppState = { ...emptyState(), planVersions: [base], currentPlanId: base.id };
    assert.equal((await request('/state', cookie, { state, revision: 0 }, 'PUT')).status, 200);
    const suggestion: Suggestion = { id: randomUUID(), baseVersionId: base.id, createdAt: NOW,
      reason: 'Synthetic reduction', status: 'proposed', patch: { trainingMinutes: 30 } };
    state = { ...state, suggestions: [suggestion] };
    assert.equal((await request('/state', cookie, { state, revision: 1 }, 'PUT')).status, 200);
    if (advance) {
      const manual = plan(base.id, 60);
      state = { ...state, planVersions: [...state.planVersions, manual], currentPlanId: manual.id };
      assert.equal((await request('/state', cookie, { state, revision: 2 }, 'PUT')).status, 200);
    }
    return { base, suggestion, current: await snapshot(cookie) };
  };
  const accepted = (current: SyncSnapshot, base: PlanVersion, suggestion: Suggestion): AppState => {
    const child = { ...base, ...suggestion.patch, id: randomUUID(), parentId: base.id, createdAt: NOW };
    return { ...structuredClone(current.state), planVersions: [...current.state.planVersions, child],
      currentPlanId: child.id, suggestions: [{ ...suggestion, status: 'accepted', acceptedVersionId: child.id }] };
  };
  return { request, register, snapshot, seed, accepted, store: service.store };
}

for (const endpoint of ['PUT', 'sync'] as const) test(`latest ${endpoint} versions cannot accept a stale suggestion base; conflict is atomic across repeated submissions`, async t => {
  const h = await harness(t), a = await h.register(), b = await h.register();
  const { base, suggestion, current } = await h.seed(a.cookie);
  const other = await h.snapshot(b.cookie);
  const next = h.accepted(current, base, suggestion);
  // A disjoint fact must not slip through a failed plan decision.
  next.completedActions['2026-11-04'] = ['training'];
  const mutationId = randomUUID();
  const payload = endpoint === 'PUT' ? { state: next, revision: current.revision }
    : { mutationId, changes: diffStates(current.state, next, current.entityVersions) };
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await h.request(endpoint === 'PUT' ? '/state' : '/sync', a.cookie, payload, endpoint === 'PUT' ? 'PUT' : 'POST');
    assert.equal(result.status, 409);
    assert.equal(result.data.code, 'PLAN_BASE_CONFLICT');
    assert.deepEqual(await h.snapshot(a.cookie), current, 'revision, history, entity versions and facts stay unchanged');
    assert.deepEqual(await h.snapshot(b.cookie), other, 'other account unchanged');
  }
  assert.equal(h.store.db.prepare('SELECT count(*) AS n FROM sync_mutations WHERE owner_id=? AND mutation_id=?').get(a.id, mutationId)!.n, 0);
  assert.equal((await h.request('/sync', b.cookie, { mutationId: randomUUID(), changes: diffStates(current.state, next, current.entityVersions) }, 'POST', a.id)).status, 401);
  assert.deepEqual(await h.snapshot(b.cookie), other);
});

for (const endpoint of ['PUT', 'sync'] as const) test(`${endpoint} normal acceptance and compensating undo still append immutable history`, async t => {
  const h = await harness(t), a = await h.register();
  const { base, suggestion, current } = await h.seed(a.cookie, false);
  const accept = h.accepted(current, base, suggestion);
  const write = async (before: SyncSnapshot, next: AppState) => h.request(endpoint === 'PUT' ? '/state' : '/sync', a.cookie,
    endpoint === 'PUT' ? { state: next, revision: before.revision } : { mutationId: randomUUID(), changes: diffStates(before.state, next, before.entityVersions) }, endpoint === 'PUT' ? 'PUT' : 'POST');
  assert.equal((await write(current, accept)).status, 200);
  const saved = await h.snapshot(a.cookie);
  const compensation = { ...base, id: randomUUID(), parentId: saved.state.currentPlanId, createdAt: NOW };
  const undo = { ...saved.state, planVersions: [...saved.state.planVersions, compensation], currentPlanId: compensation.id,
    suggestions: [{ ...saved.state.suggestions[0], status: 'undone' as const }] };
  assert.equal((await write(saved, undo)).status, 200);
  const final = await h.snapshot(a.cookie);
  assert.equal(final.state.planVersions.length, 3);
  assert.deepEqual(final.state.planVersions.slice(0, 2), saved.state.planVersions);
  assert.equal(final.state.suggestions[0].status, 'undone');
});

test('bad patches, rewritten history and malformed states remain 400; revision and entity CAS remain 409', async t => {
  const h = await harness(t), a = await h.register();
  const { base, suggestion, current } = await h.seed(a.cookie);
  const stale = h.accepted(current, base, suggestion);
  const badPatch = structuredClone(stale); badPatch.planVersions.at(-1)!.trainingMinutes = 31;
  const rewrite = structuredClone(stale); rewrite.planVersions[0].trainingMinutes = 90;
  const malformed = structuredClone(stale); malformed.currentPlanId = randomUUID();
  for (const next of [badPatch, rewrite, malformed]) {
    for (const endpoint of ['PUT', 'sync']) {
      const result = await h.request(endpoint === 'PUT' ? '/state' : '/sync', a.cookie,
        endpoint === 'PUT' ? { state: next, revision: current.revision } : { mutationId: randomUUID(), changes: diffStates(current.state, next, current.entityVersions) }, endpoint === 'PUT' ? 'PUT' : 'POST');
      assert.equal(result.status, 400); assert.notEqual(result.data.code, 'PLAN_BASE_CONFLICT');
      assert.deepEqual(await h.snapshot(a.cookie), current);
    }
  }
  assert.equal((await h.request('/state', a.cookie, { state: stale, revision: current.revision - 1 }, 'PUT')).status, 409);
  const changes = diffStates(current.state, stale, current.entityVersions);
  changes.find(change => change.collection === 'currentPlanId')!.baseVersion = 0;
  const cas = await h.request('/sync', a.cookie, { mutationId: randomUUID(), changes });
  assert.equal(cas.status, 409); assert.equal(cas.data.code, 'SYNC_CONFLICT');
  assert.deepEqual(await h.snapshot(a.cookie), current);
});

for (const endpoint of ['PUT', 'sync'] as const) test(`${endpoint} preserves manual-parent errors and allows rejecting a stale proposal`, async t => {
  const h = await harness(t), a = await h.register();
  const { base, current } = await h.seed(a.cookie);
  const write = async (next: AppState) => h.request(endpoint === 'PUT' ? '/state' : '/sync', a.cookie,
    endpoint === 'PUT' ? { state: next, revision: current.revision } : { mutationId: randomUUID(), changes: diffStates(current.state, next, current.entityVersions) }, endpoint === 'PUT' ? 'PUT' : 'POST');
  const manual = plan(base.id, 50);
  const staleManual = { ...current.state, planVersions: [...current.state.planVersions, manual], currentPlanId: manual.id };
  assert.equal((await write(staleManual)).status, 400);
  assert.deepEqual(await h.snapshot(a.cookie), current);
  const rejected = { ...current.state, suggestions: [{ ...current.state.suggestions[0], status: 'rejected' as const }] };
  assert.equal((await write(rejected)).status, 200);
  const after = await h.snapshot(a.cookie);
  assert.deepEqual(after.state.planVersions, current.state.planVersions);
  assert.equal(after.state.currentPlanId, current.state.currentPlanId);
  assert.equal(after.state.suggestions[0].status, 'rejected');
});

test('client preserves plan conflict code with a specific Chinese recovery message', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  let language = 'zh';
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => language } });
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'PLAN_BASE_CONFLICT', error: 'The plan changed. Review the latest plan before accepting this adjustment.' }), { status: 409 });
  await assert.rejects(clientRequest('/state'), error => error instanceof ApiError && error.status === 409 && error.code === 'PLAN_BASE_CONFLICT' && /计划.*变化/.test(error.message));
  language = 'en';
  await assert.rejects(clientRequest('/state'), error => error instanceof ApiError && error.message === 'The plan changed. Review the latest plan before accepting this adjustment.');
});
