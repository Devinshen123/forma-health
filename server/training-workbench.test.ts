import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createApp } from './app';
import { parseWorkbenchWrite, WORKBENCH_MEDIA_QUOTA } from './training-workbench-data';
import { projectWorkbenchWorkouts } from './training-workbench-projection';
import { Store } from './store';
import sharp from 'sharp';

const ORIGIN = 'http://127.0.0.1:5173';
const PASSWORD = 'workbench synthetic password';
const SALT = 'workbench-test-salt';
const PASSWORD_HASH = scryptSync(PASSWORD, SALT, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
const PNG = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#000000' } }).png().toBuffer();
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const blank = () => ({ unit: 'kg', routines: [], workouts: [], customEx: [], bodyweight: [], measurements: [] });
const workout = (id = 'workbench-logged') => ({ id, d: '2026-10-18', name: 'Synthetic training', start: 1792310400000, end: 1792312200000, entries: [{ id: '0001', target: { mode: 'reps' }, sets: [{ done: true, w: 20, r: 8 }] }] });

async function harness(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-workbench-test-'));
  const service = createApp({ dataDir: directory, secureCookies: false, ai: {} });
  const server = service.app.listen(0, '127.0.0.1');
  await new Promise<void>(ready => server.once('listening', ready));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const users = ['a', 'b'].map(label => {
    const user = service.store.createAccount(`${label}@workbench.test`, label, PASSWORD_HASH, SALT);
    const token = randomBytes(32).toString('hex');
    service.store.createSession(user.id, token, Date.now() + 3600000);
    return { ...user, cookie: `forma_session=${token}` };
  });
  t.after(async () => {
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    service.close();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.includes('forma-workbench-test-'));
    rmSync(directory, { recursive: true, force: true });
  });
  const request = (path: string, options: { user?: number | null; method?: string; body?: unknown; raw?: Buffer | string; mime?: string; origin?: string | null; account?: string | null; headers?: Record<string, string>; prefix?: string } = {}) => {
    const user = options.user === null ? undefined : users[options.user ?? 0];
    const headers: Record<string, string> = { 'Content-Type': options.mime ?? 'application/json', ...options.headers };
    if (options.origin !== null) headers.Origin = options.origin ?? ORIGIN;
    if (user) headers.Cookie = user.cookie;
    if (options.account !== null && (options.account ?? user?.id)) headers['X-Forma-Account'] = options.account ?? user!.id;
    return fetch(`${base}${options.prefix ?? '/training-workbench/api'}${path}`, { method: options.method ?? 'GET', headers, ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : options.raw !== undefined ? { body: options.raw as unknown as BodyInit } : {}) });
  };
  return { ...service, directory, users, request };
}

test('workbench binds every private operation to the existing session and expected account', async t => {
  const h = await harness(t);
  for (const path of ['/me', '/config', '/data', '/data/rev', '/export', `/media/${hash(PNG)}`]) {
    assert.equal((await h.request(path, { user: null })).status, 401);
    assert.equal((await h.request(path, { account: null })).status, 401);
    assert.equal((await h.request(path, { user: 1, account: h.users[0].id })).status, 401);
  }
  const me = await (await h.request('/me')).json();
  assert.deepEqual(me.user, { id: h.users[0].id, name: 'a', admin: false });
  const config = await (await h.request('/config')).json();
  assert.equal(config.allow_guest, false); assert.equal(config.password_login, false); assert.equal(config.coach, null); assert.equal(config.media.workouts, true);
  assert.equal((await h.request('/login', { method: 'POST', body: {} })).status, 404);
  assert.equal((await h.request('/data', { method: 'PUT', user: 1, account: h.users[0].id, body: { state: blank() } })).status, 401);
  assert.equal((await h.request(`/media/${hash(PNG)}`, { method: 'PUT', user: 1, account: h.users[0].id, mime: 'image/png', raw: PNG })).status, 401);
  assert.equal(h.store.workbenchSnapshot(h.users[1].id).rev, 0);
});

