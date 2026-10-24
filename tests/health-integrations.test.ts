import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import type { Server } from 'node:http';
import { createApp, type AppOptions } from '../server/app';
import type { HealthProvider, HealthRecord } from '../src/health';

// Completely synthetic accounts, health records and OAuth credentials. No live
// provider requests, environment files, or user databases are used by this suite.
const ORIGIN = 'http://127.0.0.1:5173';
const PUBLIC_URL = 'http://127.0.0.1:3001';
const PASSWORD = 'Synthetic-health-QA-password-2026';
const KEY = Buffer.alloc(32, 23).toString('base64');
const NOW = Date.parse('2026-10-23T18:00:00Z');
const PRIVATE = 'QA_PROVIDER_PRIVATE_ERROR_MUST_NOT_LEAK';
const ACCESS = 'QA_SYNTHETIC_ACCESS_TOKEN_SECRET';
const REFRESH = 'QA_SYNTHETIC_REFRESH_TOKEN_SECRET';
const ROTATED_ACCESS = 'QA_SYNTHETIC_ROTATED_ACCESS_SECRET';
const ROTATED_REFRESH = 'QA_SYNTHETIC_ROTATED_REFRESH_SECRET';
type CloudProvider = Exclude<HealthProvider, 'apple-health'>;
const CLOUD: CloudProvider[] = ['whoop', 'oura', 'google-health'];
const SCOPES: Record<CloudProvider, string> = {
  whoop: 'offline read:cycles read:recovery read:sleep read:workout read:body_measurement',
  oura: 'daily heartrate workout spo2',
  'google-health': ['activity_and_fitness', 'health_metrics_and_measurements', 'sleep'].map(scope => `https://www.googleapis.com/auth/googlehealth.${scope}.readonly`).join(' '),
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
type Call = { url: URL; headers: Headers; body: URLSearchParams; init?: RequestInit };
function fakeProvider(handler?: (call: Call, index: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const transport: typeof fetch = async (input, init) => {
    const call = { url: new URL(String(input)), headers: new Headers(init?.headers), body: new URLSearchParams(String(init?.body ?? '')), init };
    calls.push(call);
    if (handler) return await handler(call, calls.length - 1);
    return defaultResponse(call);
  };
  return { calls, transport };
}
function tokenProvider(url: URL): CloudProvider | null {
  if (url.hostname === 'api.prod.whoop.com' && url.pathname === '/oauth/oauth2/token') return 'whoop';
  if (url.hostname === 'api.ouraring.com' && url.pathname === '/oauth/token') return 'oura';
  if (url.hostname === 'oauth2.googleapis.com' && url.pathname === '/token') return 'google-health';
  return null;
}
function tokenResponse(provider: CloudProvider, change: Record<string, unknown> = {}) {
  return json({ access_token: ACCESS, refresh_token: REFRESH, token_type: 'Bearer', expires_in: 3600, scope: SCOPES[provider], ...change });
}
function defaultResponse(call: Call): Response {
  const provider = tokenProvider(call.url);
  if (provider) return tokenResponse(provider);
  if (call.url.hostname === 'health.googleapis.com' && call.url.pathname === '/v4/users/me/identity')
    return json({ name: 'users/me/identity', healthUserId: 'qa-google-health-user' });
  if (call.url.hostname === 'api.prod.whoop.com') return json({ records: [], next_token: null });
  if (call.url.hostname === 'api.ouraring.com') return json({ data: [], next_token: null });
  if (call.url.hostname === 'health.googleapis.com') return json({ dataPoints: [] });
  throw new Error(`Unexpected non-official provider destination: ${call.url.origin}${call.url.pathname}`);
}
interface Session { id: string; cookie: string; email: string }
type HealthOptions = NonNullable<AppOptions['health']>;
async function fixture(t: TestContext, options: { health?: HealthOptions; fetch?: typeof fetch; now?: () => number } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-independent-health-qa-'));
  const mock = fakeProvider();
  const health: HealthOptions = options.health ?? {
    tokenKey: KEY, publicBaseUrl: PUBLIC_URL, pollIntervalMs: 0,
    providers: Object.fromEntries(CLOUD.map(provider => [provider, { clientId: `qa-${provider}-client`, clientSecret: `qa-${provider}-client-secret` }])),
  };
  let service: ReturnType<typeof createApp>, server: Server, base = '', active = false;
  const start = async () => {
    service = createApp({ dataDir: directory, secureCookies: false, ai: {}, health, healthFetch: options.fetch ?? mock.transport, healthNow: options.now ?? (() => NOW) });
    server = service.app.listen(0, '127.0.0.1');
    await new Promise<void>(ready => server.once('listening', ready));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}`;
    active = true;
  };
  const stop = async () => {
    if (!active) return;
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    service.close(); active = false;
  };
  await start();
  t.after(async () => {
    await stop();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-independent-health-qa-'));
    rmSync(target, { recursive: true, force: true });
  });
  const request = async (method: string, path: string, body?: unknown, session?: Session, extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = { Origin: ORIGIN, 'Content-Type': 'application/json', ...(session ? { Cookie: session.cookie, 'X-Forma-Account': session.id } : {}), ...extra };
    const response = await fetch(base + path, { method, headers, redirect: 'manual', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    let value: any; try { value = JSON.parse(text); } catch { value = null; }
    return { status: response.status, body: value, text, headers: response.headers };
  };
  const register = async (previous?: Session): Promise<Session> => {
    const email = `qa-${randomUUID()}@example.test`;
    const result = await request('POST', '/api/auth/register', { email, password: PASSWORD, name: 'Synthetic health QA' }, previous);
    assert.equal(result.status, 201);
    const cookie = result.headers.getSetCookie().find(cookie => cookie.startsWith('forma_session='))?.split(';')[0];
    assert.ok(cookie); return { id: result.body.user.id, cookie, email };
  };
  const connect = async (owner: Session, provider: CloudProvider) => {
    const result = await request('POST', `/api/health/${provider}/connect`, {}, owner);
    assert.equal(result.status, 200, result.text);
    const url = new URL(result.body.authorizationUrl);
    const bindingName = `forma_health_oauth_${provider.replaceAll('-', '_')}`;
    const bindingHeader = result.headers.getSetCookie().find(cookie => cookie.startsWith(bindingName + '='));
    assert.ok(bindingHeader, 'OAuth must use a separate short-lived callback binding cookie');
    const state = url.searchParams.get('state'); assert.ok(state);
    return { provider, url, state, binding: bindingHeader.split(';')[0], bindingHeader };
  };
  const callback = (flow: Awaited<ReturnType<typeof connect>>, extra: Record<string, string> = {}, query: Record<string, string> = { code: 'qa-code' }, provider: CloudProvider = flow.provider) =>
    request('GET', `/integrations/${provider}/callback?${new URLSearchParams({ state: flow.state, ...query })}`, undefined, undefined, { Cookie: flow.binding, ...extra });
  const connections = async (owner: Session) => {
    const result = await request('GET', '/api/health/connections', undefined, owner);
    assert.equal(result.status, 200, result.text); return result.body.connections as any[];
  };
  const records = async (owner: Session, query = '') => {
    const result = await request('GET', `/api/health/records${query}`, undefined, owner);
    assert.equal(result.status, 200, result.text); return result.body.records as any[];
  };
  const sync = (owner: Session, provider: HealthProvider) => request('POST', `/api/health/${provider}/sync`, {}, owner);
  const authorize = async (owner: Session, provider: CloudProvider) => {
    const flow = await connect(owner, provider);
    const result = await callback(flow);
    assert.ok(result.status >= 200 && result.status < 400, result.text);
    assert.equal((await connections(owner)).find(item => item.provider === provider).status, 'connected', result.text);
    return flow;
  };
  return { request, register, connect, callback, authorize, connections, records, sync, restart: async () => { await stop(); await start(); }, get service() { return service; } };
}
function noSecrets(value: unknown) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of [ACCESS, REFRESH, ROTATED_ACCESS, ROTATED_REFRESH, PRIVATE, 'client-secret']) assert.ok(!serialized.includes(secret), `private credential/error leaked: ${secret}`);
}
const appleRecord = (change: Partial<HealthRecord> = {}): HealthRecord => ({
  id: '00000000-0000-4000-8000-000000000001', kind: 'steps',
  startTime: '2026-10-23T06:00:00.000Z', endTime: '2026-10-23T07:00:00.000Z', value: 120,
  unit: 'count', source: { sourceId: 'com.apple.health.qa', sourceName: 'Synthetic Apple Watch', deviceId: 'qa-device' }, metadata: {}, ...change,
});
const ouraActivity = (steps: number | null = 120) => ({
  id: 'qa-oura-activity-day', day: '2026-10-23', timestamp: '2026-10-23T00:00:00+00:00',
  steps, active_calories: 80, total_calories: 1800,
});
const ouraSleep = () => ({
  id: 'qa-oura-sleep-session', day: '2026-10-23', bedtime_start: '2026-10-23T00:00:00+00:00', bedtime_end: '2026-10-23T08:00:00+00:00',
  total_sleep_duration: 25200, average_heart_rate: 55, average_hrv: 45,
});

test('HEALTH-QA: missing configuration is truthful and private health routes require the current account and origin', async t => {
  const mock = fakeProvider();
  const h = await fixture(t, { health: {}, fetch: mock.transport });
  const a = await h.register(), b = await h.register();
  assert.equal((await h.request('GET', '/api/health/connections')).status, 401);
  assert.equal((await h.request('GET', '/api/health/records', undefined, a, { 'X-Forma-Account': b.id })).status, 401);
  const connections = await h.connections(a);
  for (const provider of CLOUD) {
    const connection = connections.find(item => item.provider === provider);
    assert.equal(connection.configured, false); assert.equal(connection.status, 'not_configured');
    assert.ok((await h.request('POST', `/api/health/${provider}/connect`, {}, a)).status >= 400);
  }
  assert.equal(connections.find(item => item.provider === 'apple-health').status, 'needs_iphone');
  assert.equal((await h.request('POST', '/api/health/apple-health/import', { consent: true, expectedRevision: 0, records: [appleRecord()], deletedIds: [] }, a, { Origin: 'https://qa-evil.invalid' })).status, 403);
  assert.equal(mock.calls.length, 0);
});

test('HEALTH-QA: official authorization URLs, callback cookies, PKCE and encrypted tokens survive restart without leaking', async t => {
  const mock = fakeProvider();
  const h = await fixture(t, { fetch: mock.transport });
  const owner = await h.register();
  const expectedOrigins: Record<CloudProvider, string> = { whoop: 'https://api.prod.whoop.com', oura: 'https://cloud.ouraring.com', 'google-health': 'https://accounts.google.com' };
  for (const provider of CLOUD) {
    const flow = await h.connect(owner, provider);
    assert.equal(flow.url.origin, expectedOrigins[provider]);
    assert.equal(flow.url.searchParams.get('response_type'), 'code');
    assert.equal(flow.url.searchParams.get('redirect_uri'), `${PUBLIC_URL}/integrations/${provider}/callback`);
    assert.ok(flow.state.length >= 8);
    assert.match(flow.bindingHeader, /HttpOnly/i); assert.match(flow.bindingHeader, /SameSite=Lax/i);
    assert.match(flow.bindingHeader, new RegExp(`Path=/integrations/${provider}/callback`));
    assert.ok(!flow.url.toString().includes('client-secret'));
    if (provider !== 'whoop') assert.equal(flow.url.searchParams.get('code_challenge_method'), 'S256');
    const result = await h.callback(flow); noSecrets(result.text); noSecrets(result.headers.get('location'));
    assert.equal((await h.connections(owner)).find(item => item.provider === provider).status, 'connected');
    const tokenCall = mock.calls.find(call => tokenProvider(call.url) === provider && call.body.get('grant_type') === 'authorization_code');
    assert.ok(tokenCall);
    if (provider !== 'whoop') {
      const verifier = tokenCall.body.get('code_verifier'); assert.ok(verifier && verifier.length >= 43);
      assert.equal(createHash('sha256').update(verifier).digest('base64url'), flow.url.searchParams.get('code_challenge'));
    }
  }
  const stored = h.service.store.db.prepare('SELECT encrypted_tokens FROM health_connections').all();
  assert.equal(stored.length, 3);
  assert.ok(stored.every(row => typeof row.encrypted_tokens === 'string' && row.encrypted_tokens.length > 40));
  noSecrets(stored);
  noSecrets((await h.request('GET', '/api/export', undefined, owner)).text);
  noSecrets(await h.connections(owner));
  await h.restart();
  assert.ok((await h.connections(owner)).filter(item => CLOUD.includes(item.provider)).every(item => item.status === 'connected'));
});

test('HEALTH-QA: callback state replay, wrong provider, missing binding and expiry never exchange a code', async t => {
  let now = NOW;
  const mock = fakeProvider(); const h = await fixture(t, { fetch: mock.transport, now: () => now });
  const owner = await h.register();
  const missingBinding = await h.connect(owner, 'whoop');
  assert.ok((await h.callback(missingBinding, { Cookie: '' })).status >= 400);
  const wrong = await h.connect(owner, 'whoop');
  assert.ok((await h.callback(wrong, {}, { code: 'qa-code' }, 'oura')).status >= 400);
  const expired = await h.connect(owner, 'whoop'); now += 11 * 60_000;
  assert.ok((await h.callback(expired)).status >= 400);
  assert.equal(mock.calls.length, 0);
  const valid = await h.connect(owner, 'whoop');
  assert.ok((await h.callback(valid)).status < 400);
  const exchanges = mock.calls.length;
  assert.ok((await h.callback(valid)).status >= 400);
  assert.equal(mock.calls.length, exchanges);
});

test('HEALTH-QA: cross-account cookies, logout and account switches revoke an outstanding authorization', async t => {
  const mock = fakeProvider(); const h = await fixture(t, { fetch: mock.transport });
  const a = await h.register(), b = await h.register();
  const flow = await h.connect(a, 'whoop');
  assert.ok((await h.callback(flow, { Cookie: `${flow.binding}; ${b.cookie}` })).status >= 400);
  const logoutFlow = await h.connect(a, 'whoop');
  assert.equal((await h.request('POST', '/api/auth/logout', {}, a)).status, 200);
  assert.ok((await h.callback(logoutFlow)).status >= 400, 'a Lax binding is insufficient after the initiating Strict session was revoked');
  const c = await h.register();
  const switchFlow = await h.connect(c, 'whoop');
  assert.equal((await h.request('POST', '/api/auth/login', { email: b.email, password: PASSWORD }, c)).status, 200);
  assert.ok((await h.callback(switchFlow)).status >= 400, 'switching the browser session must invalidate OAuth even when Strict cookies are absent on callback');
  assert.equal(mock.calls.length, 0);
});

test('HEALTH-QA: authorization denial is single-use and provider errors or credentials stay private', async t => {
  const mock = fakeProvider(call => tokenProvider(call.url) ? json({ error: 'invalid_grant', error_description: PRIVATE, client_secret: 'qa-client-secret' }, 400) : defaultResponse(call));
  const h = await fixture(t, { fetch: mock.transport }); const owner = await h.register();
  const flow = await h.connect(owner, 'oura');
  const denied = await h.callback(flow, {}, { error: 'access_denied', error_description: PRIVATE });
  noSecrets(denied.text); noSecrets(denied.headers.get('location'));
  assert.notEqual((await h.connections(owner)).find(item => item.provider === 'oura').status, 'connected');
  assert.ok((await h.callback(flow)).status >= 400); assert.equal(mock.calls.length, 0);
  const badToken = await h.connect(owner, 'oura');
  const failed = await h.callback(badToken);
  assert.ok(failed.status >= 400); noSecrets(failed.text); noSecrets(await h.connections(owner));
  assert.equal(mock.calls.length, 1);
});

test('HEALTH-QA: Oura partial scopes query only granted streams; records remain sourced and idempotent', async t => {
  let steps = 120;
  const mock = fakeProvider(call => {
    if (tokenProvider(call.url)) return tokenResponse('oura', { scope: 'daily' });
    if (call.url.pathname.endsWith('/daily_activity')) return json({ data: [ouraActivity(steps)], next_token: null });
    if (call.url.pathname.endsWith('/sleep')) return json({ data: [ouraSleep()], next_token: null });
    if (call.url.pathname.endsWith('/daily_readiness')) return json({ data: [{ id: 'qa-oura-readiness-day', day: '2026-10-23', score: null }], next_token: null });
    throw new Error(`Endpoint outside granted daily scope: ${call.url.pathname}`);
  });
  const h = await fixture(t, { fetch: mock.transport }); const owner = await h.register();
  await h.authorize(owner, 'oura');
  const first = await h.sync(owner, 'oura'); assert.equal(first.status, 200, first.text);
  const rows = await h.records(owner);
  assert.ok(rows.length >= 3);
  assert.ok(rows.every(record => record.provider === 'oura' && record.source.sourceName));
  assert.equal(rows.find(record => record.kind === 'steps')?.value, 120);
  assert.equal(rows.find(record => record.kind === 'sleep')?.value, 420, 'Oura sleep seconds must become minutes exactly once');
  assert.equal(rows.find(record => record.kind === 'heart_rate' && record.metadata.statistic === 'sleep_average')?.value, 55);
  assert.ok(!rows.some(record => record.kind === 'resting_heart_rate'), 'a sleep-average heart rate cannot be relabeled as resting heart rate');
  assert.equal(rows.find(record => record.kind === 'readiness')?.value, null, 'unknown readiness is not zero');
  steps = 200;
  assert.equal((await h.sync(owner, 'oura')).status, 200);
  const replay = await h.records(owner);
  assert.equal(replay.length, rows.length);
  assert.equal(replay.find(record => record.kind === 'steps')?.value, 200);
  const urls = mock.calls.filter(call => !tokenProvider(call.url)).map(call => call.url);
  assert.ok(urls.every(url => !url.pathname.endsWith('/heartrate') && !url.pathname.endsWith('/workout')));
  assert.ok(urls.every(url => url.searchParams.has('start_date') && url.searchParams.has('end_date')));
  assert.deepEqual((await h.connections(owner)).find(item => item.provider === 'oura').scopes, ['daily']);
});

test('HEALTH-QA: page-two failure imports nothing, preserves existing rows and does not advance last success', async t => {
  let failing = false;
  const mock = fakeProvider(call => {
    if (tokenProvider(call.url)) return tokenResponse('oura', { scope: 'daily' });
    if (call.url.pathname.endsWith('/daily_activity')) {
      if (call.url.searchParams.has('next_token')) return json({ detail: PRIVATE }, 503);
      return json({ data: [ouraActivity(failing ? 900 : 120)], next_token: failing ? 'qa-next-page' : null });
    }
    return defaultResponse(call);
  });
  let now = NOW;
  const h = await fixture(t, { fetch: mock.transport, now: () => now }); const owner = await h.register();
  await h.authorize(owner, 'oura'); assert.equal((await h.sync(owner, 'oura')).status, 200);
  const before = await h.records(owner), lastSync = (await h.connections(owner)).find(item => item.provider === 'oura').lastSyncAt;
  failing = true; now += 60_000;
  const result = await h.sync(owner, 'oura'); assert.ok(result.status >= 400); noSecrets(result.text);
  assert.deepEqual(await h.records(owner), before, 'a failed final page must not commit earlier pages or overwrite prior imports');
  assert.equal((await h.connections(owner)).find(item => item.provider === 'oura').lastSyncAt, lastSync);
});

test('HEALTH-QA: rotating refresh tokens persist before a later endpoint fails and are reused after restart', async t => {
  let now = NOW, failData = false;
  const refreshes: string[] = [];
  const mock = fakeProvider(call => {
    if (tokenProvider(call.url)) {
      if (call.body.get('grant_type') === 'refresh_token') {
        refreshes.push(call.body.get('refresh_token')!);
        return tokenResponse('oura', { access_token: ROTATED_ACCESS, refresh_token: ROTATED_REFRESH, scope: undefined });
      }
      return tokenResponse('oura', { scope: 'daily' });
    }
    if (failData) return json({ detail: PRIVATE }, 503);
    return defaultResponse(call);
  });
  const h = await fixture(t, { fetch: mock.transport, now: () => now }); const owner = await h.register();
  await h.authorize(owner, 'oura'); now += 4000_000; failData = true;
  assert.ok((await h.sync(owner, 'oura')).status >= 400);
  assert.deepEqual(refreshes, [REFRESH]);
  await h.restart(); now += 4000_000; failData = false;
  const result = await h.sync(owner, 'oura'); assert.equal(result.status, 200, result.text);
  assert.deepEqual(refreshes, [REFRESH, ROTATED_REFRESH], 'a failed data fetch must not cause the next run to reuse an invalidated refresh token');
  const calls = mock.calls.filter(call => !tokenProvider(call.url));
  assert.ok(calls.every(call => call.headers.get('authorization') === `Bearer ${ROTATED_ACCESS}`));
  noSecrets((await h.request('GET', '/api/export', undefined, owner)).text);
});

test('HEALTH-QA: a disconnect while a request is pending stops stale results and leaves another account unaffected', async t => {
  let release!: (response: Response) => void, announce!: () => void;
  const reached = new Promise<void>(done => { announce = done; });
  let block = true;
  const mock = fakeProvider(async call => {
    if (tokenProvider(call.url)) return tokenResponse('oura', { scope: 'daily' });
    if (block && call.url.pathname.endsWith('/daily_activity')) { block = false; announce(); return await new Promise<Response>(done => { release = done; }); }
    return defaultResponse(call);
  });
  const h = await fixture(t, { fetch: mock.transport }); const a = await h.register(), b = await h.register();
  await h.authorize(a, 'oura'); await h.authorize(b, 'oura');
  const pending = h.sync(a, 'oura');
  await Promise.race([reached, pending.then(result => { throw new Error(`Expected pending provider call, got ${result.status}`); })]);
  const beforeCalls = mock.calls.length;
  assert.equal((await h.sync(a, 'oura')).status, 409, 'the same connection cannot refresh or poll concurrently');
  assert.equal(mock.calls.length, beforeCalls);
  assert.equal((await h.request('POST', '/api/health/oura/disconnect', {}, a)).status, 200);
  release(json({ data: [ouraActivity()], next_token: null }));
  assert.ok((await pending).status >= 400);
  assert.deepEqual(await h.records(a), []);
  assert.equal((await h.connections(a)).find(item => item.provider === 'oura').status, 'disconnected');
  assert.equal((await h.connections(b)).find(item => item.provider === 'oura').status, 'connected');
  const row = h.service.store.db.prepare('SELECT encrypted_tokens FROM health_connections WHERE owner_id=? AND provider=?').get(a.id, 'oura');
  assert.equal(row?.encrypted_tokens, null);
});

test('HEALTH-QA: account deletion during OAuth exchange cannot recreate tokens or private rows', async t => {
  let release!: (response: Response) => void, announce!: () => void;
  const reached = new Promise<void>(done => { announce = done; });
  const mock = fakeProvider(async call => {
    if (tokenProvider(call.url)) { announce(); return await new Promise<Response>(done => { release = done; }); }
    return defaultResponse(call);
  });
  const h = await fixture(t, { fetch: mock.transport }); const owner = await h.register();
  const flow = await h.connect(owner, 'whoop'); const pending = h.callback(flow);
  await Promise.race([reached, pending.then(result => { throw new Error(`Expected token exchange, got ${result.status}`); })]);
  assert.equal((await h.request('DELETE', '/api/account', { password: PASSWORD }, owner)).status, 200);
  release(tokenResponse('whoop'));
  const result = await pending; assert.ok(result.status >= 400); noSecrets(result.text);
  for (const table of ['health_connections', 'health_oauth_states', 'health_records'])
    assert.equal(h.service.store.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE owner_id=?`).get(owner.id)?.n, 0);
  assert.deepEqual(h.service.store.db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('HEALTH-QA: logout during code exchange invalidates its result even after state was consumed', async t => {
  let release!: (response: Response) => void, announce!: () => void;
  const reached = new Promise<void>(done => { announce = done; });
  const mock = fakeProvider(async call => {
    if (tokenProvider(call.url)) { announce(); return await new Promise<Response>(done => { release = done; }); }
    return defaultResponse(call);
  });
  const h = await fixture(t, { fetch: mock.transport }); const owner = await h.register();
  const flow = await h.connect(owner, 'whoop'); const pending = h.callback(flow);
  await Promise.race([reached, pending.then(result => { throw new Error(`Expected token exchange, got ${result.status}`); })]);
  assert.equal((await h.request('POST', '/api/auth/logout', {}, owner)).status, 200);
  release(tokenResponse('whoop'));
  const result = await pending; assert.ok(result.status >= 400); noSecrets(result.text);
  const row = h.service.store.db.prepare('SELECT status,encrypted_tokens FROM health_connections WHERE owner_id=? AND provider=?').get(owner.id, 'whoop');
  assert.notEqual(row?.status, 'connected'); assert.equal(row?.encrypted_tokens, null);
});

test('HEALTH-QA: Google requires an actual linked Health identity and uses v4 union fields and source data', async t => {
  let linked = false;
  const interval = { startTime: '2026-10-23T06:00:00Z', endTime: '2026-10-23T07:00:00Z', startUtcOffset: '0s', endUtcOffset: '0s' };
  const source = { device: { manufacturer: 'QA', displayName: 'Synthetic Pixel Watch', formFactor: 'WATCH' }, application: { packageName: 'com.qa.health' }, platform: 'HEALTH_CONNECT', recordingMethod: 'PASSIVELY_MEASURED' };
  const mock = fakeProvider(call => {
    if (tokenProvider(call.url)) return tokenResponse('google-health');
    assert.equal(call.url.hostname, 'health.googleapis.com'); assert.ok(call.url.pathname.startsWith('/v4/'));
    if (call.url.pathname.endsWith('/identity')) return linked ? defaultResponse(call) : json({ error: { code: 400, status: 'ACCOUNT_NOT_LINKED', message: PRIVATE } }, 400);
    if (call.url.pathname.includes('/steps/')) return json({ dataPoints: [{ dataSource: source, steps: { interval, count: '120' } }] });
    if (call.url.pathname.includes('/weight/')) return json({ dataPoints: [{ dataSource: source, weight: { sampleTime: { physicalTime: '2026-10-23T06:00:00Z', utcOffset: '0s' }, weightGrams: 72500 } }] });
    if (call.url.pathname.includes('/heart-rate/')) return json({ dataPoints: [{ dataSource: source, heartRate: { sampleTime: { physicalTime: '2026-10-23T06:00:00Z', utcOffset: '0s' }, beatsPerMinute: '62' } }] });
    return defaultResponse(call);
  });
  const h = await fixture(t, { fetch: mock.transport }); const owner = await h.register();
  const unlinked = await h.connect(owner, 'google-health'); const denied = await h.callback(unlinked);
  assert.ok(denied.status >= 400); noSecrets(denied.text);
  assert.notEqual((await h.connections(owner)).find(item => item.provider === 'google-health').status, 'connected');
  linked = true; await h.authorize(owner, 'google-health');
  const result = await h.sync(owner, 'google-health'); assert.equal(result.status, 200, result.text);
  const rows = await h.records(owner);
  assert.equal(rows.find(row => row.kind === 'steps')?.value, 120);
  assert.equal(rows.find(row => row.kind === 'weight')?.value, 72.5);
  assert.equal(rows.find(row => row.kind === 'heart_rate')?.value, 62);
  assert.ok(rows.every(row => row.source.sourceId.includes('com.qa.health') || row.source.sourceName.includes('Synthetic Pixel Watch')), 'device/app provenance must survive normalized imports');
  assert.equal((await h.sync(owner, 'google-health')).status, 200);
  assert.equal((await h.records(owner)).length, rows.length, 'Google points without resource IDs must still have stable replay identity');
});

test('HEALTH-QA: Apple uploads require explicit consent, remain separate facts, replay safely and honor account-scoped deletion', async t => {
  const h = await fixture(t); const a = await h.register(), b = await h.register();
  const revision = (await h.connections(a)).find(item => item.provider === 'apple-health').syncRevision;
  const input = { consent: true, expectedRevision: revision, records: [appleRecord()], deletedIds: [] };
  assert.equal((await h.request('POST', '/api/health/apple-health/import', { ...input, consent: false }, a)).status, 400);
  assert.equal((await h.request('POST', '/api/health/apple-health/import', { ...input, ownerId: b.id }, a)).status, 400);
  assert.equal((await h.request('POST', '/api/health/apple-health/import', input, a)).status, 200);
  assert.equal((await h.request('POST', '/api/health/apple-health/import', input, a)).status, 200);
  assert.equal((await h.records(a)).length, 1);
  assert.equal((await h.records(b)).length, 0);
  const state = (await h.request('GET', '/api/state', undefined, a)).body.state;
  assert.deepEqual(state.sleeps, []); assert.deepEqual(state.workouts, []);
  const edited = { ...input, records: [appleRecord({ value: 140 })] };
  assert.equal((await h.request('POST', '/api/health/apple-health/import', edited, a)).status, 200);
  assert.equal((await h.records(a))[0].value, 140);
  assert.equal((await h.request('POST', '/api/health/apple-health/import', { consent: true, expectedRevision: (await h.connections(b)).find(item => item.provider === 'apple-health').syncRevision, records: [], deletedIds: [appleRecord().id] }, b)).status, 200);
  assert.equal((await h.records(a)).length, 1);
  const exported = await h.request('GET', '/api/export', undefined, a);
  assert.ok(exported.text.includes('Synthetic Apple Watch'), 'the owner must be able to export imported facts');
  assert.equal((await h.request('DELETE', '/api/health/apple-health/records', { confirm: false }, a)).status, 400);
  assert.equal((await h.request('DELETE', '/api/health/apple-health/records', { confirm: true }, a)).status, 200);
  assert.equal((await h.records(a)).length, 0);
});

test('HEALTH-QA: old Apple previews cannot restore imports after web disconnect or explicit record deletion', async t => {
  const h = await fixture(t); const owner = await h.register();
  const revision = () => h.connections(owner).then(items => items.find(item => item.provider === 'apple-health').syncRevision as number);
  const firstRevision = await revision(); assert.ok(Number.isSafeInteger(firstRevision));
  const preview = { consent: true, expectedRevision: firstRevision, records: [appleRecord()], deletedIds: [] };
  assert.equal((await h.request('POST', '/api/health/apple-health/import', preview, owner)).status, 200);
  assert.equal(await revision(), firstRevision, 'normal batch acknowledgements must permit idempotent lost-ack replay and later chunks');
  assert.equal((await h.request('POST', '/api/health/apple-health/disconnect', {}, owner)).status, 200);
  assert.ok(await revision() > firstRevision);
  assert.equal((await h.request('POST', '/api/health/apple-health/import', preview, owner)).status, 409);
  const retained = await h.records(owner); assert.equal(retained.length, 1, 'disconnect retains reviewed imported history');
  const newPreview = { ...preview, expectedRevision: await revision() };
  assert.equal((await h.request('POST', '/api/health/apple-health/import', newPreview, owner)).status, 200);
  assert.equal((await h.request('DELETE', '/api/health/apple-health/records', { confirm: true }, owner)).status, 200);
  assert.ok(await revision() > newPreview.expectedRevision);
  assert.equal((await h.request('POST', '/api/health/apple-health/import', newPreview, owner)).status, 409);
  assert.deepEqual(await h.records(owner), []);
});

test('HEALTH-QA: malformed Apple batches are atomic and missing facts stay null instead of zero', async t => {
  const h = await fixture(t); const owner = await h.register();
  const expectedRevision = (await h.connections(owner)).find(item => item.provider === 'apple-health').syncRevision;
  const valid = appleRecord();
  for (const invalid of [
    { ...valid, unit: 'kcal' }, { ...valid, value: -1 }, { ...valid, value: 1.5 },
    { ...valid, startTime: valid.endTime, endTime: valid.startTime },
    { ...valid, kind: 'sleep', unit: 'min', value: 90 },
    { ...valid, source: { ...valid.source, sourceName: 'QA\u0000device' } },
    { ...valid, ownerId: randomUUID() },
  ]) {
    const result = await h.request('POST', '/api/health/apple-health/import', { consent: true, expectedRevision, records: [appleRecord({ id: 'qa-before-invalid' }), invalid], deletedIds: [] }, owner);
    assert.equal(result.status, 400, result.text);
    assert.deepEqual(await h.records(owner), [], 'valid rows in a malformed batch cannot be committed');
  }
  assert.equal((await h.request('POST', '/api/health/apple-health/import', { consent: true, expectedRevision, records: [valid, valid], deletedIds: [] }, owner)).status, 400);
  assert.equal((await h.request('POST', '/api/health/apple-health/import', { consent: true, expectedRevision, records: [valid], deletedIds: [valid.id] }, owner)).status, 400);
  assert.equal((await h.request('POST', '/api/health/apple-health/import', { consent: true, expectedRevision, records: [appleRecord({ value: null })], deletedIds: [] }, owner)).status, 200);
  assert.equal((await h.records(owner))[0].value, null);
  assert.equal((await h.request('POST', '/api/health/apple-health/import', { consent: true, expectedRevision, records: [appleRecord({ value: 0 })], deletedIds: [] }, owner)).status, 200);
  assert.equal((await h.records(owner))[0].value, 0, 'a real reported zero is not missing');
});

test('HEALTH-QA: WHOOP v2 normalization keeps vendor scores and RMSSD distinct and does not turn pending scores into zeros', async t => {
  const mock = fakeProvider(call => {
    if (tokenProvider(call.url)) return tokenResponse('whoop');
    const base = { start: '2026-10-23T00:00:00Z', end: '2026-10-23T08:00:00Z', score_state: 'SCORED' };
    if (call.url.pathname.endsWith('/cycle')) return json({ records: [{ ...base, id: 120, score: { kilojoule: 2092 } }], next_token: null });
    if (call.url.pathname.endsWith('/recovery')) return json({ records: [
      { cycle_id: 120, created_at: '2026-10-23T08:00:00Z', updated_at: '2026-10-23T09:00:00Z', score_state: 'SCORED', score: { recovery_score: 0, resting_heart_rate: 54, hrv_rmssd_milli: 42.5 } },
      { cycle_id: 121, created_at: '2026-10-23T08:00:00Z', updated_at: '2026-10-23T09:00:00Z', score_state: 'PENDING_SCORE', score: null },
    ], next_token: null });
    if (call.url.pathname.endsWith('/activity/sleep')) return json({ records: [{ ...base, id: 'qa-whoop-sleep', nap: false, score: { stage_summary: { total_light_sleep_time_milli: 10_800_000, total_slow_wave_sleep_time_milli: 3_600_000, total_rem_sleep_time_milli: 3_600_000 } } }], next_token: null });
    return defaultResponse(call);
  });
  const h = await fixture(t, { fetch: mock.transport }); const owner = await h.register();
  await h.authorize(owner, 'whoop'); const result = await h.sync(owner, 'whoop'); assert.equal(result.status, 200, result.text);
  const rows = await h.records(owner);
  assert.equal(rows.find(row => row.kind === 'total_energy')?.value, 500);
  assert.equal(rows.find(row => row.kind === 'sleep')?.value, 300);
  assert.equal(rows.find(row => row.kind === 'hrv_rmssd' && row.value !== null)?.value, 42.5);
  assert.ok(!rows.some(row => row.kind === 'hrv_sdnn'));
  assert.ok(rows.some(row => row.kind === 'recovery' && row.value === 0 && row.metadata.vendorScore === true));
  assert.ok(rows.some(row => row.kind === 'recovery' && row.value === null));
  const recovery = rows.find(row => row.kind === 'recovery' && row.value === 0);
  assert.equal(recovery.startTime, recovery.endTime, 'a recovery processing update timestamp is not the end of a physiological measurement interval');
  assert.ok(mock.calls.filter(call => !tokenProvider(call.url)).every(call => call.url.searchParams.has('start') && call.url.searchParams.has('end') && call.url.searchParams.get('limit') === '25'));
});

test('HEALTH-QA: Oura token responses without scope use bounded permission probes and never trust callback scope', async t => {
  const mock = fakeProvider(call => {
    if (tokenProvider(call.url)) return tokenResponse('oura', { scope: undefined });
    if (call.url.pathname.endsWith('/heartrate') || call.url.pathname.endsWith('/workout')) return json({ detail: PRIVATE }, 403);
    return defaultResponse(call);
  });
  const h = await fixture(t, { fetch: mock.transport }); const owner = await h.register();
  const flow = await h.connect(owner, 'oura');
  const response = await h.callback(flow, {}, { code: 'qa-code', scope: 'daily heartrate workout personal email' });
  assert.ok(response.status < 400, response.text);
  const connection = (await h.connections(owner)).find(item => item.provider === 'oura');
  assert.equal(connection.status, 'connected'); assert.deepEqual(connection.scopes, ['daily']);
  const before = mock.calls.length;
  assert.equal((await h.sync(owner, 'oura')).status, 200);
  assert.ok(mock.calls.slice(before).every(call => !call.url.pathname.endsWith('/heartrate') && !call.url.pathname.endsWith('/workout')));
  noSecrets(await h.connections(owner));
});

test('HEALTH-QA: oversized HTTP responses and repeating pagination are bounded without partial imports', async t => {
  for (const mode of ['oversized', 'repeating-page'] as const) await t.test(mode, async child => {
    let cancelled = false;
    const mock = fakeProvider(call => {
      if (tokenProvider(call.url)) return tokenResponse('oura', { scope: 'daily' });
      if (mode === 'oversized') return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 200, headers: { 'Content-Length': String(2 * 1024 * 1024 + 1) } });
      return json({ data: [ouraActivity()], next_token: 'qa-repeating-page' });
    });
    const h = await fixture(child, { fetch: mock.transport }); const owner = await h.register();
    await h.authorize(owner, 'oura');
    const result = await h.sync(owner, 'oura'); assert.ok(result.status >= 400); noSecrets(result.text);
    assert.deepEqual(await h.records(owner), []);
    assert.equal((await h.connections(owner)).find(item => item.provider === 'oura').lastSyncAt, null);
    assert.ok(mock.calls.length <= 4, 'response or loop bounds must stop before unbounded page requests');
    if (mode === 'oversized') assert.equal(cancelled, true);
  });
});

