import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { createApp } from './app';
import type { ActiveWorkout, FoodPhotoDraft, Meal, SetLog, SyncChange, SyncMutation, SyncSnapshot, Workout } from '../src/types';

const NOW = '2026-10-17T12:00:00.000Z';
const ORIGIN = 'http://127.0.0.1:5173';
const RAW_DRAFT = { isFood: true, name: 'Synthetic rice and beans', calories: 283, protein: 9.65, carbs: 58, fat: 0.85, serving_size_grams: 230, ingredients: [
  { name: 'Synthetic rice', grams: 150, calories: 195, protein: 4.05, carbs: 42, fat: 0.45 },
  { name: 'Synthetic beans', grams: 80, calories: 88, protein: 5.6, carbs: 16, fat: 0.4 },
], warnings: ['Synthetic confirmation fixture.'] };
const EXPECTED_DRAFT_ITEMS = [
  { name: 'Synthetic rice', grams: 150, per100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } },
  { name: 'Synthetic beans', grams: 80, per100g: { kcal: 110, protein: 7, carbs: 20, fat: 0.5 } },
];
interface Account { id: string; cookie: string }
interface HttpResult { status: number; body: any; headers: Headers }
const key = (collection: SyncChange['collection'], id: string) => `${collection}:${id}`;
const upsert = <T extends { id: string }>(collection: SyncChange['collection'], value: T, baseVersion = 0): SyncChange => ({ collection, id: value.id, baseVersion, kind: 'upsert', value });
const remove = (collection: SyncChange['collection'], id: string, baseVersion: number): SyncChange => ({ collection, id, baseVersion, kind: 'delete' });
const mutation = (...changes: SyncChange[]): SyncMutation => ({ mutationId: randomUUID(), changes });

