import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from './app';
import { emptyState, type AppState, type PlanVersion, type SyncSnapshot } from '../src/types';
import { diffStates } from '../src/sync/changes';
import { SyncEngine } from '../src/sync/engine';
import { ApiError } from '../src/api';
import { readCached, writeCached } from '../src/sync/storage';

const now = '2026-11-04T13:00:00.000Z';
const makePlan = (parentId: string | null, minutes = 40): PlanVersion => ({
  id: randomUUID(), parentId, createdAt: now, reason: 'Independent synthetic fixture',
  trainingMinutes: minutes, trainingDays: 3, sleepHours: 8, calorieTarget: null, proteinTarget: null,
});

// Synthetic IndexedDB event transport; production cache merge/consent code still runs.
function reviewIdb() {
  const tables = new Map<string, Map<string, unknown>>();
  let initialized = false;
  let serial = Promise.resolve();
  return { open() {
    const opened: any = {};
    opened.result = {
      close() {},
      createObjectStore(name: string) { tables.set(name, new Map()); },
      transaction(names: string[], mode: string) {
        const tx: any = {};
        const operations: Array<() => void> = [];
        let aborted = false;
        let working: Map<string, Map<string, unknown>>;
        tx.abort = () => { aborted = true; };
        tx.objectStore = (name: string) => {
          assert.ok(names.includes(name));
          const operation = (run: () => unknown) => {
            const req: any = {};
            operations.push(() => { req.result = structuredClone(run()); req.onsuccess?.(); });
            return req;
          };
          return {
            get: (key: string) => operation(() => working.get(name)!.get(key)),
            put: (value: any, key?: string) => operation(() => { working.get(name)!.set(key ?? value.user.id, structuredClone(value)); return key; }),
            delete: (key: string) => operation(() => working.get(name)!.delete(key)),
          };
        };
        serial = serial.then(async () => {
          working = new Map([...tables].map(([name, values]) => [name, new Map(values)]));
          while (operations.length && !aborted) { operations.shift()!(); await Promise.resolve(); }
          if (aborted) tx.onabort?.();
          else { if (mode === 'readwrite') for (const name of names) tables.set(name, working.get(name)!); tx.oncomplete?.(); }
        });
        return tx;
      },
    };
    queueMicrotask(() => { if (!initialized) { initialized = true; opened.onupgradeneeded?.(); } opened.onsuccess?.(); });
    return opened;
  } };
}
async function setup(t: TestContext) {
  const root = resolve('.forma-local/review-evidence'); mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'pr3-'));
  const service = createApp({ dataDir: dir, secureCookies: false, ai: {} });
  const server = service.app.listen(0, '127.0.0.1');
  await new Promise<void>(done => server.once('listening', done));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => { await new Promise<void>(done => server.close(() => done())); service.close(); rmSync(dir, { recursive: true }); });
  const registration = await fetch(`http://127.0.0.1:${address.port}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify({ email: `${randomUUID()}@example.com`, password: 'synthetic-review-12345', name: 'Independent review' }),
  });
  assert.equal(registration.status, 201);
  const user = (await registration.json()).user;
  const cookie = registration.headers.get('set-cookie')!.split(';')[0];
  const request = async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', Cookie: cookie, 'X-Forma-Account': user.id },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const snapshot = async (): Promise<SyncSnapshot> => (await request('/sync')).body;
  const save = async (state: AppState) => {
    const before = await snapshot();
    assert.equal((await request('/state', 'PUT', { state, revision: before.revision })).status, 200);
  };
  const base = makePlan(null);
  await save({ ...emptyState(), planVersions: [base], currentPlanId: base.id });
  const first = await snapshot();
  const proposal = { id: randomUUID(), baseVersionId: base.id, createdAt: now, reason: 'Synthetic adjustment', status: 'proposed' as const, patch: { sleepHours: 9 } };
  await save({ ...first.state, suggestions: [proposal] });
  const second = await snapshot();
  const advanced = makePlan(base.id, 55);
  await save({ ...second.state, planVersions: [base, advanced], currentPlanId: advanced.id });
  const before = await snapshot();
  const child = { ...base, id: randomUUID(), parentId: base.id, sleepHours: 9 };
  const accepted: AppState = { ...structuredClone(before.state), planVersions: [...before.state.planVersions, child], currentPlanId: child.id,
    suggestions: [{ ...proposal, status: 'accepted', acceptedVersionId: child.id }] };
  const submit = (endpoint: 'PUT' | 'sync', state: AppState, mutationId = randomUUID()) => endpoint === 'PUT'
    ? request('/state', 'PUT', { state, revision: before.revision })
    : request('/sync', 'POST', { mutationId, changes: diffStates(before.state, state, before.entityVersions) });
  return { before, accepted, submit, snapshot, save, service, user, request, cookie, origin: `http://127.0.0.1:${address.port}` };
}