test('workbench guards request Origin, JSON content type, prototype keys, depth and size', async t => {
  const h = await harness(t);
  for (const origin of [null, 'https://malicious.test']) assert.equal((await h.request('/data', { method: 'PUT', origin, body: { state: blank() } })).status, 403);
  assert.equal((await h.request('/data', { origin: 'https://malicious.test' })).status, 403);
  assert.equal((await h.request('/data', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await h.request('/data', { method: 'PUT', mime: 'text/plain', raw: '{}' })).status, 415);
  assert.equal((await h.request('/data', { method: 'PUT', raw: '{"state":{"__proto__":{"polluted":true}}}' })).status, 400);
  assert.equal((await h.request('/data', { method: 'PUT', body: { state: blank(), user_id: h.users[1].id } })).status, 400);
  let deep: unknown = {}; for (let i = 0; i < 25; i++) deep = { nested: deep };
  assert.equal((await h.request('/data', { method: 'PUT', body: { state: { deep } } })).status, 413);
  assert.equal((await h.request('/data', { method: 'PUT', body: { state: { records: new Array(10001).fill(null) } } })).status, 413);
  assert.equal((await h.request('/data', { method: 'PUT', body: { state: { note: 'x'.repeat(65537) } } })).status, 400);
  assert.equal((await h.request('/data', { method: 'PUT', raw: JSON.stringify({ state: { notes: Array(150).fill('x'.repeat(64000)) } }) })).status, 413);
  assert.equal(h.store.workbenchSnapshot(h.users[0].id).rev, 0);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test('workbench CAS is account isolated, replay safe and keeps append-only lineage', async t => {
  const h = await harness(t);
  const write = { state: { ...blank(), routines: [{ id: 'r1', name: 'First plan' }], lang: 'zh', _rev: 99, _wid: 'bad-client-wid', _wids: ['bad-client-wid'], active: { private: 'device-only' }, _ts: 123 }, baseRev: 0, stamped: true };
  const saved = await h.request('/data', { method: 'PUT', body: write }); assert.equal(saved.status, 200);
  const first = await saved.json(); assert.equal(first.rev, 1); assert.match(first.wid, /^[a-f0-9]{16}$/);
  assert.deepEqual(await (await h.request('/data', { method: 'PUT', body: write })).json(), first);
  const a = await (await h.request('/data')).json();
  assert.equal(a.state._rev, 1); assert.equal(a.state._wid, first.wid); assert.deepEqual(a.state._wids, []); assert.equal(a.state.active, undefined);
  assert.deepEqual(await (await h.request('/data', { user: 1 })).json(), { state: null, rev: 0, warnings: [] });
  const stale = await h.request('/data', { method: 'PUT', body: { state: { ...blank(), lang: 'en' }, baseRev: 0 } });
  assert.equal(stale.status, 409); assert.equal((await stale.json()).state.lang, 'zh');
  assert.equal((await h.request('/data', { method: 'PUT', body: { state: blank(), baseRev: 1, baseWid: '0000000000000000' } })).status, 409);
  assert.equal((await h.request('/data', { method: 'PUT', body: { state: blank() } })).status, 409);
  const second = await (await h.request('/data', { method: 'PUT', body: { state: { ...blank(), lang: 'en' }, baseRev: 1, baseWid: first.wid } })).json();
  assert.equal(second.rev, 2);
  assert.deepEqual((await (await h.request('/data')).json()).state._wids, [first.wid]);
  assert.deepEqual(await (await h.request('/data/rev')).json(), { rev: 2, wid: second.wid });
  const history = h.store.exportWorkbench(h.users[0].id).revisions;
  assert.equal(history.length, 2); assert.deepEqual(history[0].state.routines, [{ id: 'r1', name: 'First plan' }]); assert.deepEqual(history[1].state.routines, []); assert.equal(history[0].state.lang, undefined);
  assert.throws(() => h.store.db.prepare('UPDATE workbench_revisions SET wid=? WHERE owner_id=?').run('x', h.users[0].id));
});

test('workbench projection commits atomically, preserves native history, and publishes sync versions', async t => {
  const h = await harness(t), owner = h.users[0].id;
  const raw = { ...blank(), workouts: [workout()] };
  const projected = projectWorkbenchWorkouts(raw, owner); assert.equal(projected.workouts.length, 1);
  const native = { ...projected.workouts[0], id: randomUUID(), name: 'Native existing training', importFingerprint: undefined };
  const initial = h.store.snapshot(owner); h.store.save(owner, { ...initial.state, workouts: [native] }, initial.revision);
  const saved = await h.request('/data', { method: 'PUT', body: { state: raw, baseRev: 0 } }); assert.equal(saved.status, 200);
  const snapshot = h.store.syncSnapshot(owner); assert.equal(snapshot.state.workouts.length, 2);
  assert.deepEqual(snapshot.state.workouts[0], JSON.parse(JSON.stringify(native)));
  assert.equal(snapshot.state.workouts[1].exercises[0].setLogs![0].weight, 20);
  assert.ok(snapshot.entityVersions[`workouts:${projected.workouts[0].id}`] > 0);
  const rev = (await saved.json()).rev;
  // Forma's schema parsing can reorder exercise properties. That is not a conflicting edit.
  const reordered = structuredClone(snapshot.state);
  reordered.workouts[1].exercises[0] = Object.fromEntries(Object.entries(reordered.workouts[1].exercises[0]).reverse()) as typeof reordered.workouts[1]['exercises'][number];
  assert.equal(h.store.save(owner, reordered, snapshot.revision), true);
  const sameFacts = await h.request('/data', { method: 'PUT', body: { state: { ...raw, lang: 'zh' }, baseRev: rev } });
  assert.equal(sameFacts.status, 200);
  const nextRev = (await sameFacts.json()).rev;
  const beforeMalformedRevision = h.store.snapshot(owner).revision;
  const malformed = { ...raw, workouts: [{ ...workout(), entries: 'not entries' }] };
  assert.equal((await h.request('/data', { method: 'PUT', body: { state: malformed, baseRev: nextRev } })).status, 400);
  assert.equal(h.store.workbenchSnapshot(owner).rev, nextRev); assert.equal(h.store.snapshot(owner).revision, beforeMalformedRevision);
  const removed = await h.request('/data', { method: 'PUT', body: { state: blank(), baseRev: nextRev } }); assert.equal(removed.status, 200);
  assert.deepEqual(h.store.snapshot(owner).state.workouts, [JSON.parse(JSON.stringify(native))]);
});

test('workbench keeps unsupported raw facts with warnings, without inventing completed training', async t => {
  const h = await harness(t);
  const raw = { ...blank(), workouts: [{ ...workout('unknown-duration'), start: undefined, end: undefined }] };
  const response = await h.request('/data', { method: 'PUT', body: { state: raw, baseRev: 0 } }); assert.equal(response.status, 200);
  const receipt = await response.json(); assert.equal(receipt.warnings.length, 1); assert.equal(receipt.warnings[0].code, 'missing_duration');
  const snapshot = await (await h.request('/data')).json(); assert.equal(snapshot.state.workouts.length, 1); assert.deepEqual(snapshot.warnings, receipt.warnings);
  assert.deepEqual(h.store.snapshot(h.users[0].id).state.workouts, []);
});

test('workbench media verifies bytes, type, limits and isolates hash addresses by account', async t => {
  const h = await harness(t), address = hash(PNG);
  assert.equal((await h.request(`/media/${address}`, { method: 'PUT', mime: 'image/svg+xml', raw: '<svg/>' })).status, 415);
  assert.equal((await h.request(`/media/${address}`, { method: 'PUT', mime: 'image/png', raw: Buffer.from('not png') })).status, 400);
  assert.equal((await h.request(`/media/${'0'.repeat(64)}`, { method: 'PUT', mime: 'image/png', raw: PNG })).status, 400);
  assert.equal((await h.request(`/media/${address}`, { method: 'PUT', mime: 'image/png', raw: Buffer.alloc(2 * 1024 * 1024 + 1) })).status, 413);
  const first = await h.request(`/media/${address}`, { method: 'PUT', mime: 'image/png', raw: PNG }); assert.equal(first.status, 201);
  assert.equal((await first.json()).existed, false);
  const repeat = await h.request(`/media/${address}`, { method: 'PUT', mime: 'image/png', raw: PNG }); assert.equal(repeat.status, 200); assert.equal((await repeat.json()).existed, true);
  const full = await h.request(`/media/${address}`); assert.equal(full.headers.get('content-type'), 'image/png'); assert.equal(full.headers.get('cache-control'), 'no-store'); assert.deepEqual(Buffer.from(await full.arrayBuffer()), PNG);
  const range = await h.request(`/media/${address}`, { headers: { Range: 'bytes=0-7' } }); assert.equal(range.status, 206); assert.equal(range.headers.get('content-range'), `bytes 0-7/${PNG.length}`); assert.deepEqual(Buffer.from(await range.arrayBuffer()), PNG.subarray(0, 8));
  const suffix = await h.request(`/media/${address}`, { headers: { Range: 'bytes=-4' } }); assert.equal(suffix.status, 206); assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), PNG.subarray(-4));
  assert.equal((await h.request(`/media/${address}`, { headers: { Range: `bytes=${PNG.length}-` } })).status, 416);
  assert.equal((await h.request(`/media/${address}`, { user: 1 })).status, 404);
  // A pending reference cannot grant access to the same hash in another account's directory.
  const pending = { ...blank(), customEx: [{ id: 'pending', n: 'Pending upload', media: { kind: 'image', hash: address, mime: 'image/png', size: PNG.length, width: 1, height: 1 } }] };
  assert.equal((await h.request('/data', { method: 'PUT', user: 1, body: { state: pending, baseRev: 0 } })).status, 200);
  assert.equal((await h.request(`/media/${address}`, { user: 1 })).status, 404);
  const other = await (await h.request('/media/missing', { method: 'POST', user: 1, body: { hashes: [address] } })).json(); assert.deepEqual(other.missing, [address]); assert.equal(other.usage.bytes, 0);
  const own = await (await h.request('/media/missing', { method: 'POST', body: { hashes: [address, address] } })).json(); assert.deepEqual(own.missing, []); assert.equal(own.usage.bytes, PNG.length); assert.equal(own.usage.count, 1);
  assert.equal((await h.request('/media/missing', { method: 'POST', body: { hashes: ['../escape'] } })).status, 400);
  assert.equal((await h.request('/media/missing', { method: 'POST', body: { hashes: Array(1001).fill(address) } })).status, 400);
});

test('workbench quota and malformed media references cannot bypass account storage checks', async t => {
  const h = await harness(t), owner = h.users[0].id;
  h.store.db.prepare('INSERT INTO workbench_media VALUES (?,?,?,?,?)').run(owner, 'f'.repeat(64), 'video/mp4', WORKBENCH_MEDIA_QUOTA, new Date().toISOString());
  assert.equal((await h.request(`/media/${hash(PNG)}`, { method: 'PUT', mime: 'image/png', raw: PNG })).status, 413);
  const badRef = { kind: 'image', hash: '../not-hash', mime: 'image/png', size: 10, width: 1, height: 1 };
  assert.equal((await h.request('/data', { method: 'PUT', body: { state: { ...blank(), customEx: [{ id: 'custom', n: 'Custom', media: badRef }] }, baseRev: 0 } })).status, 400);
  assert.equal(h.store.workbenchSnapshot(owner).rev, 0);
  h.store.db.prepare('DELETE FROM workbench_media WHERE owner_id=?').run(owner);
});

test('workbench export includes raw revisions and private media; account deletion clears all rows and files', async t => {
  const h = await harness(t), owner = h.users[0].id, address = hash(PNG);
  await h.request(`/media/${address}`, { method: 'PUT', mime: 'image/png', raw: PNG });
  const raw = { ...blank(), customEx: [{ id: 'custom-photo', n: 'Synthetic custom exercise', media: { kind: 'image', hash: address, mime: 'image/png', size: PNG.length, width: 1, height: 1, at: 123 } }] };
  assert.equal((await h.request('/data', { method: 'PUT', body: { state: raw, baseRev: 0 } })).status, 200);
  const exported = await (await h.request('/export', { prefix: '/api' })).json();
  assert.equal(exported.trainingWorkbench.state.customEx[0].id, 'custom-photo'); assert.equal(exported.trainingWorkbench.revisions.length, 1);
  assert.equal(exported.trainingWorkbench.revisions[0].kind, 'planner'); assert.equal(exported.trainingWorkbench.revisions[0].state.customEx, undefined);
  assert.equal(exported.trainingWorkbench.media[0].base64, PNG.toString('base64'));
  const mediaPath = join(h.directory, 'workbench-media', owner, address); assert.deepEqual(readFileSync(mediaPath), PNG);
  assert.equal((await h.request('/media/sweep', { method: 'POST', body: {} })).status, 200); assert.ok(existsSync(mediaPath));
  assert.equal((await h.request('/account', { method: 'DELETE', prefix: '/api', body: { password: PASSWORD } })).status, 200);
  assert.equal(existsSync(join(h.directory, 'workbench-media', owner)), false);
  for (const table of ['workbench_states', 'workbench_revisions', 'workbench_receipts', 'workbench_projection_links', 'workbench_media']) assert.equal((h.store.db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE owner_id=?`).get(owner) as { count: number }).count, 0);
  assert.equal((await h.request('/data')).status, 401);
});

test('workbench rejects conflicting edits to a projected Forma record atomically', async t => {
  const h = await harness(t), owner = h.users[0].id, raw = { ...blank(), workouts: [workout()] };
  const first = await (await h.request('/data', { method: 'PUT', body: { state: raw, baseRev: 0 } })).json();
  const before = h.store.snapshot(owner), changed = structuredClone(before.state); changed.workouts[0].name = 'Edited in Forma';
  assert.equal(h.store.save(owner, changed, before.revision), true);
  const response = await h.request('/data', { method: 'PUT', body: { state: { ...raw, lang: 'en' }, baseRev: first.rev } });
  assert.equal(response.status, 409); assert.equal((await response.json()).code, 'projection-conflict');
  assert.equal(h.store.workbenchSnapshot(owner).rev, first.rev); assert.equal(h.store.snapshot(owner).state.workouts[0].name, 'Edited in Forma');
});

test('workbench parser rejects direct non-JSON inputs and unknown summaries remain null', () => {
  for (const value of [{ state: {} }, { state: { _ts: 123, _rev: 1 } }, { state: { bad: NaN } }, { state: { bad: Infinity } }, { state: { bad: new Date() } }, { state: { constructor: {} } }]) assert.throws(() => parseWorkbenchWrite(value));
});

test('failed workbench SQL commits roll back raw state, projection, history and receipt together', async t => {
  const h = await harness(t), owner = h.users[0].id, write = { state: { ...blank(), workouts: [workout()] }, baseRev: 0 };
  h.store.db.exec("CREATE TRIGGER test_fail_workbench_history BEFORE INSERT ON workbench_revisions BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
  const failure = await h.request('/data', { method: 'PUT', body: write }); assert.equal(failure.status, 500);
  assert.equal((await failure.json()).error, 'The local server could not complete this request');
  assert.equal(h.store.workbenchSnapshot(owner).rev, 0); assert.equal(h.store.snapshot(owner).revision, 0); assert.deepEqual(h.store.snapshot(owner).state.workouts, []);
  for (const table of ['workbench_revisions', 'workbench_receipts', 'workbench_projection_links']) assert.equal((h.store.db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE owner_id=?`).get(owner) as { count: number }).count, 0);
  h.store.db.exec('DROP TRIGGER test_fail_workbench_history');
  assert.equal((await h.request('/data', { method: 'PUT', body: write })).status, 200);
  assert.equal(h.store.workbenchSnapshot(owner).rev, 1); assert.equal(h.store.snapshot(owner).state.workouts.length, 1);
});

