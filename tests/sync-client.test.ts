import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app';
import { SyncEngine } from '../src/sync/engine';
import { readCached, readLastCached, writeCached } from '../src/sync/storage';
import { setAccountHint, ApiError } from '../src/api';
import { emptyState, type SyncSnapshot, type User, type Workout, type SyncMutation } from '../src/types';

const ORIGIN = 'http://127.0.0.1:5173', PASSWORD = 'QA disposable fixture password 2026';
const savedWorkout = (name = 'QA strength'): Workout => ({ id: randomUUID(), date: '2026-10-14', name, duration: 30, rpe: null, exercises: [{ name: 'QA custom row', sets: 1, reps: 8, weight: 40 }], notes: '', createdAt: '2026-10-14T12:00:00Z' });
const deferred = <T,>() => { let resolve!: (value: T | PromiseLike<T>) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };

/** Test-only IDB transport: serial atomic transactions, public request callbacks, no production function mocks. */
function memoryIdb() {
  const stores = new Map<string, Map<string, unknown>>();
  let created = false, chain: Promise<void> = Promise.resolve(), failWrites = 0;
  const factory = {
    open() {
      const request: any = {};
      const db = {
        close() {},
        createObjectStore(name: string) { if (!stores.has(name)) stores.set(name, new Map()); },
        transaction(names: string | string[], mode: string) {
          const list = typeof names === 'string' ? [names] : names;
          const operations: Array<() => void> = [];
          const tx: any = {};
          let aborted = false;
          tx.abort = () => { aborted = true; };
          let working: Map<string, Map<string, unknown>>;
          tx.objectStore = (name: string) => {
            assert.ok(list.includes(name));
            const schedule = (operation: () => unknown) => {
              const req: any = {};
              operations.push(() => { req.result = structuredClone(operation()); req.onsuccess?.({ target: req }); });
              return req;
            };
            return {
              get(key: string) { return schedule(() => working.get(name)!.get(key)); },
              put(value: any, explicitKey?: string) { return schedule(() => { const key = explicitKey ?? value.user.id; working.get(name)!.set(key, structuredClone(value)); return key; }); },
              delete(key: string) { return schedule(() => { working.get(name)!.delete(key); }); },
            };
          };
          const execute = () => new Promise<void>(done => {
            working = new Map([...stores].map(([name, values]) => [name, new Map([...values].map(([key, value]) => [key, structuredClone(value)]))]));
            const step = () => queueMicrotask(() => {
              if (aborted) { tx.onabort?.(); done(); return; }
              if (mode === 'readwrite' && failWrites) { failWrites--; tx.onerror?.(); done(); return; }
              const operation = operations.shift();
              if (operation) { operation(); step(); return; }
              if (mode === 'readwrite') for (const name of list) stores.set(name, working.get(name)!);
              tx.oncomplete?.(); done();
            });
            step();
          });
          chain = chain.then(execute); return tx;
        },
      };
      request.result = db;
      queueMicrotask(() => { if (!created) { created = true; request.onupgradeneeded?.(); } request.onsuccess?.(); });
      return request;
    },
  };
  return { factory: factory as unknown as IDBFactory, failNextWrite: () => { failWrites++; } };
}