/** Only the synthetic directory is opened; every configured AI request uses injected raw HTTP. */
async function harness(t: TestContext, mockAi = false) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-confirmation-boundaries-'));
  let service: ReturnType<typeof createApp>, server: Server;
  let base = '', active = false, providerCalls = 0;
  const start = async () => {
    service = createApp({
      dataDir: directory, secureCookies: false,
      ai: mockAi ? { apiKey: 'synthetic-confirmation-fixture-only', timeoutMs: 1000, retryDelayMs: 0 } : {},
      aiNow: () => Date.parse(NOW),
      aiFetch: async (input, init) => {
        providerCalls++;
        assert.ok(mockAi, 'non-AI cases must never call even the mock transport');
        assert.equal(String(input), 'https://api.openai.com/v1/responses');
        assert.equal(typeof init?.body, 'string');
        return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(RAW_DRAFT) }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    });
    server = service.app.listen(0, '127.0.0.1');
    await new Promise<void>(done => server.once('listening', done));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}/api`; active = true;
  };
  const stop = async () => {
    if (!active) return;
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    service.close(); active = false;
  };
  t.after(async () => {
    await stop();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-confirmation-boundaries-'), 'cleanup remains in this verified synthetic temporary directory');
    rmSync(target, { recursive: true, force: true });
  });
  await start();
  const request = async (method: string, path: string, account?: Account, body?: unknown): Promise<HttpResult> => {
    const response = await fetch(base + path, { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(account ? { Cookie: account.cookie, 'X-Forma-Account': account.id } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const register = async (): Promise<Account> => {
    const result = await request('POST', '/auth/register', undefined, { email: `confirmation-${randomUUID()}@example.test`, password: 'synthetic-confirmation-password-2026', name: 'Synthetic confirmation account' });
    assert.equal(result.status, 201);
    const cookie = result.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
    return { id: result.body.user.id, cookie };
  };
  const snapshot = async (account: Account): Promise<SyncSnapshot> => {
    const result = await request('GET', '/sync', account);
    assert.equal(result.status, 200); return result.body;
  };
  const photoDraft = async (account: Account): Promise<FoodPhotoDraft> => {
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ddd' } }).png().toBuffer();
    const upload = await request('POST', '/assets', account, { name: 'synthetic-confirmation.png', mime: 'image/png', base64: image.toString('base64') });
    assert.equal(upload.status, 201);
    const analyzed = await request('POST', '/food-photo-drafts', account, { assetId: upload.body.id, consent: true, language: 'en' });
    assert.equal(analyzed.status, 201); return analyzed.body;
  };
  const sync = (account: Account, body: SyncMutation) => request('POST', '/sync', account, body);
  const receiptCount = (account: Account, mutationId: string) => service.store.db.prepare('SELECT COUNT(*) AS count FROM sync_mutations WHERE owner_id=? AND mutation_id=?').get(account.id, mutationId)?.count;
  return { request, register, snapshot, photoDraft, sync, receiptCount, restart: async () => { await stop(); await start(); }, providerCalls: () => providerCalls };
}

const set = (patch: Partial<SetLog> = {}): SetLog => ({ id: randomUUID(), kind: 'work', reps: 8, weight: 40, durationSeconds: null, distanceMeters: null, rpe: null, rir: null, completed: true, ...patch });
function workout(): Workout {
  return { id: randomUUID(), date: '2026-10-17', name: 'Synthetic completed workout', duration: 30, rpe: null, notes: 'Original synthetic notes', createdAt: NOW, exercises: [{ id: randomUUID(), name: 'Row', sets: 1, reps: 8, weight: 40, setLogs: [set()] }] };
}
function activeWorkout(): ActiveWorkout {
  return { id: randomUUID(), date: '2026-10-17', name: 'Synthetic active workout', startedAt: NOW, exercises: [{ id: randomUUID(), name: 'Row', primaryMuscles: ['back'], setLogs: [set({ completed: false, reps: null, weight: null })], supersetGroup: null, restSeconds: 90, notes: '' }], restEndsAt: null, restRemainingSeconds: 35, notes: 'Synthetic active notes', rpe: null };
}
function meal(draft: FoodPhotoDraft, aiItemIndex: number): Meal {
  const item = draft.items[aiItemIndex]; assert.ok(item && item.grams !== null);
  const { kcal, protein, carbs, fat } = item.per100g;
  assert.ok(kcal !== null && protein !== null && carbs !== null && fat !== null);
  return { id: randomUUID(), date: '2026-10-17', name: item.name, type: 'lunch', grams: item.grams, referenceGrams: 100, kcal, protein, carbs, fat, source: 'ai_estimate', assetId: draft.assetId, aiDraftId: draft.id, aiItemIndex, createdAt: NOW };
}

test('a stale completed-workout deletion rejects every deletion in its batch until current records are explicitly reviewed', async t => {
  const h = await harness(t), account = await h.register(), first = workout(), second = workout();
  assert.equal((await h.sync(account, mutation(upsert('workouts', first), upsert('workouts', second)))).status, 200);
  const updated = structuredClone(first);
  updated.notes = 'Corrected in another synthetic tab'; updated.exercises[0].setLogs![0].reps = 9; updated.exercises[0].reps = 9;
  assert.equal((await h.sync(account, mutation(upsert('workouts', updated, 1)))).status, 200);
  const latest = await h.snapshot(account), attempted = mutation(remove('workouts', second.id, 1), remove('workouts', first.id, 1));
  const conflict = await h.sync(account, attempted);
  assert.equal(conflict.status, 409); assert.equal(conflict.body.code, 'SYNC_CONFLICT');
  assert.deepEqual(conflict.body.conflicts, [key('workouts', first.id)]); assert.deepEqual(conflict.body.snapshot, latest);
  assert.deepEqual(await h.snapshot(account), latest, 'even the current-version sibling deletion must roll back');
  assert.equal(h.receiptCount(account, attempted.mutationId), 0);
  const reviewed = await h.sync(account, { ...attempted, changes: [remove('workouts', second.id, 1), remove('workouts', first.id, 2)] });
  assert.equal(reviewed.status, 200); assert.deepEqual(reviewed.body.state.workouts, []);
  assert.equal(reviewed.body.revision, latest.revision + 1);
  assert.equal(reviewed.body.entityVersions[key('workouts', first.id)], 3); assert.equal(reviewed.body.entityVersions[key('workouts', second.id)], 2);
  assert.equal(h.providerCalls(), 0);
});

test('discard CAS protects newer active sets and an old accepted discard receipt cannot delete a subsequent explicit new write', async t => {
  const h = await harness(t), account = await h.register(), active = activeWorkout(), history = workout();
  assert.equal((await h.sync(account, mutation(upsert('activeWorkouts', active), upsert('workouts', history)))).status, 200);
  const progress = structuredClone(active);
  progress.exercises[0].setLogs[0] = { ...progress.exercises[0].setLogs[0], reps: 9, weight: 40, completed: true, completedAt: NOW };
  assert.equal((await h.sync(account, mutation(upsert('activeWorkouts', progress, 1)))).status, 200);
  const latest = await h.snapshot(account), stale = mutation(remove('activeWorkouts', active.id, 1));
  const conflict = await h.sync(account, stale);
  assert.equal(conflict.status, 409); assert.deepEqual(conflict.body.conflicts, [key('activeWorkouts', active.id)]);
  assert.deepEqual(await h.snapshot(account), latest); assert.equal(h.receiptCount(account, stale.mutationId), 0);
  const discard = { ...stale, changes: [remove('activeWorkouts', active.id, 2)] };
  const deleted = await h.sync(account, discard);
  assert.equal(deleted.status, 200); assert.deepEqual(deleted.body.state.activeWorkouts, []);
  assert.deepEqual(deleted.body.state.workouts, [history], 'discard must not rewrite completed training facts');
  // This is an explicit API write against the tombstone, not a claim of a UI undo feature.
  const resumed = { ...progress, notes: 'Explicitly saved after the discard' };
  assert.equal((await h.sync(account, mutation(upsert('activeWorkouts', resumed, 3)))).status, 200);
  const current = await h.snapshot(account);
  await h.restart();
  const replay = await h.sync(account, discard);
  assert.equal(replay.status, 200); assert.deepEqual(replay.body, current);
  assert.deepEqual(replay.body.state.activeWorkouts, [resumed]); assert.equal(h.receiptCount(account, discard.mutationId), 1);
  const staleAgain = await h.sync(account, mutation(remove('activeWorkouts', active.id, 2)));
  assert.equal(staleAgain.status, 409); assert.deepEqual(await h.snapshot(account), current);
  assert.equal(h.providerCalls(), 0);
});

test('delete payloads cannot smuggle values and malformed delete batches consume neither revisions nor mutation IDs', async t => {
  const h = await harness(t), account = await h.register(), first = workout(), second = workout();
  assert.equal((await h.sync(account, mutation(upsert('workouts', first), upsert('workouts', second)))).status, 200);
  const baseline = await h.snapshot(account);
  const malformed = mutation(remove('workouts', first.id, 1), { ...remove('workouts', second.id, 1), value: second });
  const rejected = await h.sync(account, malformed);
  assert.equal(rejected.status, 400); assert.equal(rejected.body.error, 'Invalid input');
  assert.ok(rejected.body.issues.some((issue: { path: string }) => issue.path === 'changes.1.value'));
  assert.ok(!JSON.stringify(rejected.body).includes(second.notes), 'input errors do not echo the deleted health record');
  assert.deepEqual(await h.snapshot(account), baseline); assert.equal(h.receiptCount(account, malformed.mutationId), 0);
  const corrected = { ...malformed, changes: [remove('workouts', first.id, 1), remove('workouts', second.id, 1)] };
  const deleted = await h.sync(account, corrected);
  assert.equal(deleted.status, 200); assert.deepEqual(deleted.body.state.workouts, []);
  assert.equal(deleted.body.revision, baseline.revision + 1); assert.equal(h.receiptCount(account, corrected.mutationId), 1);
  const changedReceipt = await h.sync(account, { ...corrected, changes: [remove('workouts', first.id, 2)] });
  assert.equal(changedReceipt.status, 409); assert.deepEqual(changedReceipt.body.conflicts, [`mutation:${corrected.mutationId}`]);
  assert.deepEqual(await h.snapshot(account), deleted.body); assert.equal(h.providerCalls(), 0);
});

test('uncertain AI-meal deletion replay preserves a later report reference and cleans the photo only after its actual final reference is removed', async t => {
  const h = await harness(t, true), account = await h.register(), draft = await h.photoDraft(account), first = meal(draft, 0), second = meal(draft, 1);
  assert.equal((await h.sync(account, mutation(upsert('meals', first), upsert('meals', second)))).status, 200);
  const deletion = mutation(remove('meals', first.id, 1));
  assert.equal((await h.sync(account, deletion)).status, 200); // Accepted response may be lost to the client.
  const report = { id: randomUUID(), name: 'Synthetic photo review', date: '2026-10-17', assetId: draft.assetId, markers: [], extractionStatus: 'manual', createdAt: NOW };
  assert.equal((await h.sync(account, mutation(upsert('reports', report), remove('meals', second.id, 1)))).status, 200);
  const referenced = await h.snapshot(account);
  assert.deepEqual(referenced.state.meals, []); assert.deepEqual(referenced.state.reports, [report]);
  await h.restart();
  const replay = await h.sync(account, deletion);
  assert.equal(replay.status, 200); assert.deepEqual(replay.body, referenced);
  assert.equal((await h.request('DELETE', `/assets/${draft.assetId}`, account, {})).status, 409, 'a report protects the same private image after both AI meals were removed');
  const kept = await h.request('GET', '/export', account);
  assert.equal(kept.body.assets.length, 1); assert.deepEqual(kept.body.aiDrafts[0].items, EXPECTED_DRAFT_ITEMS);
  const lastDeletion = mutation(remove('reports', report.id, 1));
  const removed = await h.sync(account, lastDeletion);
  assert.equal(removed.status, 200); assert.deepEqual(removed.body.state.reports, []);
  const exported = await h.request('GET', '/export', account);
  assert.deepEqual(exported.body.assets, []); assert.deepEqual(exported.body.aiDrafts, []);
  const lastReplay = await h.sync(account, lastDeletion);
  assert.equal(lastReplay.status, 200); assert.deepEqual(lastReplay.body, removed.body);
  assert.equal((await h.sync(account, deletion)).status, 200);
  assert.equal(h.receiptCount(account, deletion.mutationId), 1); assert.equal(h.receiptCount(account, lastDeletion.mutationId), 1);
  assert.equal(h.providerCalls(), 1, 'neither confirmation, deletion nor receipt recovery calls the provider');
});