test('independent client: semantic conflict preserves exportable queue without rebasing or background resubmission', async t => {
  const h = await setup(t);
  const nativeFetch = globalThis.fetch;
  const previous = new Map(['fetch', 'localStorage', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => key === 'forma-language' ? 'zh' : null } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  const posts: unknown[] = [];
  globalThis.fetch = async (input, init) => {
    if (!String(input).startsWith('/api/')) return nativeFetch(input, init);
    if (init?.method === 'POST') posts.push(JSON.parse(String(init.body)));
    const headers = new Headers(init?.headers);
    headers.set('Cookie', h.cookie); headers.set('Origin', 'http://localhost:5173');
    return nativeFetch(h.origin + String(input), { ...init, headers });
  };
  const engine = new SyncEngine(h.user, h.before, () => {});
  t.after(async () => {
    await engine.stop();
    for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  });
  await engine.restore();
  await assert.rejects(engine.save(h.accepted), error => error instanceof ApiError && error.status === 409 && error.code === 'PLAN_BASE_CONFLICT' && /计划已发生变化/.test(error.message));
  assert.equal(engine.status.pending, 1);
  assert.equal(engine.status.conflict, null, 'must not become an entity CAS rebase dialog');
  assert.deepEqual(engine.exportPending().state, h.accepted);
  assert.equal(engine.exportPending().pending, 1);
  assert.deepEqual(await h.snapshot(), h.before);
  await engine.resolve(true);
  assert.equal(posts.length, 1, 'resolve must not silently rebase a semantic conflict');
  // App.tsx invokes refresh on its timer and online event; simulate those callbacks.
  await engine.refresh(); await engine.refresh();
  assert.equal(engine.status.pending, 1);
  assert.deepEqual(engine.exportPending().state, h.accepted);
  assert.equal(posts.length, 1, 'background refresh must not repeat a rejected acceptance');
  await engine.discardInvalid();
  assert.equal(engine.status.pending, 0);
  assert.deepEqual(engine.context().state, h.before.state);
});

test('independent client: rejected acceptance stays paused across reload, reauthentication and stale cache merge; discard restores saving', async t => {
  const h = await setup(t), nativeFetch = globalThis.fetch;
  const previous = new Map(['fetch', 'localStorage', 'navigator', 'indexedDB'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const values = new Map<string, string>([['forma-language', 'en']]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key),
  } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: reviewIdb() });
  const posts: unknown[] = [], engines: SyncEngine[] = [];
  globalThis.fetch = async (input, init) => {
    if (!String(input).startsWith('/api/')) return nativeFetch(input, init);
    if (init?.method === 'POST') posts.push(JSON.parse(String(init.body)));
    const headers = new Headers(init?.headers); headers.set('Cookie', h.cookie); headers.set('Origin', 'http://localhost:5173');
    return nativeFetch(h.origin + String(input), { ...init, headers });
  };
  t.after(async () => {
    for (const engine of engines) await engine.stop();
    for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  });
  const create = async () => { const engine = new SyncEngine(h.user, h.before, () => {}); engines.push(engine); await engine.restore(); return engine; };
  const first = await create(); await first.enable(true);
  await assert.rejects(first.save(h.accepted), error => error instanceof ApiError && error.code === 'PLAN_BASE_CONFLICT');
  const cached = await readCached(h.user.id); assert.ok(cached); assert.equal(cached.queue.length, 1);
  const mutationId = cached.queue[0].mutationId;
  assert.deepEqual(Reflect.get(cached, 'planBaseBlocks'), [mutationId], 'pause must survive browser reload');
  // A parked tab carrying an older cache copy cannot clear another tab's pause.
  const staleCopy = { ...cached, planBaseBlocks: [] };
  const merged = await writeCached(staleCopy);
  assert.deepEqual(Reflect.get(merged, 'planBaseBlocks'), [mutationId]);
  const reloaded = await create();
  assert.ok(reloaded.status.error, 'restored rejection must expose SyncPanel export/discard recovery');
  await reloaded.refresh();
  await assert.rejects(reloaded.flush(), error => error instanceof ApiError && error.status === 409 && error.code === 'PLAN_BASE_CONFLICT');
  await reloaded.reauthenticate(h.before, () => {}); await reloaded.refresh();
  await first.reconcileCache(); await first.refresh();
  assert.equal(posts.length, 1, 'reload, explicit flush and reauthentication must preserve rejected state without transport');
  assert.equal(reloaded.status.pending, 1); assert.deepEqual(reloaded.exportPending().state, h.accepted);
  await reloaded.discardInvalid();
  assert.equal(reloaded.status.pending, 0);
  assert.equal(reloaded.status.error, '');
  const cleared = await readCached(h.user.id); assert.ok(cleared); assert.deepEqual(cleared.queue, []);
  assert.deepEqual(Reflect.get(cleared, 'planBaseBlocks'), []);
  await first.reconcileCache(); await first.refresh(); assert.equal(first.status.pending, 0);
  await reloaded.save({ ...h.before.state, completedActions: { '2026-11-04': ['synthetic recovery'] } });
  assert.equal(posts.length, 2); assert.equal(reloaded.status.pending, 0);
  const after = await h.snapshot(); assert.equal(after.revision, h.before.revision + 1);
  assert.deepEqual(after.state.planVersions, h.before.state.planVersions);
  assert.equal(after.state.suggestions[0].status, 'proposed');
  // Another tab can persist an already rejected batch while this tab's discard
  // confirmation is open. Discarding observed IDs must preserve its pause.
  await assert.rejects(reloaded.save({ ...h.accepted, completedActions: after.state.completedActions }), error => error instanceof ApiError && error.code === 'PLAN_BASE_CONFLICT');
  const rejected = await readCached(h.user.id); assert.ok(rejected);
  const unseenId = randomUUID();
  const otherTab = { ...rejected, queue: [...rejected.queue, { ...rejected.queue[0], mutationId: unseenId }], planBaseBlocks: [...(rejected.planBaseBlocks ?? []), unseenId] };
  await writeCached(otherTab);
  const sentBeforeDiscard = posts.length;
  await reloaded.discardInvalid();
  assert.equal(posts.length, sentBeforeDiscard, 'discard must not automatically send an unseen rejected batch merged from another tab');
  assert.equal(reloaded.status.pending, 1);
  await assert.rejects(reloaded.flush(), error => error instanceof ApiError && error.code === 'PLAN_BASE_CONFLICT');
  await reloaded.discardInvalid();
  assert.equal(reloaded.status.pending, 0);
});

