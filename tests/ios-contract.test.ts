import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { createApp } from '../server/app';
import { mealTotals, sleepHours, type Meal, type Sleep, type SyncChange, type SyncMutation, type SyncSnapshot, type User, type Workout } from '../src/types';

const ORIGIN = 'http://127.0.0.1:5173';
const PASSWORD = 'Synthetic iOS contract password 2026';
const fixtureRoot = new URL('../ios/Packages/FormaCore/Tests/FormaCoreTests/Fixtures/', import.meta.url);
const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(name + '.json', fixtureRoot), 'utf8')) as T;
const fixtures = () => ({ meal: fixture<Meal>('meal'), sleep: fixture<Sleep>('sleep'), workout: fixture<Workout>('workout') });
const upsert = <T extends { id: string }>(collection: SyncChange['collection'], value: T, baseVersion = 0): SyncChange => ({ collection, id: value.id, kind: 'upsert', baseVersion, value });
const mutation = (...changes: SyncChange[]): SyncMutation => ({ mutationId: randomUUID(), changes });
interface Account { user: User; cookie: string }
interface ErrorBody { code?: string; conflicts?: string[]; snapshot?: SyncSnapshot }

async function harness(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-ios-contract-'));
  const service = createApp({ dataDir: directory, secureCookies: false, ai: {} });
  const server = service.app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    service.close();
    const target = resolve(directory);
    // Verify the final absolute target before this test removes its own temporary tree.
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith('forma-ios-contract-'));
    rmSync(target, { recursive: true, force: true });
  });
  await new Promise<void>((done, reject) => { server.once('listening', done); server.once('error', reject); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  assert.notEqual(address.port, 5173); assert.notEqual(address.port, 3001); assert.notEqual(address.port, 8080);
  const base = `http://127.0.0.1:${address.port}/api`;
  const request = async <T = SyncSnapshot>(path: string, account?: Account, body?: unknown, extra: Record<string, string> = {}) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: {
      Origin: ORIGIN, 'Content-Type': 'application/json', ...(account ? { Cookie: account.cookie, 'X-Forma-Account': account.user.id } : {}), ...extra,
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() as T, response };
  };
  const register = async (): Promise<Account> => {
    const result = await request<{ user: User }>('/auth/register', undefined, { name: 'Synthetic iOS account', email: `ios-contract-${randomUUID()}@example.test`, password: PASSWORD });
    assert.equal(result.status, 201);
    const cookie = result.response.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie, 'registration must issue a private session cookie');
    assert.ok(result.response.headers.get('set-cookie')?.includes('HttpOnly'));
    return { user: result.data.user, cookie };
  };
  return { request, register };
}

test('FormaCore golden records register, save and round-trip through the real cookie-bound sync API', async t => {
  const h = await harness(t), account = await h.register();
  const me = await h.request<{ user: User }>('/auth/me', account);
  assert.equal(me.status, 200); assert.equal(me.data.user.id, account.user.id);
  const blank = await h.request('/sync', account);
  assert.equal(blank.status, 200); assert.equal(blank.data.revision, 0);
  for (const collection of ['meals', 'sleeps', 'workouts'] as const) assert.deepEqual(blank.data.state[collection], []);
  const { meal, sleep, workout } = fixtures();
  const saved = await h.request('/sync', account, mutation(upsert('meals', meal), upsert('sleeps', sleep), upsert('workouts', workout)));
  assert.equal(saved.status, 200);
  const read = await h.request('/sync', account);
  assert.equal(read.status, 200); assert.equal(read.data.revision, 1);
  assert.deepEqual(read.data.state.meals, [meal]);
  assert.deepEqual(read.data.state.sleeps, [sleep]);
  assert.deepEqual(read.data.state.workouts, [workout]);
  for (const [collection, record] of [['meals', meal], ['sleeps', sleep], ['workouts', workout]] as const) {
    assert.equal(read.data.entityVersions[`${collection}:${record.id}`], 1);
  }
  assert.deepEqual(mealTotals(read.data.state.meals[0]), { kcal: 375, protein: 30, carbs: 45, fat: 7.5 });
  assert.equal(read.data.state.meals[0].referenceGrams, 100, 'the server keeps reference nutrition; it does not scale the stored recipe twice');
  assert.equal(sleepHours(read.data.state.sleeps[0]), 7.5);
  assert.equal(read.data.state.workouts[0].duration, 20.5);
  assert.equal(read.data.state.workouts[0].exercises.length, 1);
  assert.equal(read.data.state.workouts[0].exercises[0].setLogs, undefined, 'legacy summaries must not acquire invented individual sets');
});