async function harness(t: TestContext) {
  const nativeFetch = globalThis.fetch;
  const previous = new Map(['fetch', 'localStorage', 'navigator', 'indexedDB'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const storage = new Map<string, string>([['forma-language', 'en']]), browser = { onLine: true }, idb = memoryIdb();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, String(value)), removeItem: (key: string) => storage.delete(key) } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: idb.factory });
  const directory = mkdtempSync(join(tmpdir(), 'forma-client-sync-qa-'));
  const service = createApp({ dataDir: directory, secureCookies: false, ai: {} });
  const server = service.app.listen(0, '127.0.0.1');
  await new Promise<void>(done => server.once('listening', done));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  interface Account { user: User; cookie: string }
  let active: Account | null = null;
  const engines: SyncEngine[] = [], calls: Array<{ path: string; method: string; account: string | null; body?: SyncMutation }> = [];
  let gateMe: { seen: ReturnType<typeof deferred<void>>; release: ReturnType<typeof deferred<void>> } | null = null;
  let loseResponse = false;
  let hangMe = false;
  const direct = async (account: Account | null, path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => {
    const response = await nativeFetch(base + '/api' + path, { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(account ? { Cookie: account.cookie, 'X-Forma-Account': account.user.id } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const json = await response.clone().json(); return { response, body: json };
  };
  globalThis.fetch = async (input, init) => {
    const path = String(input), method = init?.method ?? 'GET', headers = new Headers(init?.headers);
    calls.push({ path, method, account: headers.get('X-Forma-Account'), ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    if (path === '/api/auth/me' && hangMe) {
      hangMe = false;
      return await new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted) reject(init.signal.reason);
        else init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    }
    headers.set('Origin', ORIGIN); if (active) headers.set('Cookie', active.cookie);
    const response = await nativeFetch(base + path, { ...init, headers });
    if (path === '/api/auth/me' && gateMe) { const gate = gateMe; gateMe = null; gate.seen.resolve(); await gate.release.promise; }
    if (path === '/api/sync' && method === 'POST' && loseResponse) { loseResponse = false; throw new TypeError('QA simulated lost response after server commit'); }
    return response;
  };
  t.after(async () => {
    for (const engine of engines) await engine.stop();
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())); service.close();
    for (const [name, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
    setAccountHint(null);
    const target = resolve(directory); assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-client-sync-qa-'));
    rmSync(target, { recursive: true, force: true });
  });
  const register = async (): Promise<Account> => {
    const result = await direct(null, '/auth/register', { email: `qa-${randomUUID()}@example.test`, password: PASSWORD, name: 'QA fixture' });
    assert.equal(result.response.status, 201); const cookie = result.response.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
    return { user: result.body.user, cookie };
  };
  const choose = (account: Account) => { active = account; setAccountHint(account.user.id); };
  const engine = async (account: Account, snapshot?: SyncSnapshot) => {
    const initial = snapshot ?? (await direct(account, '/sync')).body;
    const value = new SyncEngine(account.user, initial, () => {}); engines.push(value); await value.restore(); return value;
  };
  return { register, choose, engine, direct, browser, idb, calls, loseNextPostResponse: () => { loseResponse = true; }, hangNextMe: () => { hangMe = true; }, gateNextMe: () => { const gate = { seen: deferred<void>(), release: deferred<void>() }; gateMe = gate; return gate; } };
}

test('render-time baseline captures only the local edit and preserves a newer remote record', async t => {
  const h = await harness(t), account = await h.register(); h.choose(account);
  const first = savedWorkout('First');
  await h.direct(account, '/sync', { mutationId: randomUUID(), changes: [{ collection: 'workouts', id: first.id, baseVersion: 0, kind: 'upsert', value: first }] });
  const client = await h.engine(account), renderContext = client.context(), remote = savedWorkout('Remote addition');
  await h.direct(account, '/sync', { mutationId: randomUUID(), changes: [{ collection: 'workouts', id: remote.id, baseVersion: 0, kind: 'upsert', value: remote }] });
  await client.refresh();
  await client.save({ ...renderContext.state, workouts: [{ ...first, duration: 45 }] }, renderContext);
  const result = await h.direct(account, '/sync'); assert.equal(result.body.state.workouts.length, 2);
  assert.equal(result.body.state.workouts.find((workout: Workout) => workout.id === remote.id).name, 'Remote addition');
  const post = h.calls.find(call => call.method === 'POST')!;
  assert.equal(post.body!.changes.length, 1); assert.equal(post.body!.changes[0].id, first.id); assert.equal(post.body!.changes[0].baseVersion, 1);
});

test('a lost committed response keeps the same mutation ID and replays exactly once', async t => {
  const h = await harness(t), account = await h.register(); h.choose(account);
  const client = await h.engine(account), workout = savedWorkout(); h.loseNextPostResponse();
  await assert.rejects(client.save({ ...emptyState(), workouts: [workout] }), /lost response/);
  assert.equal(client.status.pending, 1);
  const applied = (await h.direct(account, '/sync')).body; assert.equal(applied.revision, 1);
  await client.flush();
  const requests = h.calls.filter(call => call.method === 'POST'); assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].body, requests[1].body); assert.equal(client.status.pending, 0);
  const result = (await h.direct(account, '/sync')).body; assert.equal(result.revision, 1); assert.equal(result.state.workouts.length, 1);
});

test('account switch during delayed verification never rebinds the original queue to the next account', async t => {
  const h = await harness(t), first = await h.register(), second = await h.register(); h.choose(first);
  const client = await h.engine(first), gate = h.gateNextMe();
  const save = client.save({ ...emptyState(), workouts: [savedWorkout('Private account A fact')] });
  await gate.seen.promise; h.choose(second); gate.release.resolve();
  await assert.rejects(save, error => error instanceof ApiError && [401, 403].includes(error.status));
  const post = h.calls.find(call => call.method === 'POST')!; assert.equal(post.account, first.user.id);
  assert.equal((await h.direct(second, '/sync')).body.state.workouts.length, 0);
  assert.equal(client.status.pending, 1); assert.equal(client.status.authRequired, true);
  h.choose(first); await client.flush(); assert.equal((await h.direct(first, '/sync')).body.state.workouts.length, 1);
});

test('offline queue persists, merges two same-account tabs, and settled receipts prevent stale resurrection', async t => {
  const h = await harness(t), account = await h.register(); h.choose(account);
  const baseline: SyncSnapshot = (await h.direct(account, '/sync')).body;
  const tabA = await h.engine(account, baseline), tabB = await h.engine(account, baseline);
  await tabA.enable(true); await tabB.enable(true); h.browser.onLine = false;
  const first = savedWorkout('Tab A'), second = savedWorkout('Tab B');
  await Promise.all([tabA.save({ ...baseline.state, workouts: [first] }), tabB.save({ ...baseline.state, workouts: [second] })]);
  const cached = await readCached(account.user.id); assert.ok(cached); assert.equal(cached.queue.length, 2);
  const stale = structuredClone(cached);
  await tabA.reconcileCache(); assert.equal(tabA.exportPending().state.workouts.length, 2);
  h.browser.onLine = true; await tabA.flush(); assert.equal(tabA.status.pending, 0);
  const committed = (await h.direct(account, '/sync')).body; assert.equal(committed.state.workouts.length, 2); assert.equal(committed.revision, 2);
  await writeCached(stale); // A sleeping tab writes the old queue after acknowledgements.
  const after = await readCached(account.user.id); assert.ok(after); assert.equal(after.queue.length, 0); assert.equal(after.snapshot.revision, 2);
  await tabB.reconcileCache(); assert.equal(tabB.status.pending, 0); assert.equal(tabB.context().state.workouts.length, 2);
});

test('two tabs reconnecting together retain both records with one durable mutation per change', async t => {
  const h = await harness(t), account = await h.register(); h.choose(account);
  const baseline = (await h.direct(account, '/sync')).body;
  const first = await h.engine(account, baseline), second = await h.engine(account, baseline);
  await first.enable(true); await second.enable(true); h.browser.onLine = false;
  await Promise.all([first.save({ ...emptyState(), workouts: [savedWorkout('Parallel first')] }), second.save({ ...emptyState(), workouts: [savedWorkout('Parallel second')] })]);
  await first.reconcileCache(); await second.reconcileCache(); h.browser.onLine = true;
  await Promise.all([first.flush(), second.flush()]);
  const actual = (await h.direct(account, '/sync')).body;
  assert.equal(actual.revision, 2); assert.equal(actual.state.workouts.length, 2);
  assert.equal(new Set(h.calls.filter(call => call.method === 'POST').map(call => call.body!.mutationId)).size, 2);
  assert.equal((await readCached(account.user.id))!.queue.length, 0); assert.equal(first.status.pending, 0); assert.equal(second.status.pending, 0);
});

test('restore and reauthentication retain pending records, explicit stop clears only its account', async t => {
  const h = await harness(t), first = await h.register(), second = await h.register(); h.choose(first);
  const client = await h.engine(first); await client.enable(true); h.browser.onLine = false;
  await client.save({ ...emptyState(), workouts: [savedWorkout('Pending A')] });
  await client.stop(); const restored = await h.engine(first); assert.equal(restored.status.pending, 1);
  const secondEngine = await h.engine(second); await secondEngine.enable(true);
  h.browser.onLine = true; h.choose(second);
  await assert.rejects(restored.flush(), error => error instanceof ApiError && error.status === 401);
  assert.equal(restored.status.pending, 1); assert.equal((await readCached(first.user.id))!.queue.length, 1);
  h.choose(first); await restored.flush(); assert.equal(restored.status.pending, 0);
  await restored.stop(true); assert.equal(await readCached(first.user.id), undefined); assert.ok(await readCached(second.user.id));
  // Regranting B makes its pointer current; subsequently clearing A cannot remove it.
  await secondEngine.enable(true); await restored.stop(true);
  assert.equal((await readLastCached())!.user.id, second.user.id);
});

test('conflict review rebases the reviewed entity but a later queued entity still requires its own review', async t => {
  const h = await harness(t), account = await h.register(); h.choose(account);
  const first = savedWorkout('One'), second = savedWorkout('Two');
  await h.direct(account, '/sync', { mutationId: randomUUID(), changes: [first, second].map(value => ({ collection: 'workouts', id: value.id, baseVersion: 0, kind: 'upsert', value })) });
  const client = await h.engine(account); await client.enable(true); h.browser.onLine = false;
  let context = client.context(); await client.save({ ...context.state, workouts: context.state.workouts.map(workout => workout.id === first.id ? { ...workout, duration: 45 } : workout) }, context);
  context = client.context(); await client.save({ ...context.state, workouts: context.state.workouts.map(workout => workout.id === second.id ? { ...workout, duration: 60 } : workout) }, context);
  await h.direct(account, '/sync', { mutationId: randomUUID(), changes: [first, second].map(value => ({ collection: 'workouts', id: value.id, baseVersion: 1, kind: 'upsert', value: { ...value, duration: 90 } })) });
  h.browser.onLine = true; await assert.rejects(client.flush(), /changed|变化/);
  assert.deepEqual(client.status.conflict!.keys, [`workouts:${first.id}`]);
  const unreviewedId = (await readCached(account.user.id))!.queue.find(batch => batch.changes.some(change => change.id === second.id))!.mutationId;
  await assert.rejects(client.resolve(true), /changed|变化/);
  assert.deepEqual(client.status.conflict!.keys, [`workouts:${second.id}`]);
  assert.equal(h.calls.filter(call => call.method === 'POST').at(-1)!.body!.mutationId, unreviewedId, 'an unreviewed queued write keeps its original idempotency identity');
  const actual = (await h.direct(account, '/sync')).body.state.workouts;
  assert.equal(actual.find((workout: Workout) => workout.id === first.id).duration, 45, JSON.stringify(h.calls.filter(call => call.method === 'POST').map(call => call.body))); assert.equal(actual.find((workout: Workout) => workout.id === second.id).duration, 90);
  await client.resolve(false); assert.equal(client.status.pending, 0); assert.equal(client.context().state.workouts.find(workout => workout.id === second.id)!.duration, 90);
});

test('failed conflict persistence preserves a reviewable queue and succeeds when storage is available again', async t => {
  const h = await harness(t), account = await h.register(); h.choose(account);
  const workout = savedWorkout();
  await h.direct(account, '/sync', { mutationId: randomUUID(), changes: [{ collection: 'workouts', id: workout.id, baseVersion: 0, kind: 'upsert', value: workout }] });
  const client = await h.engine(account); await client.enable(true); h.browser.onLine = false;
  await client.save({ ...client.context().state, workouts: [{ ...workout, duration: 45 }] });
  await h.direct(account, '/sync', { mutationId: randomUUID(), changes: [{ collection: 'workouts', id: workout.id, baseVersion: 1, kind: 'upsert', value: { ...workout, duration: 90 } }] });
  h.browser.onLine = true; await assert.rejects(client.flush()); const cached = await readCached(account.user.id);
  h.idb.failNextWrite(); await assert.rejects(client.resolve(true), /storage failed/);
  assert.ok(client.status.conflict); assert.equal(client.status.pending, 1); assert.deepEqual((await readCached(account.user.id))!.queue, cached!.queue);
  await client.resolve(true); assert.equal(client.status.pending, 0); assert.equal((await h.direct(account, '/sync')).body.state.workouts[0].duration, 45);
});

test('failed queued write is not acknowledged and a later offline save can be restored and synced', async t => {
  const h = await harness(t), account = await h.register(); h.choose(account);
  const client = await h.engine(account); await client.enable(true); h.browser.onLine = false;
  h.idb.failNextWrite(); await assert.rejects(client.save({ ...emptyState(), workouts: [savedWorkout('failed')] }), /storage failed/);
  assert.equal(client.status.pending, 0); assert.equal((await readCached(account.user.id))!.queue.length, 0);
  await client.save({ ...emptyState(), workouts: [savedWorkout('succeeded')] }); assert.equal(client.status.pending, 1);
  h.browser.onLine = true; await client.flush(); assert.equal((await h.direct(account, '/sync')).body.state.workouts[0].name, 'succeeded');
});

test('a stale tab cannot disable shared offline storage while another tab has pending records', async t => {
  const h = await harness(t), account = await h.register(); h.choose(account);
  const baseline = (await h.direct(account, '/sync')).body;
  const first = await h.engine(account, baseline), stale = await h.engine(account, baseline);
  await first.enable(true); await stale.enable(true); h.browser.onLine = false;
  await first.save({ ...emptyState(), workouts: [savedWorkout('Must remain pending')] });
  assert.equal(stale.status.pending, 0);
  await assert.rejects(stale.enable(false), /pending|sync|offline/i);
  const cached = await readCached(account.user.id); assert.ok(cached); assert.equal(cached.queue.length, 1);
  assert.equal(localStorage.getItem(`forma-offline-${account.user.id}`), 'enabled');
});

test('clearing an account invalidates a sleeping tab so it cannot recreate private offline data', async t => {
  const h = await harness(t), account = await h.register(); h.choose(account);
  const baseline = (await h.direct(account, '/sync')).body;
  const first = await h.engine(account, baseline), stale = await h.engine(account, baseline);
  await first.enable(true); await stale.enable(true); await first.stop(true); h.browser.onLine = false;
  await assert.rejects(stale.save({ ...emptyState(), workouts: [savedWorkout('After logout')] }), /offline|account|storage|changed|disabled/i);
  assert.equal(await readCached(account.user.id), undefined);
});

test('a hanging request times out, releases busy state and keeps the offline record for a later reconnect', async t => {
  const h = await harness(t), account = await h.register(); h.choose(account);
  const client = await h.engine(account); await client.enable(true);
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout')!, nativeTimeout = AbortSignal.timeout, timeouts: number[] = [];
  Object.defineProperty(AbortSignal, 'timeout', { ...descriptor, value: (milliseconds: number) => { timeouts.push(milliseconds); return nativeTimeout(Math.min(milliseconds, 25)); } });
  t.after(() => Object.defineProperty(AbortSignal, 'timeout', descriptor));
  h.hangNextMe();
  await client.save({ ...emptyState(), workouts: [savedWorkout('Retained after timeout')] });
  assert.deepEqual(timeouts, [15000]); assert.equal(client.status.busy, false); assert.equal(client.status.pending, 1);
  assert.equal((await readCached(account.user.id))!.queue.length, 1); assert.equal((await h.direct(account, '/sync')).body.state.workouts.length, 0);
  Object.defineProperty(AbortSignal, 'timeout', descriptor);
  await client.flush(); assert.equal(client.status.pending, 0); assert.equal((await h.direct(account, '/sync')).body.state.workouts[0].name, 'Retained after timeout');
});

test('shared local persistence rejects a changed payload under an existing pending mutation ID atomically', async t => {
  const h = await harness(t), account = await h.register(); h.choose(account);
  const client = await h.engine(account); await client.enable(true); h.browser.onLine = false;
  await client.save({ ...emptyState(), workouts: [savedWorkout('Original queued value')] });
  const before = (await readCached(account.user.id))!, altered = structuredClone(before);
  const change = altered.queue[0].changes[0]; change.value = { ...(change.value as Workout), name: 'Unauthorized replacement under same identity' };
  await assert.rejects(writeCached(altered), /mutation changed|identifier/);
  assert.deepEqual((await readCached(account.user.id))!.queue, before.queue);
  h.browser.onLine = true; await client.flush(); assert.equal((await h.direct(account, '/sync')).body.state.workouts[0].name, 'Original queued value');
});
