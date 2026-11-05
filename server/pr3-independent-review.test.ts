import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from './app';
import { emptyState, type AppState, type PlanVersion, type SyncSnapshot } from '../src/types';
import { diffStates } from '../src/sync/changes';

const now = '2026-11-04T13:00:00.000Z';
const makePlan = (parentId: string | null, minutes = 40): PlanVersion => ({
  id: randomUUID(), parentId, createdAt: now, reason: 'Independent synthetic fixture',
  trainingMinutes: minutes, trainingDays: 3, sleepHours: 8, calorieTarget: null, proteinTarget: null,
});
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
  return { before, accepted, submit, snapshot, save, service, user, request };
}

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