test('HEALTH-QA: transport timeout is bounded even when a provider ignores AbortSignal', { timeout: 5000 }, async t => {
  let hang = false;
  const mock = fakeProvider(async call => {
    if (hang && !tokenProvider(call.url)) return await new Promise<Response>(() => {});
    return defaultResponse(call);
  });
  const h = await fixture(t, { fetch: mock.transport, health: { tokenKey: KEY, publicBaseUrl: PUBLIC_URL, providers: { oura: { clientId: 'qa-oura-client', clientSecret: 'qa-oura-client-secret' } }, timeoutMs: 30, pollIntervalMs: 0 } });
  const owner = await h.register(); await h.authorize(owner, 'oura'); hang = true;
  const started = Date.now(), response = await h.sync(owner, 'oura');
  assert.equal(response.status, 504); assert.ok(Date.now() - started < 2000); noSecrets(response.text);
  assert.deepEqual(await h.records(owner), []);
});

test('HEALTH-QA: deleting records during an active cloud poll invalidates the whole pending result', async t => {
  let release!: (response: Response) => void, announce!: () => void;
  const reached = new Promise<void>(done => { announce = done; });
  const mock = fakeProvider(async call => {
    if (tokenProvider(call.url)) return tokenResponse('oura', { scope: 'daily' });
    if (call.url.pathname.endsWith('/daily_activity')) { announce(); return await new Promise<Response>(done => { release = done; }); }
    return defaultResponse(call);
  });
  const h = await fixture(t, { fetch: mock.transport }); const owner = await h.register();
  await h.authorize(owner, 'oura');
  const pending = h.sync(owner, 'oura');
  await Promise.race([reached, pending.then(result => { throw new Error(`Expected pending provider call, got ${result.status}`); })]);
  assert.equal((await h.request('DELETE', '/api/health/oura/records', { confirm: true }, owner)).status, 200);
  release(json({ data: [ouraActivity()], next_token: null }));
  assert.ok((await pending).status >= 400);
  assert.deepEqual(await h.records(owner), []);
  assert.equal((await h.connections(owner)).find(item => item.provider === 'oura').lastSyncAt, null);
});

