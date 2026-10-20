import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { request as httpRequest } from 'node:http';
import { test, type TestContext } from 'node:test';
import { createApp } from '../server/app';
import type { CompanionSnapshot } from '../src/companion';
import type { Meal, Profile, Sleep, SyncChange, SyncSnapshot, User, Workout } from '../src/types';

const ORIGIN = 'http://127.0.0.1:5173';
const PASSWORD = 'Synthetic companion QA password 2026';
const INITIAL_TIME = Date.parse('2026-10-19T12:00:00Z');
interface Account { user: User; cookie: string }
interface RequestOptions { method?: string; body?: unknown; headers?: Record<string, string>; origin?: string | null; accountHint?: string | null }
const dayAt = (time: number) => new Date(time).toISOString().slice(0, 10);
const profile = (timezone = 'UTC'): Profile => ({ name: 'Synthetic companion account', goal: 'habits', experience: 'regular', trainingDays: 3, timeMinutes: 30, equipment: 'gym', allergies: '', restrictions: '', language: 'en', units: 'metric', timezone, sleepGoal: 8, cloudConsent: false, aiConsent: false });
const meal = (date: string): Meal => ({ id: randomUUID(), date, name: 'Synthetic companion meal', type: 'lunch', grams: 100, referenceGrams: 100, kcal: 200, protein: 10, carbs: 25, fat: 5, source: 'manual', createdAt: date + 'T12:00:00Z' });
const workout = (date: string): Workout => ({ id: randomUUID(), date, name: 'Synthetic companion training', duration: 20, rpe: null, exercises: [{ name: 'Synthetic row', sets: 1, reps: 6, weight: 30 }], notes: '', createdAt: date + 'T12:00:00Z' });
const sleep = (date: string): Sleep => ({ id: randomUUID(), date, start: date + 'T00:00:00Z', end: date + 'T07:00:00Z', quality: 3, energy: 3, source: 'manual', timezone: 'UTC', createdAt: date + 'T12:00:00Z' });
const upsert = <T extends { id: string }>(collection: SyncChange['collection'], value: T, baseVersion = 0): SyncChange => ({ collection, id: value.id, kind: 'upsert', baseVersion, value });
const mutation = (...changes: SyncChange[]) => ({ mutationId: randomUUID(), changes });

