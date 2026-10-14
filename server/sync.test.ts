import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from './app';
import type { AppState, Workout, SetLog, TrainingRoutine, TrainingSchedule, PlanVersion, SyncChange, SyncMutation } from '../src/types';
import { emptyState } from '../src/types';

const NOW = '2026-10-14T18:00:00.000Z';
const ORIGIN = 'http://127.0.0.1:5173';
const PASSWORD = 'local-test-password-123';
const key = (collection: string, id: string) => `${collection}:${id}`;
const set = (patch: Partial<SetLog> = {}): SetLog => ({ id: randomUUID(), kind: 'work', reps: 8, weight: 40, durationSeconds: null, distanceMeters: null, rpe: null, rir: null, completed: true, ...patch });
const workout = (patch: Partial<Workout> = {}): Workout => ({ id: randomUUID(), date: '2026-10-14', name: 'Strength', duration: 30, rpe: null, notes: '', createdAt: NOW, exercises: [{ name: 'Row', sets: 1, reps: 8, weight: 40 }], ...patch });
const routine = (patch: Partial<TrainingRoutine> = {}): TrainingRoutine => ({ id: randomUUID(), name: 'A', createdAt: NOW, updatedAt: NOW, exercises: [{ id: randomUUID(), name: 'Row', primaryMuscles: ['back'], setCount: 3, repsMin: 6, repsMax: 10, weight: 40, restSeconds: 90, supersetGroup: null, progression: { enabled: true, incrementKg: 2.5 } }], ...patch });
const schedule = (routineId: string): TrainingSchedule => ({ id: randomUUID(), name: 'Week', mode: 'weekly', anchorDate: '2026-10-14', slots: [{ id: randomUUID(), routineId, weekday: 1 }], createdAt: NOW, updatedAt: NOW });
const upsert = <T extends { id: string }>(collection: SyncChange['collection'], value: T, baseVersion = 0): SyncChange => ({ collection, id: value.id, baseVersion, kind: 'upsert', value });
const mutation = (...changes: SyncChange[]): SyncMutation => ({ mutationId: randomUUID(), changes });