for (const endpoint of ['PUT', 'sync'] as const) {
  test(`independent ${endpoint}: stale acceptance with invalid attachment remains input error`, async t => {
    const h = await setup(t);
    const bad = structuredClone(h.accepted);
    bad.reports.push({ id: randomUUID(), name: 'Synthetic attachment', date: '2026-11-04', assetId: randomUUID(), markers: [], extractionStatus: 'manual', createdAt: now });
    const result = await h.submit(endpoint, bad);
    assert.deepEqual(await h.snapshot(), h.before);
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  test(`independent ${endpoint}: stale acceptance with forged draft remains input error`, async t => {
    const h = await setup(t);
    const bad = structuredClone(h.accepted);
    bad.meals.push({ id: randomUUID(), date: '2026-11-04', name: 'Synthetic meal', type: 'lunch', grams: 100, referenceGrams: 100,
      kcal: 100, protein: 5, carbs: 10, fat: 2, source: 'ai_estimate', assetId: randomUUID(), aiDraftId: randomUUID(), aiItemIndex: 0, createdAt: now });
    const result = await h.submit(endpoint, bad);
    assert.deepEqual(await h.snapshot(), h.before);
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  test(`independent ${endpoint}: invalid decisions and references cannot masquerade as base conflict`, async t => {
    const h = await setup(t);
    const cases: AppState[] = [];
    const wrongStatus = structuredClone(h.accepted); wrongStatus.suggestions[0].status = 'undone'; cases.push(wrongStatus);
    const wrongReference = structuredClone(h.accepted); wrongReference.suggestions[0].acceptedVersionId = randomUUID(); cases.push(wrongReference);
    const secondDecision = structuredClone(h.accepted); secondDecision.suggestions.push({ ...secondDecision.suggestions[0], id: randomUUID() }); cases.push(secondDecision);
    const wrongChild = structuredClone(h.accepted); wrongChild.planVersions.at(-1)!.parentId = h.before.state.currentPlanId; cases.push(wrongChild);
    const badPatch = structuredClone(h.accepted); badPatch.planVersions.at(-1)!.sleepHours = 10; cases.push(badPatch);
    for (const candidate of cases) {
      const result = await h.submit(endpoint, candidate);
      assert.equal(result.status, 400, JSON.stringify(result.body));
      assert.deepEqual(await h.snapshot(), h.before);
    }
  });

  test(`independent ${endpoint}: failed acceptance does not remove a referenced asset or create cleanup/receipt`, async t => {
    const h = await setup(t);
    const asset = h.service.store.addAsset(h.user.id, 'synthetic.pdf', 'application/pdf', Buffer.from('%PDF-1.4 synthetic'));
    await h.save({ ...h.before.state, reports: [{ id: randomUUID(), name: 'Synthetic attachment', date: '2026-11-04', assetId: asset.id, markers: [], extractionStatus: 'manual', createdAt: now }] });
    const before = await h.snapshot();
    const candidate = structuredClone(h.accepted); candidate.completedActions['2026-11-04'] = ['synthetic'];
    const mutationId = randomUUID();
    const result = endpoint === 'PUT'
      ? await h.request('/state', 'PUT', { state: candidate, revision: before.revision })
      : await h.request('/sync', 'POST', { mutationId, changes: diffStates(before.state, candidate, before.entityVersions) });
    assert.equal(result.status, 409); assert.equal(result.body.code, 'PLAN_BASE_CONFLICT');
    assert.deepEqual(Object.keys(result.body).sort(), ['code', 'error']);
    assert.deepEqual(await h.snapshot(), before);
    assert.ok(h.service.store.asset(h.user.id, asset.id));
    assert.equal(h.service.store.db.prepare('SELECT count(*) AS n FROM asset_cleanup_intents WHERE owner_id=?').get(h.user.id)!.n, 0);
    assert.equal(h.service.store.db.prepare('SELECT count(*) AS n FROM sync_mutations WHERE owner_id=? AND mutation_id=?').get(h.user.id, mutationId)!.n, 0);
  });
}