async function harness(t: TestContext, config: { secureCookies?: boolean; trustProxy?: number } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-companion-test-'));
  let time = INITIAL_TIME;
  const service = createApp({ dataDir: directory, secureCookies: false, ai: {}, companionNow: () => time, ...config });
  const server = service.app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    service.close();
    const target = resolve(directory);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith('forma-companion-test-'));
    rmSync(target, { recursive: true, force: true });
  });
  await new Promise<void>((done, reject) => { server.once('listening', done); server.once('error', reject); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  assert.ok(![3001, 5173, 8080].includes(address.port));
  const base = `http://127.0.0.1:${address.port}`;
  const request = async <T = CompanionSnapshot>(path: string, account?: Account, options: RequestOptions = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options.headers };
    if (options.origin !== null) headers.Origin = options.origin ?? ORIGIN;
    if (account) headers.Cookie = account.cookie;
    if (options.accountHint !== null && (options.accountHint ?? account?.user.id)) headers['X-Forma-Account'] = options.accountHint ?? account!.user.id;
    const response = await fetch(base + path, { method: options.method ?? (options.body === undefined ? 'GET' : 'POST'), headers, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
    return { status: response.status, data: await response.json() as T, response };
  };
  const register = async (timezone: string | null = 'UTC'): Promise<Account> => {
    const result = await request<{ user: User }>('/api/auth/register', undefined, { body: { name: 'Synthetic companion account', email: `companion-${randomUUID()}@example.test`, password: PASSWORD } });
    assert.equal(result.status, 201);
    const cookie = result.response.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
    const account = { user: result.data.user, cookie };
    if (timezone !== null) {
      const saved = await request<SyncSnapshot>('/api/sync', account, { body: mutation({ collection: 'profile', id: 'profile', baseVersion: 0, kind: 'upsert', value: profile(timezone) }) });
      assert.equal(saved.status, 200);
    }
    return account;
  };
  const snapshot = async (account: Account) => {
    const result = await request('/api/companion', account); assert.equal(result.status, 200); return result.data;
  };
  const sync = async (account: Account) => {
    const result = await request<SyncSnapshot>('/api/sync', account); assert.equal(result.status, 200); return result.data;
  };
  const save = async (account: Account, ...changes: SyncChange[]) => {
    const result = await request<SyncSnapshot>('/api/sync', account, { body: mutation(...changes) }); assert.equal(result.status, 200); return result.data;
  };
  const rest = async (account: Account) => {
    const result = await request('/api/companion/rest', account, { body: {} }); assert.equal(result.status, 200); return result.data;
  };
  return { ...service, base, request, register, snapshot, sync, save, rest, setTime: (value: string) => { time = Date.parse(value); }, today: () => dayAt(time) };
}

test('companion reads and every mutation require the cookie account binding and trusted write Origin', async t => {
  const h = await harness(t), a = await h.register(), b = await h.register();
  const operations = [
    { path: '/api/companion' },
    { path: '/api/companion/claim', body: {} },
    { path: '/api/companion/rest', body: {} },
    { path: '/api/companion/equipment', method: 'PUT', body: { item: null } },
    { path: '/api/companion/chests/' + randomUUID() + '/open', body: {} },
    { path: '/api/companion/challenges', body: { action: 'create' } },
  ];
  for (const { path, ...options } of operations) {
    assert.equal((await h.request(path, undefined, options)).status, 401);
    assert.equal((await h.request(path, a, { ...options, accountHint: null })).status, 401);
    const cross = await h.request<{ code: string }>(path, b, { ...options, accountHint: a.user.id });
    assert.equal(cross.status, 401); assert.equal(cross.data.code, 'ACCOUNT_CHANGED');
    if (options.body !== undefined) for (const origin of [null, 'https://untrusted.example.test']) assert.equal((await h.request(path, a, { ...options, origin })).status, 403);
  }
  assert.equal((await h.snapshot(a)).xp, 0); assert.equal((await h.snapshot(b)).xp, 0);
  assert.equal((await h.request('/api/companion', a)).response.headers.get('cache-control'), 'no-store');
});

test('same-origin HTTPS writes require explicitly trusted forwarding configuration', async t => {
  for (const trustProxy of [undefined, 1]) {
    const h = await harness(t, { secureCookies: true, trustProxy }), a = await h.register();
    // Use node:http because Fetch controls Host and may discard a caller override.
    const result = await new Promise<{ status: number; data: CompanionSnapshot }>((done, reject) => {
      const request = httpRequest(h.base + '/api/companion/claim', { method: 'POST', headers: { Origin: 'https://forma.test', Host: 'forma.test', 'X-Forwarded-Proto': 'https', Cookie: a.cookie, 'X-Forma-Account': a.user.id, 'Content-Type': 'application/json' } }, response => {
        let body = ''; response.setEncoding('utf8'); response.on('data', part => { body += part; });
        response.on('end', () => { try { done({ status: response.statusCode!, data: JSON.parse(body) }); } catch (error) { reject(error); } });
      });
      request.on('error', reject); request.end('{}');
    });
    assert.equal(result.status, trustProxy ? 200 : 403);
    if (trustProxy) assert.equal(result.data.xp, 0);
  }
});

test('new accounts have no invented progress and cannot inject XP, owner, dates, inventory or unknown equipment', async t => {
  const h = await harness(t), a = await h.register(), b = await h.register(), blank = await h.snapshot(a);
  assert.equal(blank.xp, 0); assert.equal(blank.level, 1); assert.equal(blank.activeDays, 0);
  assert.deepEqual(blank.inventory, []); assert.deepEqual(blank.chests, []); assert.equal(blank.equipped, null); assert.equal(blank.challenge, null);
  assert.deepEqual(blank.quests.map(q => [q.id, q.completed, q.xp]), [['nutrition', false, 10], ['movement', false, 10], ['sleep', false, 10]]);
  for (const path of ['/api/companion/claim', '/api/companion/rest']) {
    for (const body of [{ xp: 9999 }, { owner: b.user.id }, { user_id: b.user.id }, { day: '2026-01-01' }, { inventory: ['crown'] }]) assert.equal((await h.request(path, a, { body })).status, 400);
  }
  assert.equal((await h.request('/api/companion/equipment', a, { method: 'PUT', body: { item: 'leaf' } })).status, 409);
  assert.equal((await h.request('/api/companion/equipment', a, { method: 'PUT', body: { item: 'unknown' } })).status, 400);
  assert.equal((await h.request('/api/companion/equipment', a, { method: 'PUT', body: { item: null, xp: 999 } })).status, 400);
  assert.equal((await h.request('/api/companion/chests/' + randomUUID() + '/open', a, { body: {} })).status, 404);
  assert.deepEqual(await h.snapshot(a), blank); assert.equal((await h.snapshot(b)).xp, 0);
  const withoutProfile = await h.register(null);
  assert.equal((await h.request('/api/companion/rest', withoutProfile, { body: {} })).status, 409);
  assert.equal((await h.snapshot(withoutProfile)).xp, 0);
});

test('saving three current facts rewards ten each, regardless of amounts, and concurrent claims cannot mint XP', async t => {
  const h = await harness(t), a = await h.register(), day = h.today();
  const original = mutation(upsert('meals', meal(day)), upsert('workouts', workout(day)), upsert('sleeps', sleep(day)));
  assert.equal((await h.request('/api/sync', a, { body: original })).status, 200);
  const awarded = await h.snapshot(a);
  assert.equal(awarded.xp, 30); assert.equal(awarded.activeDays, 1); assert.ok(awarded.quests.every(q => q.completed));
  assert.equal((await h.request('/api/sync', a, { body: original })).status, 200);
  await h.save(a, upsert('meals', { ...meal(day), grams: 800 }), upsert('workouts', { ...workout(day), duration: 120 }), upsert('sleeps', { ...sleep(day), start: day + 'T09:00:00Z', end: day + 'T10:00:00Z' }));
  const concurrent = await Promise.all(Array.from({ length: 10 }, (_, i) => h.request(i % 2 ? '/api/companion/claim' : '/api/companion/rest', a, { body: {} })));
  for (const result of concurrent) { assert.equal(result.status, 200); assert.equal(result.data.xp, 30); }
  assert.deepEqual(await h.snapshot(a), awarded);
});

test('new mutation IDs, edits, deletion and recreation retain facts without awarding the same quest twice', async t => {
  const h = await harness(t), a = await h.register(), record = meal(h.today());
  await h.save(a, upsert('meals', record));
  let state = await h.sync(a);
  await h.save(a, upsert('meals', { ...record, grams: 200 }, state.entityVersions['meals:' + record.id]));
  state = await h.sync(a);
  await h.save(a, { collection: 'meals', id: record.id, kind: 'delete', baseVersion: state.entityVersions['meals:' + record.id] });
  assert.equal((await h.sync(a)).state.meals.length, 0);
  assert.equal((await h.snapshot(a)).xp, 10, 'health deletion does not erase the independent reward receipt');
  await h.save(a, upsert('meals', meal(h.today())));
  assert.equal((await h.request('/api/companion/claim', a, { body: {} })).data.xp, 10);
  assert.equal((await h.snapshot(a)).activeDays, 1);
  assert.equal((await h.sync(a)).state.meals.length, 1);
});

test('confirmed rest and recorded training share the movement quest in either order', async t => {
  const h = await harness(t), a = await h.register(), b = await h.register();
  assert.equal((await h.rest(a)).xp, 10);
  await h.save(a, upsert('workouts', workout(h.today())));
  await h.save(b, upsert('workouts', workout(h.today())));
  assert.equal((await h.rest(b)).xp, 10);
  assert.equal((await h.snapshot(a)).xp, 10); assert.equal((await h.snapshot(b)).activeDays, 1);
  assert.equal((await h.sync(a)).state.workouts.length, 1, 'a reward does not replace the real training fact');
});

test('history, future dates and timezone changes cannot backfill or farm the fixed UTC allowance', async t => {
  const h = await harness(t), a = await h.register('America/Los_Angeles');
  h.setTime('2026-10-19T23:55:00Z');
  await h.save(a, upsert('meals', meal('2026-10-18')), upsert('meals', meal('2026-10-20')));
  assert.equal((await h.request('/api/companion/claim', a, { body: {} })).data.xp, 0);
  await h.save(a, upsert('meals', meal('2026-10-19')));
  assert.equal((await h.snapshot(a)).xp, 10);
  h.setTime('2026-10-20T00:05:00Z');
  assert.equal((await h.request('/api/companion/claim', a, { body: {} })).data.xp, 10, 'crossing UTC midnight cannot re-award the same local-day fact');
  let state = await h.sync(a);
  await h.save(a, { collection: 'profile', id: 'profile', kind: 'upsert', baseVersion: state.entityVersions['profile:profile'], value: profile('Pacific/Kiritimati') });
  assert.equal((await h.request('/api/companion/claim', a, { body: {} })).data.xp, 10, 'timezone changes cannot reward an already observed future-date record');
  await h.save(a, upsert('meals', meal('2026-10-20')));
  assert.equal((await h.snapshot(a)).xp, 20, 'a newly saved current fact can qualify in a new UTC and local day');
  state = await h.sync(a);
  await h.save(a, { collection: 'profile', id: 'profile', kind: 'upsert', baseVersion: state.entityVersions['profile:profile'], value: profile('Pacific/Pago_Pago') });
  await h.save(a, upsert('meals', meal('2026-10-19')));
  assert.equal((await h.request('/api/companion/claim', a, { body: {} })).data.xp, 20);
  assert.equal((await h.snapshot(a)).activeDays, 2);
});

test('claims cannot promote historical records after timezone changes, date edits or a new UTC day', async t => {
  const h = await harness(t), a = await h.register('UTC');
  h.setTime('2026-10-19T01:00:00Z');
  const historical = meal('2026-10-18'), future = workout('2026-10-20');
  await h.save(a, upsert('meals', historical), upsert('workouts', future));
  let state = await h.sync(a);
  await h.save(a, { collection: 'profile', id: 'profile', kind: 'upsert', baseVersion: state.entityVersions['profile:profile'], value: profile('America/Los_Angeles') });
  assert.equal((await h.request('/api/companion/claim', a, { body: {} })).data.xp, 0, 'the same old meal is not newly saved merely because localToday changes');
  state = await h.sync(a);
  await h.save(a, { collection: 'profile', id: 'profile', kind: 'upsert', baseVersion: state.entityVersions['profile:profile'], value: profile('UTC') });
  await h.save(a, upsert('meals', { ...historical, date: '2026-10-19' }, state.entityVersions['meals:' + historical.id]));
  assert.equal((await h.snapshot(a)).xp, 0, 'editing an already observed identity cannot backfill XP');
  h.setTime('2026-10-20T12:00:00Z');
  assert.equal((await h.request('/api/companion/claim', a, { body: {} })).data.xp, 0, 'a record that was future dated at first save never ages into a reward');
  state = await h.sync(a);
  await h.save(a, { collection: 'workouts', id: future.id, kind: 'delete', baseVersion: state.entityVersions['workouts:' + future.id] });
  state = await h.sync(a);
  await h.save(a, upsert('workouts', future, state.entityVersions['workouts:' + future.id]));
  assert.equal((await h.snapshot(a)).xp, 0, 'deleting and recreating the old identity retains its first observation');
  await h.save(a, upsert('workouts', workout('2026-10-20')));
  assert.equal((await h.snapshot(a)).xp, 10, 'a genuinely new current save still works after rejected backfills');
});

test('validation and optimistic concurrency failures commit neither a new fact nor its reward', async t => {
  const h = await harness(t), a = await h.register();
  const invalid = await h.request('/api/sync', a, { body: mutation(upsert('meals', { ...meal(h.today()), assetId: randomUUID() })) });
  assert.equal(invalid.status, 400); assert.equal((await h.sync(a)).state.meals.length, 0); assert.equal((await h.snapshot(a)).xp, 0);
  const record = meal('2026-10-18'); await h.save(a, upsert('meals', record));
  await h.save(a, upsert('meals', { ...record, grams: 120 }, 1));
  const conflict = await h.request('/api/sync', a, { body: mutation(upsert('meals', { ...record, date: h.today() }, 1), upsert('workouts', workout(h.today()))) });
  assert.equal(conflict.status, 409); assert.equal((await h.snapshot(a)).xp, 0);
  const state = await h.sync(a); assert.equal(state.state.meals[0].date, '2026-10-18'); assert.deepEqual(state.state.workouts, []);
});

test('a ledger write failure rolls back the health fact and permits one clean retry', async t => {
  const h = await harness(t), a = await h.register(), record = meal(h.today());
  // A failure injected only into this isolated test DB proves the transaction boundary.
  h.store.db.exec("CREATE TRIGGER qa_fail_reward BEFORE INSERT ON companion_rewards BEGIN SELECT RAISE(ABORT, 'synthetic reward failure'); END");
  const body = mutation(upsert('meals', record));
  const failed = await h.request('/api/sync', a, { body });
  assert.equal(failed.status, 500); assert.ok(!JSON.stringify(failed.data).includes('synthetic reward failure'));
  assert.equal((await h.sync(a)).state.meals.length, 0); assert.equal((await h.snapshot(a)).xp, 0);
  h.store.db.exec('DROP TRIGGER qa_fail_reward');
  assert.equal((await h.request('/api/sync', a, { body })).status, 200);
  assert.equal((await h.sync(a)).state.meals.length, 1); assert.equal((await h.snapshot(a)).xp, 10);
});

test('legacy snapshot saves settle atomically and stale snapshots do not reward omitted facts', async t => {
  const h = await harness(t), a = await h.register(), before = await h.sync(a);
  const candidate = { ...before.state, meals: [meal(h.today())] };
  assert.equal((await h.request('/api/state', a, { method: 'PUT', body: { state: candidate, revision: before.revision } })).status, 200);
  assert.equal((await h.snapshot(a)).xp, 10);
  assert.equal((await h.request('/api/state', a, { method: 'PUT', body: { state: { ...candidate, workouts: [workout(h.today())] }, revision: before.revision } })).status, 409);
  assert.equal((await h.snapshot(a)).xp, 10); assert.deepEqual((await h.sync(a)).state.workouts, []);
});

test('completed workbench saves reward movement once while unsaved active sessions and CAS failures do not', async t => {
  const h = await harness(t), a = await h.register();
  const blank = { unit: 'kg', routines: [], workouts: [], customEx: [], bodyweight: [], measurements: [] };
  const active = await h.request<{ rev: number; wid: string }>('/training-workbench/api/data', a, { method: 'PUT', body: { state: { ...blank, active: { d: h.today(), entries: [{ id: '0022', sets: [{ done: true, w: 30, r: 6 }] }] } }, baseRev: 0 } });
  assert.equal(active.status, 200); assert.equal((await h.snapshot(a)).xp, 0);
  const started = Date.parse(h.today() + 'T10:00:00Z');
  const state = { ...blank, workouts: [{ id: 'synthetic-companion-workbench', d: h.today(), start: started, end: started + 1200000, name: 'Synthetic workbench reward', entries: [{ id: '0022', sets: [{ done: true, w: 30, r: 6 }] }] }] };
  const body = { state, baseRev: active.data.rev, baseWid: active.data.wid };
  const saved = await h.request<{ rev: number; wid: string }>('/training-workbench/api/data', a, { method: 'PUT', body });
  assert.equal(saved.status, 200);
  assert.equal((await h.snapshot(a)).xp, 10); assert.equal((await h.sync(a)).state.workouts.length, 1);
  assert.equal((await h.request('/training-workbench/api/data', a, { method: 'PUT', body })).status, 200, 'exact workbench retry keeps its original receipt');
  assert.equal((await h.request('/training-workbench/api/data', a, { method: 'PUT', body: { ...body, state: { ...state, lang: 'zh' } } })).status, 409);
  assert.equal((await h.snapshot(a)).xp, 10); assert.equal((await h.rest(a)).xp, 10);
  const cleared = await h.request<{ rev: number; wid: string }>('/training-workbench/api/data', a, { method: 'PUT', body: { state: blank, baseRev: saved.data.rev, baseWid: saved.data.wid } });
  assert.equal(cleared.status, 200); assert.equal((await h.sync(a)).state.workouts.length, 0);
  h.setTime('2026-10-20T12:00:00Z');
  const nextStarted = started + 86400000;
  const restored = { ...state, workouts: state.workouts.map(item => ({ ...item, d: h.today(), start: nextStarted, end: nextStarted + 1200000 })) };
  assert.equal((await h.request('/training-workbench/api/data', a, { method: 'PUT', body: { state: restored, baseRev: cleared.data.rev, baseWid: cleared.data.wid } })).status, 200);
  assert.equal((await h.sync(a)).state.workouts.length, 1);
  assert.equal((await h.snapshot(a)).xp, 10, 'a deleted and date-edited source workout keeps its original observation identity');
});

test('three rewarded UTC days unlock one fixed chest; concurrent opening, ownership and equipment remain consistent', async t => {
  const h = await harness(t), a = await h.register(), b = await h.register();
  for (const date of ['2026-10-19', '2026-10-20', '2026-10-21']) { h.setTime(date + 'T12:00:00Z'); await h.rest(a); }
  const earned = await h.snapshot(a); assert.equal(earned.activeDays, 3); assert.equal(earned.chests.length, 1);
  const chest = earned.chests[0]; assert.equal(chest.milestone, 3); assert.equal(chest.item, null); assert.equal(chest.openedAt, null);
  assert.equal((await h.request('/api/companion/chests/' + chest.id + '/open', b, { body: {} })).status, 404);
  const opens = await Promise.all(Array.from({ length: 5 }, () => h.request('/api/companion/chests/' + chest.id + '/open', a, { body: {} })));
  for (const result of opens) { assert.equal(result.status, 200); assert.deepEqual(result.data, opens[0].data); }
  const opened = opens[0].data; assert.deepEqual(opened.inventory, ['leaf']); assert.equal(opened.chests[0].item, 'leaf'); assert.ok(opened.chests[0].openedAt);
  const equip = await h.request('/api/companion/equipment', a, { method: 'PUT', body: { item: 'leaf' } }); assert.equal(equip.status, 200); assert.equal(equip.data.equipped, 'leaf');
  assert.equal((await h.request('/api/companion/equipment', a, { method: 'PUT', body: { item: 'crown' } })).status, 409);
  assert.equal((await h.request('/api/companion/equipment', a, { method: 'PUT', body: { item: null } })).data.equipped, null);
  for (const date of ['2026-10-22', '2026-10-23', '2026-10-24']) { h.setTime(date + 'T12:00:00Z'); await h.rest(a); }
  const second = (await h.snapshot(a)).chests.find(item => item.milestone === 6); assert.ok(second);
  const secondOpened = await h.request('/api/companion/chests/' + second.id + '/open', a, { body: {} }); assert.equal(secondOpened.status, 200); assert.deepEqual(secondOpened.data.inventory, ['leaf', 'cap']);
});

test('two-person challenges expose only participation days, reject a third person and invalidate on leave or expiry', async t => {
  const h = await harness(t), a = await h.register(), b = await h.register(), c = await h.register();
  const create = await h.request('/api/companion/challenges', a, { body: { action: 'create' } }); assert.equal(create.status, 200); assert.ok(create.data.challenge);
  const { code, id } = create.data.challenge; assert.match(code, /^[A-F0-9]{16}$/);
  const joined = await h.request('/api/companion/challenges', b, { body: { action: 'join', code: code.toLowerCase() } }); assert.equal(joined.status, 200);
  await h.rest(a); await h.save(a, upsert('meals', meal(h.today()))); await h.rest(b);
  for (const account of [a, b]) {
    const view = (await h.snapshot(account)).challenge; assert.ok(view); assert.equal(view.id, id);
    assert.deepEqual(view.participants.map(item => item.days), [1, 1]);
    assert.equal(view.participants.filter(item => item.self).length, 1);
    for (const participant of view.participants) assert.deepEqual(Object.keys(participant).sort(), ['days', 'self']);
    const json = JSON.stringify(view);
    for (const privateValue of [a.user.email, b.user.email, a.user.id, b.user.id, 'Synthetic companion meal', 'kcal', 'duration']) assert.ok(!json.includes(privateValue));
  }
  assert.equal((await h.request('/api/companion/challenges', c, { body: { action: 'join', code } })).status, 404);
  assert.equal((await h.request('/api/companion/challenges', b, { body: { action: 'leave' } })).status, 200);
  assert.equal((await h.snapshot(a)).challenge, null); assert.equal((await h.snapshot(b)).challenge, null);
  assert.equal((await h.request('/api/companion/challenges', c, { body: { action: 'join', code } })).status, 404);
  const next = await h.request('/api/companion/challenges', a, { body: { action: 'create' } }); assert.equal(next.status, 200); assert.ok(next.data.challenge); assert.notEqual(next.data.challenge.code, code);
  h.setTime('2026-10-27T12:00:00Z');
  assert.equal((await h.snapshot(a)).challenge, null);
  assert.equal((await h.request('/api/companion/challenges', c, { body: { action: 'join', code: next.data.challenge.code } })).status, 404);
  assert.equal((await h.request('/api/companion/challenges', a, { body: { action: 'create' } })).status, 200);
});

test('challenge consent excludes pre-join rewards and invalid-code limits are scoped to the requesting account', async t => {
  const h = await harness(t), a = await h.register(), b = await h.register(), c = await h.register();
  await h.rest(b);
  const created = await h.request('/api/companion/challenges', a, { body: { action: 'create' } }); assert.ok(created.data.challenge);
  const joined = await h.request('/api/companion/challenges', b, { body: { action: 'join', code: created.data.challenge.code } });
  assert.equal(joined.status, 200); assert.ok(joined.data.challenge);
  assert.equal(joined.data.challenge.participants.find(item => item.self)?.days, 0, 'a participant shares no activity from before consenting');
  await h.save(b, upsert('meals', meal(h.today())));
  assert.equal((await h.snapshot(b)).challenge?.participants.find(item => item.self)?.days, 1);
  const invalid = '0000000000000000';
  for (let i = 0; i < 20; i++) {
    const result = await h.request<{ code: string }>('/api/companion/challenges', c, { body: { action: 'join', code: invalid } });
    assert.equal(result.status, 404); assert.equal(result.data.code, 'CHALLENGE_UNAVAILABLE');
  }
  const limited = await h.request('/api/companion/challenges', c, { body: { action: 'join', code: invalid } });
  assert.equal(limited.status, 429); assert.ok(Number(limited.response.headers.get('retry-after')) > 0);
  assert.equal((await h.request('/api/companion/challenges', b, { body: { action: 'leave' } })).status, 200, 'another account can always leave despite a different account guessing codes');
  assert.equal((await h.snapshot(a)).challenge, null);
});

test('companion export is owner scoped and account deletion removes its ledger and invalidates the shared challenge', async t => {
  const h = await harness(t), a = await h.register(), b = await h.register();
  await h.save(a, upsert('meals', meal(h.today()))); await h.rest(a);
  const created = await h.request('/api/companion/challenges', a, { body: { action: 'create' } }); assert.ok(created.data.challenge);
  await h.request('/api/companion/challenges', b, { body: { action: 'join', code: created.data.challenge.code } });
  const exported = await h.request<{ companion: { xp: number; rewards: unknown[]; challenges: { days: number }[] }; user: User }>('/api/export', a);
  assert.equal(exported.status, 200); assert.equal(exported.data.user.id, a.user.id);
  assert.equal(exported.data.companion.xp, 20); assert.equal(exported.data.companion.rewards.length, 2); assert.equal(exported.data.companion.challenges.length, 1);
  assert.ok(!JSON.stringify(exported.data).includes(b.user.email)); assert.ok(!JSON.stringify(exported.data.companion).includes(b.user.id));
  assert.equal((await h.request('/api/account', a, { method: 'DELETE', body: { password: PASSWORD } })).status, 200);
  assert.equal((await h.request('/api/companion', a)).status, 401); assert.equal((await h.snapshot(b)).challenge, null); assert.equal((await h.snapshot(b)).xp, 0);
  const tables = h.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'companion_%'").all() as { name: string }[];
  assert.ok(tables.length >= 4);
  for (const { name } of tables) {
    const columns = h.store.db.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[];
    for (const ownerColumn of ['owner_id', 'user_id', 'creator_id'].filter(column => columns.some(item => item.name === column))) {
      const row = h.store.db.prepare(`SELECT COUNT(*) AS n FROM ${name} WHERE ${ownerColumn}=?`).get(a.user.id) as { n: number };
      assert.equal(row.n, 0, 'deleted synthetic owner must have no companion rows');
    }
  }
});