test('retrying the exact native mutation is idempotent and preserves its original record identities', async t => {
  const h = await harness(t), account = await h.register(), { meal, sleep, workout } = fixtures();
  const body = mutation(upsert('meals', meal), upsert('sleeps', sleep), upsert('workouts', workout));
  const first = await h.request('/sync', account, body);
  assert.equal(first.status, 200);
  const retried = await h.request('/sync', account, body);
  assert.equal(retried.status, 200);
  assert.deepEqual(retried.data, first.data);
  const final = await h.request('/sync', account);
  assert.equal(final.data.revision, 1);
  assert.deepEqual(final.data.state.meals.map(record => record.id), [meal.id]);
  assert.deepEqual(final.data.state.sleeps.map(record => record.id), [sleep.id]);
  assert.deepEqual(final.data.state.workouts.map(record => record.id), [workout.id]);
  assert.deepEqual(final.data.entityVersions, first.data.entityVersions);
});

test('an iOS request cannot use another account header with its own cookie or write without the trusted Origin', async t => {
  const h = await harness(t), owner = await h.register(), other = await h.register(), { meal } = fixtures();
  assert.equal((await h.request('/sync', owner, mutation(upsert('meals', meal)))).status, 200);
  const rejectedRead = await h.request<ErrorBody>('/sync', other, undefined, { 'X-Forma-Account': owner.user.id });
  assert.equal(rejectedRead.status, 401); assert.equal(rejectedRead.data.code, 'ACCOUNT_CHANGED');
  const rejectedWrite = await h.request<ErrorBody>('/sync', other, mutation(upsert('meals', meal)), { 'X-Forma-Account': owner.user.id });
  assert.equal(rejectedWrite.status, 401); assert.equal(rejectedWrite.data.code, 'ACCOUNT_CHANGED');
  assert.equal((await h.request<ErrorBody>('/sync', undefined, undefined, { 'X-Forma-Account': owner.user.id })).status, 401);
  assert.equal((await h.request<ErrorBody>('/sync', other, mutation(upsert('meals', meal)), { Origin: 'https://untrusted.example.test' })).status, 403);
  const otherRead = await h.request('/sync', other);
  assert.equal(otherRead.status, 200); assert.equal(otherRead.data.revision, 0); assert.deepEqual(otherRead.data.state.meals, []);
  const ownerRead = await h.request('/sync', owner);
  assert.deepEqual(ownerRead.data.state.meals, [meal]);
});

test('a stale native baseVersion returns 409 and applies none of the accompanying records', async t => {
  const h = await harness(t), account = await h.register(), { meal, workout } = fixtures();
  assert.equal((await h.request('/sync', account, mutation(upsert('meals', meal)))).status, 200);
  const reviewed = { ...meal, grams: 175 };
  assert.equal((await h.request('/sync', account, mutation(upsert('meals', reviewed, 1)))).status, 200);
  const conflict = await h.request<ErrorBody>('/sync', account, mutation(upsert('meals', { ...meal, grams: 200 }, 1), upsert('workouts', workout)));
  assert.equal(conflict.status, 409); assert.equal(conflict.data.code, 'SYNC_CONFLICT');
  assert.deepEqual(conflict.data.conflicts, [`meals:${meal.id}`]);
  assert.equal(conflict.data.snapshot?.state.meals[0].grams, 175);
  const final = await h.request('/sync', account);
  assert.equal(final.data.revision, 2);
  assert.deepEqual(final.data.state.meals, [reviewed]);
  assert.deepEqual(final.data.state.workouts, []);
  assert.equal(final.data.entityVersions[`meals:${meal.id}`], 2);
  assert.equal(final.data.entityVersions[`workouts:${workout.id}`], undefined);
});