test('HEALTH-QA: overlapping imports stay separate by provider, export is private and account deletion cascades', async t => {
  const mock = fakeProvider(call => {
    if (tokenProvider(call.url)) return tokenResponse('oura', { scope: 'daily' });
    if (call.url.pathname.endsWith('/daily_activity')) return json({ data: [ouraActivity()], next_token: null });
    return defaultResponse(call);
  });
  const h = await fixture(t, { fetch: mock.transport }); const a = await h.register(), b = await h.register();
  await h.authorize(a, 'oura'); assert.equal((await h.sync(a, 'oura')).status, 200);
  const revision = (await h.connections(a)).find(item => item.provider === 'apple-health').syncRevision;
  assert.equal((await h.request('POST', '/api/health/apple-health/import', { consent: true, expectedRevision: revision, records: [appleRecord()], deletedIds: [] }, a)).status, 200);
  const steps = (await h.records(a)).filter(row => row.kind === 'steps');
  assert.equal(steps.length, 2); assert.deepEqual(new Set(steps.map(row => row.provider)), new Set(['oura', 'apple-health']));
  assert.ok(steps.every(row => row.value === 120), 'overlap must not become an invented 240-step consolidated record');
  assert.deepEqual(await h.records(b), []);
  const bExport = await h.request('GET', '/api/export', undefined, b);
  assert.ok(!bExport.text.includes('Synthetic Apple Watch')); noSecrets(bExport.text);
  await h.connect(a, 'whoop');
  assert.equal((await h.request('DELETE', '/api/account', { password: PASSWORD }, a)).status, 200);
  for (const table of ['health_connections', 'health_oauth_states', 'health_records'])
    assert.equal(h.service.store.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE owner_id=?`).get(a.id)?.n, 0);
  assert.deepEqual(h.service.store.db.prepare('PRAGMA foreign_key_check').all(), []);
});