async function harness(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'forma-sync-test-'));
  let service = createApp({ dataDir: dir, secureCookies: false, ai: {} });
  let server = service.app.listen(0, '127.0.0.1');
  let base = '';
  const ready = async () => {
    await new Promise<void>(done => server.once('listening', done));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}/api`;
  };
  await ready();
  const stop = async () => { await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())); service.close(); };
  t.after(async () => {
    await stop();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep) && dir.includes('forma-sync-test-'));
    rmSync(dir, { recursive: true, force: true });
  });
  const accountByCookie = new Map<string, string>();
  const request = async (path: string, cookie?: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', extra: Record<string, string> = {}) => {
    const response = await fetch(base + path, { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie, 'X-Forma-Account': accountByCookie.get(cookie) ?? '' } : {}), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    const newCookie = response.headers.get('set-cookie')?.split(';')[0];
    if (newCookie && data.user) accountByCookie.set(newCookie, data.user.id);
    return { status: response.status, data, cookie: newCookie };
  };
  const register = async () => {
    const result = await request('/auth/register', undefined, { email: `${randomUUID()}@example.com`, password: PASSWORD, name: 'Sync' });
    assert.equal(result.status, 201); assert.ok(result.cookie);
    return { cookie: result.cookie, id: result.data.user.id };
  };
  const restart = async () => { await stop(); service = createApp({ dataDir: dir, secureCookies: false, ai: {} }); server = service.app.listen(0, '127.0.0.1'); await ready(); };
  return { request, register, restart, store: () => service.store };
}

test('entity CAS merges disjoint device records and rejects an entire conflicting batch', async t => {
  const h = await harness(t), a = await h.register(), first = workout(), second = workout();
  const baseline = await h.request('/sync', a.cookie);
  assert.equal(baseline.status, 200); assert.equal(baseline.data.revision, 0);
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('workouts', first)))).status, 200);
  const merged = await h.request('/sync', a.cookie, mutation(upsert('workouts', second)));
  assert.equal(merged.status, 200); assert.equal(merged.data.state.workouts.length, 2);
  assert.equal(merged.data.entityVersions[key('workouts', first.id)], 1);
  const updated = { ...first, duration: 45 };
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('workouts', updated, 1)))).status, 200);
  const third = workout();
  const conflict = await h.request('/sync', a.cookie, mutation(upsert('workouts', { ...first, duration: 60 }, 1), upsert('workouts', third)));
  assert.equal(conflict.status, 409); assert.equal(conflict.data.code, 'SYNC_CONFLICT');
  assert.deepEqual(conflict.data.conflicts, [key('workouts', first.id)]);
  assert.equal(conflict.data.snapshot.state.workouts.find((w: Workout) => w.id === first.id).duration, 45);
  const final = (await h.request('/sync', a.cookie)).data;
  assert.equal(final.revision, 3); assert.equal(final.state.workouts.length, 2);
  assert.equal(final.entityVersions[key('workouts', third.id)], undefined);
});

test('tombstones prevent stale devices from reviving deleted records', async t => {
  const h = await harness(t), a = await h.register(), w = workout();
  await h.request('/sync', a.cookie, mutation(upsert('workouts', w)));
  const deleted = await h.request('/sync', a.cookie, mutation({ collection: 'workouts', id: w.id, baseVersion: 1, kind: 'delete' }));
  assert.equal(deleted.status, 200); assert.equal(deleted.data.state.workouts.length, 0);
  assert.equal(deleted.data.entityVersions[key('workouts', w.id)], 2);
  for (const baseVersion of [0, 1]) assert.equal((await h.request('/sync', a.cookie, mutation(upsert('workouts', w, baseVersion)))).status, 409);
  await h.restart();
  const after = await h.request('/sync', a.cookie);
  assert.equal(after.data.entityVersions[key('workouts', w.id)], 2); assert.equal(after.data.state.workouts.length, 0);
});

test('successful mutation replay is durable and returns current data without retaining health snapshots', async t => {
  const h = await harness(t), a = await h.register(), w = workout(), request = mutation(upsert('workouts', w));
  const saved = await h.request('/sync', a.cookie, request);
  assert.equal(saved.status, 200); assert.equal(saved.data.revision, 1);
  await h.request('/sync', a.cookie, mutation(upsert('workouts', { ...w, duration: 50 }, 1)));
  await h.restart();
  const replay = await h.request('/sync', a.cookie, request);
  assert.equal(replay.status, 200); assert.equal(replay.data.revision, 2);
  assert.equal(replay.data.state.workouts[0].duration, 50);
  const reordered = { changes: request.changes.map(change => ({ value: change.value, kind: change.kind, baseVersion: change.baseVersion, id: change.id, collection: change.collection })), mutationId: request.mutationId };
  assert.equal((await h.request('/sync', a.cookie, reordered)).status, 200);
  const changed = await h.request('/sync', a.cookie, { ...request, changes: [upsert('workouts', { ...w, name: 'Other' })] });
  assert.equal(changed.status, 409); assert.equal(changed.data.code, 'SYNC_CONFLICT');
  const rows = h.store().db.prepare('SELECT * FROM sync_mutations WHERE owner_id=?').all(a.id);
  assert.equal(rows.length, 2); assert.equal(Object.hasOwn(rows[0], 'state_json'), false);
  assert.match(String(rows[0].payload_hash), /^[a-f0-9]{64}$/);
});

test('legacy PUT participates in entity versions and omission cannot erase new training collections', async t => {
  const h = await harness(t), a = await h.register(), r = routine(), s = schedule(r.id), w = workout();
  const first = await h.request('/sync', a.cookie, mutation(upsert('routines', r), upsert('schedules', s), upsert('workouts', w)));
  const legacy: AppState = structuredClone(first.data.state);
  delete legacy.routines; delete legacy.schedules; delete legacy.activeWorkouts;
  legacy.workouts[0].duration = 40;
  const saved = await h.request('/state', a.cookie, { state: legacy, revision: first.data.revision }, 'PUT');
  assert.equal(saved.status, 200); assert.equal(saved.data.state.routines.length, 1); assert.equal(saved.data.state.schedules.length, 1);
  const snapshot = (await h.request('/sync', a.cookie)).data;
  assert.equal(snapshot.entityVersions[key('workouts', w.id)], 2);
  assert.equal(snapshot.entityVersions[key('routines', r.id)], 1);
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('workouts', w, 1)))).status, 409);
  const latest = await h.request('/sync', a.cookie, mutation(upsert('workouts', { ...w, duration: 55 }, 2)));
  assert.equal(latest.status, 200);
  assert.equal((await h.request('/state', a.cookie, { state: saved.data.state, revision: saved.data.revision }, 'PUT')).status, 409);
});

test('old persisted summaries remain summaries and receive compatible empty collections', async t => {
  const h = await harness(t), a = await h.register(), w = workout({ rpe: 7 });
  const old: AppState = { ...emptyState(), workouts: [w] };
  delete old.routines; delete old.schedules; delete old.activeWorkouts;
  h.store().db.prepare('UPDATE states SET state_json=?,revision=5 WHERE owner_id=?').run(JSON.stringify(old), a.id);
  await h.restart();
  const snapshot = (await h.request('/sync', a.cookie)).data;
  assert.equal(snapshot.revision, 5); assert.deepEqual(snapshot.state.routines, []);
  assert.equal(snapshot.state.workouts[0].exercises[0].setLogs, undefined);
  assert.equal(snapshot.entityVersions[key('workouts', w.id)], 1);
});

test('sync keeps session account binding, ownership, CSRF and strict mutation identity', async t => {
  const h = await harness(t), a = await h.register(), b = await h.register(), w = workout();
  assert.equal((await h.request('/sync')).status, 401);
  const cross = await h.request('/sync', b.cookie, mutation(upsert('workouts', w)), 'POST', { 'X-Forma-Account': a.id });
  assert.equal(cross.status, 401); assert.equal(cross.data.code, 'ACCOUNT_CHANGED');
  assert.equal((await h.request('/sync', b.cookie, undefined, 'GET', { 'X-Forma-Account': a.id })).status, 401);
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('workouts', w)), 'POST', { Origin: 'https://attacker.invalid' })).status, 403);
  assert.equal((await h.request('/sync', a.cookie, { ...mutation(upsert('workouts', w)), user_id: b.id })).status, 400);
  assert.equal((await h.request('/sync', a.cookie, mutation({ ...upsert('workouts', w), id: randomUUID() }))).status, 400);
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('workouts', w), upsert('workouts', w)))).status, 400);
  assert.equal((await h.request('/sync', b.cookie)).data.state.workouts.length, 0);
});

test('new set facts validate drops, unknowns, duration, nested IDs and pause persistence', async t => {
  const h = await harness(t), a = await h.register(), parent = set(), drop = set({ kind: 'drop', weight: 30, dropParentId: parent.id });
  const detailed = workout({ exercises: [{ id: randomUUID(), name: 'Row', sets: 2, reps: 8, weight: 40, setLogs: [parent, drop], restSeconds: 90, supersetGroup: 'A' }] });
  const valid = await h.request('/sync', a.cookie, mutation(upsert('workouts', detailed)));
  assert.equal(valid.status, 200);
  const stripped = { ...detailed, exercises: [{ name: 'Row', sets: 2, reps: 8, weight: 40 }] };
  assert.equal((await h.request('/state', a.cookie, { state: { ...valid.data.state, workouts: [stripped] }, revision: valid.data.revision }, 'PUT')).status, 400);
  const invalidSets: SetLog[][] = [
    [set({ reps: null, weight: null, distanceMeters: 100 })],
    [drop, parent], [parent, { ...drop, weight: 50 }],
    [parent, { ...parent }], [set({ completed: false, completedAt: NOW })],
    [set({ weight: -1 })], [set({ rpe: 11 })],
    [set({ completed: false, reps: null, weight: null })],
  ];
  for (const setLogs of invalidSets) {
    const bad = workout({ exercises: [{ name: 'Row', sets: 1, reps: 1, weight: 0, setLogs }] });
    assert.equal((await h.request('/sync', a.cookie, mutation(upsert('workouts', bad)))).status, 400);
  }
  const timed = workout({ exercises: [{ name: 'Hold', sets: 1, reps: 0, weight: 0, setLogs: [set({ reps: null, weight: null, durationSeconds: 30 })] }] });
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('workouts', timed)))).status, 200);
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('workouts', workout({ exercises: [{ name: 'Unknown legacy', sets: 1, reps: 0, weight: 0 }] }))))).status, 400);
  const active = { id: randomUUID(), date: '2026-10-14', name: 'Session', startedAt: NOW, exercises: [{ id: randomUUID(), name: 'Row', primaryMuscles: [], setLogs: [set({ reps: null, weight: null, completed: false })], supersetGroup: null, restSeconds: 90, notes: '' }], restEndsAt: null, restRemainingSeconds: 48, notes: '', rpe: null };
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('activeWorkouts', active)))).status, 200);
  await h.restart();
  const saved = (await h.request('/sync', a.cookie)).data.state.activeWorkouts[0];
  assert.equal(saved.restRemainingSeconds, 48); assert.equal(saved.exercises[0].setLogs[0].weight, null);
});

test('routine history is immutable and schedules require valid existing routines and unique weekdays', async t => {
  const h = await harness(t), a = await h.register(), r = routine(), s = schedule(r.id);
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('routines', r), upsert('schedules', s)))).status, 200);
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('routines', { ...r, name: 'Edited' }, 1)))).status, 400);
  assert.equal((await h.request('/sync', a.cookie, mutation({ collection: 'routines', id: r.id, kind: 'delete', baseVersion: 1 }))).status, 400);
  const child = routine({ supersedesId: r.id, name: 'Progressed' });
  const changed = { ...s, slots: [{ ...s.slots[0], routineId: child.id }] };
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('routines', child), upsert('schedules', changed, 1)))).status, 200);
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('routines', routine({ supersedesId: r.id }))))).status, 200);
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('routines', routine({ supersedesId: randomUUID() }))))).status, 400);
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('schedules', { ...schedule(r.id), slots: [{ id: randomUUID(), routineId: r.id, weekday: 1 }, { id: randomUUID(), routineId: r.id, weekday: 1 }] })))).status, 400);
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('schedules', { ...schedule(r.id), mode: 'rotation' })))).status, 400);
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('schedules', schedule(randomUUID()))))).status, 400);
  const snapshot = (await h.request('/sync', a.cookie)).data;
  assert.equal(snapshot.state.routines.length, 3); assert.equal(snapshot.state.schedules[0].slots[0].routineId, child.id);
});

test('sync cannot bypass immutable plans or genuine AI provenance and failed batches do not spend versions', async t => {
  const h = await harness(t), a = await h.register();
  const p: PlanVersion = { id: randomUUID(), parentId: null, createdAt: NOW, reason: 'My plan', trainingMinutes: 45, trainingDays: 3, sleepHours: 8, calorieTarget: null, proteinTarget: null };
  const first = await h.request('/sync', a.cookie, mutation(upsert('planVersions', p), { collection: 'currentPlanId', id: 'currentPlanId', baseVersion: 0, kind: 'upsert', value: p.id }));
  assert.equal(first.status, 200);
  const w = workout();
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('planVersions', { ...p, trainingMinutes: 90 }, 1), upsert('workouts', w)))).status, 400);
  const forged = { id: randomUUID(), date: '2026-10-14', name: 'AI', type: 'lunch', grams: 100, referenceGrams: 100, kcal: 200, protein: 10, carbs: 20, fat: 8, source: 'ai_estimate', createdAt: NOW, assetId: randomUUID(), aiDraftId: randomUUID(), aiItemIndex: 0 };
  assert.equal((await h.request('/sync', a.cookie, mutation(upsert('meals', forged), upsert('workouts', w)))).status, 400);
  const snapshot = (await h.request('/sync', a.cookie)).data;
  assert.equal(snapshot.revision, 1); assert.equal(snapshot.state.workouts.length, 0);
  assert.equal(snapshot.entityVersions[key('workouts', w.id)], undefined);
});

test('account deletion cascades sync receipts and versions without exposing another account', async t => {
  const h = await harness(t), a = await h.register(), b = await h.register(), w = workout();
  await h.request('/sync', a.cookie, mutation(upsert('workouts', w)));
  const exported = await h.request('/export', a.cookie);
  assert.equal(exported.status, 200); assert.equal(exported.data.entityVersions[key('workouts', w.id)], 1);
  assert.equal((await h.request('/account', a.cookie, { password: PASSWORD }, 'DELETE')).status, 200);
  for (const table of ['sync_entities', 'sync_mutations']) assert.equal(h.store().db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE owner_id=?`).get(a.id)?.count, 0);
  assert.equal((await h.request('/sync', a.cookie)).status, 401);
  assert.equal((await h.request('/sync', b.cookie)).data.entityVersions[key('workouts', w.id)], undefined);
});
