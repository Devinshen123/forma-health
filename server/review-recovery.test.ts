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
const RAW_DRAFT = {
  isFood: true,
  items: [
    { name: 'Synthetic rice', grams: 150, per100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } },
    { name: 'Synthetic beans', grams: 80, per100g: { kcal: 110, protein: 7, carbs: 20, fat: 0.5 } },
  ],
  warnings: ['Synthetic fixture: review both portions.'],
};
interface Account { id: string; cookie: string }
interface HttpResult { status: number; body: any; headers: Headers }
const key = (collection: SyncChange['collection'], id: string) => `${collection}:${id}`;
const upsert = <T extends { id: string }>(collection: SyncChange['collection'], value: T, baseVersion = 0): SyncChange => ({ collection, id: value.id, baseVersion, kind: 'upsert', value });
const remove = (collection: SyncChange['collection'], id: string, baseVersion: number): SyncChange => ({ collection, id, baseVersion, kind: 'delete' });
const mutation = (...changes: SyncChange[]): SyncMutation => ({ mutationId: randomUUID(), changes });

/** All provider work is raw injected HTTP; this fixture never loads .env or production data. */
async function harness(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-review-recovery-'));
  let service: ReturnType<typeof createApp>;
  let server: Server;
  let base = '', active = false, providerCalls = 0;
  const start = async () => {
    service = createApp({
      dataDir: directory, secureCookies: false,
      ai: { apiKey: 'synthetic-fixture-only', timeoutMs: 1000, retryDelayMs: 0 },
      aiNow: () => Date.parse(NOW),
      aiFetch: async (input, init) => {
        providerCalls++;
        assert.equal(String(input), 'https://api.openai.com/v1/responses');
        assert.equal(typeof init?.body, 'string');
        return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(RAW_DRAFT) }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    });
    server = service.app.listen(0, '127.0.0.1');
    await new Promise<void>(done => server.once('listening', done));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}/api`;
    active = true;
  };
  const stop = async () => {
    if (!active) return;
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    service.close(); active = false;
  };
  t.after(async () => {
    await stop();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-review-recovery-'), 'cleanup stays within the verified synthetic fixture directory');
    rmSync(target, { recursive: true, force: true });
  });
  await start();
  const request = async (method: string, path: string, account?: Account, body?: unknown): Promise<HttpResult> => {
    const response = await fetch(base + path, { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(account ? { Cookie: account.cookie, 'X-Forma-Account': account.id } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const register = async (): Promise<Account> => {
    const response = await request('POST', '/auth/register', undefined, { email: `review-${randomUUID()}@example.test`, password: 'synthetic-fixture-password-2026', name: 'Synthetic recovery account' });
    assert.equal(response.status, 201);
    const cookie = response.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
    return { id: response.body.user.id, cookie };
  };
  const snapshot = async (account: Account): Promise<SyncSnapshot> => {
    const result = await request('GET', '/sync', account);
    assert.equal(result.status, 200); return result.body;
  };
  const sync = (account: Account, body: SyncMutation) => request('POST', '/sync', account, body);
  const photoDraft = async (account: Account): Promise<FoodPhotoDraft> => {
    const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#eee' } }).png().toBuffer();
    const uploaded = await request('POST', '/assets', account, { name: 'synthetic-review.png', mime: 'image/png', base64: bytes.toString('base64') });
    assert.equal(uploaded.status, 201);
    const analyzed = await request('POST', '/food-photo-drafts', account, { assetId: uploaded.body.id, consent: true, language: 'en' });
    assert.equal(analyzed.status, 201); return analyzed.body;
  };
  const receiptCount = (account: Account, mutationId: string) => service.store.db.prepare('SELECT COUNT(*) AS count FROM sync_mutations WHERE owner_id=? AND mutation_id=?').get(account.id, mutationId)?.count;
  return { request, register, snapshot, sync, photoDraft, receiptCount, restart: async () => { await stop(); await start(); }, providerCalls: () => providerCalls };
}

function meal(draft: FoodPhotoDraft, aiItemIndex: number, patch: Partial<Meal> = {}): Meal {
  const item = draft.items[aiItemIndex];
  assert.ok(item && item.grams !== null);
  const { kcal, protein, carbs, fat } = item.per100g;
  assert.ok(kcal !== null && protein !== null && carbs !== null && fat !== null);
  return { id: randomUUID(), date: '2026-10-17', name: item.name, type: 'lunch', grams: item.grams, referenceGrams: 100, kcal, protein, carbs, fat, source: 'ai_estimate', aiDraftId: draft.id, aiItemIndex, assetId: draft.assetId, createdAt: NOW, ...patch };
}
const set = (patch: Partial<SetLog> = {}): SetLog => ({ id: randomUUID(), kind: 'work', reps: 8, weight: 42.5, durationSeconds: null, distanceMeters: null, rpe: null, rir: null, completed: true, completedAt: NOW, ...patch });
function activeWorkout(): ActiveWorkout {
  const parent = set();
  return { id: randomUUID(), date: '2026-10-17', name: 'Synthetic set session', startedAt: NOW, exercises: [{ id: randomUUID(), name: 'Row', primaryMuscles: ['back'], setLogs: [parent, set({ kind: 'drop', reps: 6, weight: 30, dropParentId: parent.id })], supersetGroup: null, restSeconds: 90, notes: '' }], restEndsAt: null, restRemainingSeconds: 35, notes: 'Synthetic session note', rpe: null };
}
function finishedWorkout(active: ActiveWorkout): Workout {
  return { id: active.id, date: active.date, name: active.name, duration: 30, rpe: active.rpe, notes: active.notes, createdAt: NOW, source: 'manual', exercises: active.exercises.map(exercise => ({ id: exercise.id, name: exercise.name, primaryMuscles: exercise.primaryMuscles, sets: exercise.setLogs.length, reps: exercise.setLogs.find(log => log.reps !== null)?.reps ?? 0, weight: exercise.setLogs.find(log => log.weight !== null)?.weight ?? 0, setLogs: structuredClone(exercise.setLogs), supersetGroup: exercise.supersetGroup, restSeconds: exercise.restSeconds })) };
}

test('multi-item AI review rejects a forged item atomically and a corrected request can reuse its uncommitted mutation ID', async t => {
  const h = await harness(t), account = await h.register(), draft = await h.photoDraft(account);
  assert.equal(draft.items.length, 2); assert.equal(h.providerCalls(), 1);
  const first = meal(draft, 0, { name: 'Reviewed rice', grams: 200, kcal: 145 }), second = meal(draft, 1);
  const baseline = await h.snapshot(account);
  const attempted = mutation(upsert('meals', first), upsert('meals', { ...second, aiItemIndex: 2 }));
  const rejected = await h.sync(account, attempted);
  assert.equal(rejected.status, 400);
  assert.deepEqual(await h.snapshot(account), baseline, 'no meal, version or revision is committed when one actual draft item is missing');
  assert.equal(h.receiptCount(account, attempted.mutationId), 0);
  const saved = await h.sync(account, { ...attempted, changes: [upsert('meals', first), upsert('meals', second)] });
  assert.equal(saved.status, 200); assert.equal(saved.body.revision, baseline.revision + 1);
  assert.deepEqual(saved.body.state.meals, [first, second]);
  assert.equal(saved.body.entityVersions[key('meals', first.id)], 1);
  assert.equal(saved.body.entityVersions[key('meals', second.id)], 1);
  const exported = await h.request('GET', '/export', account);
  assert.deepEqual(exported.body.aiDrafts[0].items, RAW_DRAFT.items, 'reviewed values do not rewrite the original independent AI draft');
  assert.equal(h.providerCalls(), 1, 'correcting and saving never invokes the provider again');
});

test('shared AI photos survive a rejected final removal; replay after actual deletion cannot resurrect meals or photo provenance', async t => {
  const h = await harness(t), account = await h.register(), draft = await h.photoDraft(account);
  const first = meal(draft, 0), second = meal(draft, 1), savedRequest = mutation(upsert('meals', first), upsert('meals', second));
  assert.equal((await h.sync(account, savedRequest)).status, 200);
  assert.equal((await h.sync(account, mutation(remove('meals', first.id, 1)))).status, 200);
  const stillReferenced = await h.request('DELETE', `/assets/${draft.assetId}`, account, {});
  assert.equal(stillReferenced.status, 409, 'the remaining reviewed item protects the shared attachment');
  const baseline = await h.snapshot(account), invalid = activeWorkout();
  const failed = await h.sync(account, mutation(remove('meals', second.id, 1), upsert('activeWorkouts', { ...invalid, restRemainingSeconds: -1 })));
  assert.equal(failed.status, 400); assert.deepEqual(await h.snapshot(account), baseline);
  const kept = await h.request('GET', '/export', account);
  assert.equal(kept.body.assets.length, 1); assert.equal(kept.body.aiDrafts.length, 1);
  assert.equal((await h.sync(account, mutation(remove('meals', second.id, 1)))).status, 200);
  await h.restart();
  const replay = await h.sync(account, savedRequest);
  assert.equal(replay.status, 200); assert.equal(replay.body.revision, 3); assert.deepEqual(replay.body.state.meals, []);
  assert.equal(replay.body.entityVersions[key('meals', first.id)], 2); assert.equal(replay.body.entityVersions[key('meals', second.id)], 2);
  const removed = await h.request('GET', '/export', account);
  assert.deepEqual(removed.body.assets, []); assert.deepEqual(removed.body.aiDrafts, []);
  assert.equal(h.providerCalls(), 1);
});

test('invalid active-to-finished batches retain recoverable sets and corrected finish replays once across restart', async t => {
  const h = await harness(t), account = await h.register(), active = activeWorkout(), finished = finishedWorkout(active);
  assert.equal((await h.sync(account, mutation(upsert('activeWorkouts', active)))).status, 200);
  const baseline = await h.snapshot(account);
  const finish = mutation(remove('activeWorkouts', active.id, 1), upsert('workouts', { ...finished, duration: 0 }));
  assert.equal((await h.sync(account, finish)).status, 400);
  assert.deepEqual(await h.snapshot(account), baseline, 'invalid duration cannot delete the active sets or spend their version');
  assert.equal(h.receiptCount(account, finish.mutationId), 0);
  const corrected = { ...finish, changes: [remove('activeWorkouts', active.id, 1), upsert('workouts', finished)] };
  const saved = await h.sync(account, corrected);
  assert.equal(saved.status, 200); assert.deepEqual(saved.body.state.activeWorkouts, []);
  assert.deepEqual(saved.body.state.workouts, [finished]);
  assert.equal(saved.body.entityVersions[key('activeWorkouts', active.id)], 2);
  assert.equal(saved.body.entityVersions[key('workouts', active.id)], 1);
  await h.restart();
  const replay = await h.sync(account, corrected);
  assert.equal(replay.status, 200); assert.deepEqual(replay.body, saved.body);
  assert.equal(h.receiptCount(account, finish.mutationId), 1); assert.equal(h.providerCalls(), 0);
});

test('a concurrent active-session edit rejects the whole finish and explicit reviewed retry keeps the latest notes and sets', async t => {
  const h = await harness(t), account = await h.register(), active = activeWorkout();
  assert.equal((await h.sync(account, mutation(upsert('activeWorkouts', active)))).status, 200);
  const remote = structuredClone(active);
  remote.notes = 'Reviewed note from another synthetic tab'; remote.exercises[0].setLogs[0].reps = 9;
  assert.equal((await h.sync(account, mutation(upsert('activeWorkouts', remote, 1)))).status, 200);
  const latest = await h.snapshot(account), staleFinish = mutation(upsert('workouts', finishedWorkout(active)), remove('activeWorkouts', active.id, 1));
  const conflict = await h.sync(account, staleFinish);
  assert.equal(conflict.status, 409); assert.equal(conflict.body.code, 'SYNC_CONFLICT');
  assert.deepEqual(conflict.body.conflicts, [key('activeWorkouts', active.id)]);
  assert.deepEqual(conflict.body.snapshot, latest); assert.deepEqual(await h.snapshot(account), latest);
  assert.equal(latest.entityVersions[key('workouts', active.id)], undefined, 'no completed workout is partially created');
  assert.equal(h.receiptCount(account, staleFinish.mutationId), 0);
  const reviewed = finishedWorkout(remote);
  const recovered = await h.sync(account, { ...staleFinish, changes: [upsert('workouts', reviewed), remove('activeWorkouts', active.id, 2)] });
  assert.equal(recovered.status, 200); assert.equal(recovered.body.revision, latest.revision + 1);
  assert.deepEqual(recovered.body.state.activeWorkouts, []); assert.deepEqual(recovered.body.state.workouts, [reviewed]);
  assert.equal(recovered.body.state.workouts[0].exercises[0].setLogs[0].reps, 9);
  assert.equal(h.providerCalls(), 0);
});