test('workbench state, media and accepted retry receipts survive Store restart', async t => {
  const h = await harness(t), owner = h.users[0].id, write = parseWorkbenchWrite({ state: { ...blank(), workouts: [workout()] }, baseRev: 0 });
  const projection = projectWorkbenchWorkouts(write.state, owner), accepted = h.store.saveWorkbench(owner, write, projection);
  h.store.addWorkbenchMedia(owner, hash(PNG), 'image/png', PNG);
  h.close();
  const reopened = new Store(h.directory);
  try {
    assert.equal(reopened.workbenchSnapshot(owner).rev, 1);
    assert.deepEqual(reopened.saveWorkbench(owner, write, projection), accepted);
    assert.equal(reopened.snapshot(owner).state.workouts.length, 1);
    assert.deepEqual(reopened.workbenchMediaBytes(reopened.workbenchMedia(owner, hash(PNG))!), PNG);
  } finally { reopened.close(); }
});

test('failed workbench media metadata insert removes only its new private file', async t => {
  const h = await harness(t), owner = h.users[0].id, address = hash(PNG);
  h.store.db.exec("CREATE TRIGGER test_fail_workbench_media BEFORE INSERT ON workbench_media BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
  const response = await h.request(`/media/${address}`, { method: 'PUT', mime: 'image/png', raw: PNG }); assert.equal(response.status, 500);
  assert.equal(existsSync(join(h.directory, 'workbench-media', owner, address)), false); assert.equal(h.store.workbenchMediaUsage(owner).count, 0);
  h.store.db.exec('DROP TRIGGER test_fail_workbench_media');
  assert.equal((await h.request(`/media/${address}`, { method: 'PUT', mime: 'image/png', raw: PNG })).status, 201);
});

test('workbench media restoration detects missing or corrupt files and safely repairs the same account hash', async t => {
  const h = await harness(t), owner = h.users[0].id, address = hash(PNG), path = join(h.directory, 'workbench-media', owner, address);
  const upload = () => h.request(`/media/${address}`, { method: 'PUT', mime: 'image/png', raw: PNG });
  assert.equal((await upload()).status, 201);
  for (const corrupt of [false, true]) {
    if (corrupt) writeFileSync(path, PNG.subarray(0, 25)); else rmSync(path);
    const missing = await (await h.request('/media/missing', { method: 'POST', body: { hashes: [address] } })).json(); assert.deepEqual(missing.missing, [address]);
    const read = await h.request(`/media/${address}`); assert.equal(read.status, 404); assert.equal((await read.json()).code, 'media-missing');
    const repair = await upload(); assert.equal(repair.status, 201); assert.equal((await repair.json()).existed, false);
    assert.deepEqual(Buffer.from(await (await h.request(`/media/${address}`)).arrayBuffer()), PNG);
    assert.equal(h.store.workbenchMediaUsage(owner).count, 1);
  }
});

test('reset removes deleted private media while retaining only planner version history', async t => {
  const h = await harness(t), owner = h.users[0].id, address = hash(PNG);
  await h.request(`/media/${address}`, { method: 'PUT', mime: 'image/png', raw: PNG });
  const raw = { ...blank(), routines: [{ id: 'plan-1', name: 'Keep plan history' }], bodyweight: [{ d: '2026-10-18', w: 70 }], dayNotes: { '2026-10-18': { text: 'Private observation' } }, customEx: [{ id: 'custom-photo', n: 'Private photo', media: { kind: 'image', hash: address, mime: 'image/png', size: PNG.length, width: 1, height: 1 } }] };
  const saved = await (await h.request('/data', { method: 'PUT', body: { state: raw, baseRev: 0 } })).json();
  assert.equal((await h.request('/data', { method: 'PUT', body: { state: blank(), baseRev: saved.rev } })).status, 200);
  const swept = await (await h.request('/media/sweep', { method: 'POST', body: {} })).json(); assert.equal(swept.removed, 1); assert.equal(swept.freedBytes, PNG.length);
  assert.equal(existsSync(join(h.directory, 'workbench-media', owner, address)), false);
  const exported = h.store.exportWorkbench(owner); assert.deepEqual(exported.media, []);
  assert.deepEqual(exported.revisions[0].state.routines, raw.routines);
  const historyJson = JSON.stringify(exported.revisions); assert.equal(historyJson.includes(address), false); assert.equal(historyJson.includes('Private observation'), false); assert.equal(historyJson.includes('bodyweight'), false);
});

test('workbench rejects truncated image payloads even when header, hash and MIME look valid', async t => {
  const h = await harness(t), truncated = PNG.subarray(0, 25);
  const response = await h.request(`/media/${hash(truncated)}`, { method: 'PUT', mime: 'image/png', raw: truncated });
  assert.equal(response.status, 400); assert.equal((await response.json()).code, 'media-invalid');
  assert.equal(h.store.workbenchMediaUsage(h.users[0].id).count, 0);
});
