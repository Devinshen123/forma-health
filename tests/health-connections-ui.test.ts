import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import type { Server } from 'node:http';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createApp } from '../server/app';
import HealthConnections from '../src/features/HealthConnections';
import type { HealthConnection } from '../src/health';
import { callbackOutcome, callbackPage, healthActionErrorText, healthLastErrorText, healthStateHint, healthStatusText, healthViewState, type HealthViewState } from '../src/health-copy';

// Synthetic only: temporary SQLite, synthetic accounts, no provider credentials,
// no external network and no .env (health config is passed explicitly).
const ORIGIN = 'http://127.0.0.1:5173';
const PASSWORD = 'Synthetic-health-ui-password-2026';
const KEY = Buffer.alloc(32, 41).toString('base64');
const connection = (patch: Partial<HealthConnection> = {}): HealthConnection => ({
  provider: 'oura', configured: true, status: 'connected', reason: null, scopes: [], connectedAt: null, lastSyncAt: null, lastError: null,
  recordCount: 0, syncRevision: 0, callbackUrl: null, applicationUrl: 'https://developer.ouraring.com/', ...patch,
});

test('HEALTH-UI: every connection state has distinct zh and en copy', () => {
  const states: HealthViewState[] = ['demo', 'loading', 'unavailable', 'not_configured', 'disconnected', 'connected', 'reauthorize', 'needs_iphone'];
  const zh = states.map(state => healthStatusText(state, true)), en = states.map(state => healthStatusText(state, false));
  assert.equal(new Set(zh).size, states.length); assert.equal(new Set(en).size, states.length);
  for (const [index] of states.entries()) { assert.ok(zh[index].length > 0 && en[index].length > 0); assert.notEqual(zh[index], en[index]); }
  assert.equal(healthViewState(undefined, { demo: true, loading: true }), 'demo');
  assert.equal(healthViewState(undefined, { demo: false, loading: true }), 'loading');
  assert.equal(healthViewState(undefined, { demo: false, loading: false }), 'unavailable');
  assert.equal(healthViewState(connection({ status: 'not_configured' }), { demo: false, loading: false }), 'not_configured');
});

test('HEALTH-UI: not configured, empty, reauthorize and error states explain what is needed without claiming a connection', () => {
  const notConfigured = connection({ configured: false, status: 'not_configured' });
  for (const zh of [true, false]) {
    const hint = healthStateHint('not_configured', notConfigured, zh);
    assert.ok(hint); assert.match(hint, zh ? /未配置/ : /no developer app credentials/);
    assert.doesNotMatch(hint, zh ? /已连接/ : /\bconnected\b/i);
    assert.ok(healthStateHint('connected', connection({ recordCount: 0 }), zh), 'connected with zero records needs an empty-state hint');
    assert.equal(healthStateHint('connected', connection({ recordCount: 3 }), zh), null);
    assert.ok(healthStateHint('reauthorize', connection({ status: 'reauthorize' }), zh));
    assert.ok(healthStateHint('unavailable', undefined, zh));
    assert.equal(healthStateHint('disconnected', connection({ status: 'disconnected' }), zh), null);
  }
  assert.equal(healthLastErrorText(null, true), null);
  assert.notEqual(healthLastErrorText('HEALTH_REAUTHORIZE', false), healthLastErrorText('HEALTH_PROVIDER_RATE_LIMIT', false));
  assert.match(healthLastErrorText('SOMETHING_NEW', false)!, /did not finish/);
  assert.match(healthActionErrorText(503, 'HEALTH_NOT_CONFIGURED', false), /not configured/);
  assert.match(healthActionErrorText(503, 'HEALTH_NOT_CONFIGURED', true), /尚未在服务器上配置/);
  assert.match(healthActionErrorText(409, 'HEALTH_SYNC_BUSY', false), /already syncing/);
  assert.match(healthActionErrorText(401, undefined, false), /Sign in again/);
  assert.match(healthActionErrorText(500, 'UNKNOWN', true), /暂时无法完成/);
});

test('HEALTH-UI: callback pages are bilingual, outcome-specific and contain no provider text', () => {
  assert.equal(callbackOutcome('HEALTH_CONSENT_DENIED'), 'denied');
  assert.equal(callbackOutcome('HEALTH_NOT_CONFIGURED'), 'not_configured');
  assert.equal(callbackOutcome('HEALTH_ACCOUNT_NOT_LINKED'), 'not_linked');
  assert.equal(callbackOutcome(undefined), 'expired');
  for (const outcome of ['connected', 'denied', 'not_configured', 'not_linked', 'missing_scopes', 'expired'] as const) {
    const page = callbackPage(outcome);
    assert.match(page, /lang="zh-CN"/); assert.match(page, /lang="en"/); assert.match(page, /[一-鿿]/);
    assert.doesNotMatch(page, /<script|style=|token|HEALTH_/i);
  }
  assert.match(callbackPage('connected'), /Health account connected/);
  assert.doesNotMatch(callbackPage('not_configured'), /Health account connected/);
});

test('HEALTH-UI: demo and initial account render show truthful states in both languages', () => {
  const noop = () => undefined;
  for (const lang of ['zh', 'en'] as const) {
    const demo = renderToStaticMarkup(createElement(HealthConnections, { lang, demo: true, onCreate: noop }));
    assert.equal((demo.match(/data-health-state="demo"/g) ?? []).length, 4);
    assert.doesNotMatch(demo, /data-health-state="connected"/);
    assert.match(demo, lang === 'zh' ? /演示模式不会连接真实设备/ : /Demo mode does not connect real devices/);
    const loading = renderToStaticMarkup(createElement(HealthConnections, { lang, demo: false, accountId: 'synthetic-account', onCreate: noop }));
    assert.equal((loading.match(/data-health-state="loading"/g) ?? []).length, 4, 'before the first response every provider shows loading, never connected');
    assert.match(loading, lang === 'zh' ? /正在读取/ : /Loading…/);
  }
});

async function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-health-ui-'));
  // tokenKey present but no provider credentials: every cloud provider must be "not configured".
  const service = createApp({ dataDir: directory, secureCookies: false, ai: {}, health: { tokenKey: KEY, publicBaseUrl: 'http://127.0.0.1:3001', pollIntervalMs: 0 },
    healthFetch: async () => { throw new Error('No external transport expected'); } });
  const server: Server = service.app.listen(0, '127.0.0.1');
  await new Promise<void>(ready => server.once('listening', ready));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    service.close();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-health-ui-'));
    rmSync(target, { recursive: true, force: true });
  });
  type Session = { id: string; cookie: string };
  const request = async (method: string, path: string, body?: unknown, session?: Session, extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = { Origin: ORIGIN, 'Content-Type': 'application/json', ...(session ? { Cookie: session.cookie, 'X-Forma-Account': session.id } : {}), ...extra };
    const response = await fetch(base + path, { method, headers, redirect: 'manual', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    let value: any; try { value = JSON.parse(text); } catch { value = null; }
    return { status: response.status, body: value, text };
  };
  return { base, request };
}

test('HEALTH-UI: unconfigured server never fakes a connection and routes are validated and account-isolated', async t => {
  const h = await fixture(t);
  const sessions: { id: string; cookie: string }[] = [];
  for (let i = 0; i < 2; i++) {
    const response = await fetch(h.base + '/api/auth/register', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `ui-${randomUUID()}@example.test`, password: PASSWORD, name: 'Synthetic health UI' }) });
    assert.equal(response.status, 201);
    const cookie = response.headers.getSetCookie().find(value => value.startsWith('forma_session='))?.split(';')[0];
    assert.ok(cookie); sessions.push({ id: (await response.json()).user.id, cookie });
  }
  const [a, b] = sessions;

  const listed = await h.request('GET', '/api/health/connections', undefined, a);
  assert.equal(listed.status, 200);
  for (const item of listed.body.connections as HealthConnection[]) {
    if (item.provider === 'apple-health') { assert.equal(item.status, 'needs_iphone'); continue; }
    assert.equal(item.configured, false); assert.equal(item.status, 'not_configured'); assert.equal(item.connectedAt, null);
  }
  for (const provider of ['whoop', 'oura', 'google-health']) {
    for (const action of ['connect', 'sync']) {
      const result = await h.request('POST', `/api/health/${provider}/${action}`, {}, a);
      assert.equal(result.status, 503); assert.equal(result.body.code, 'HEALTH_NOT_CONFIGURED');
    }
    const callback = await fetch(`${h.base}/integrations/${provider}/callback?state=${'a'.repeat(64)}&code=synthetic`, { headers: { Cookie: `forma_health_oauth_${provider.replaceAll('-', '_')}=${'b'.repeat(64)}` } });
    assert.equal(callback.status, 503);
    const page = await callback.text();
    assert.match(page, /Provider not configured/); assert.match(page, /此平台尚未配置/); assert.doesNotMatch(page, /Health account connected/);
  }
  const still = await h.request('GET', '/api/health/connections', undefined, a);
  assert.ok((still.body.connections as HealthConnection[]).every(item => item.status !== 'connected'));

  // Zod validation on params, bodies and queries.
  assert.equal((await h.request('POST', '/api/health/fitbit/connect', {}, a)).status, 400);
  assert.equal((await h.request('POST', '/api/health/apple-health/connect', {}, a)).status, 400);
  assert.equal((await h.request('POST', '/api/health/oura/disconnect', { owner: b.id }, a)).status, 400);
  assert.equal((await h.request('DELETE', '/api/health/oura/records', {}, a)).status, 400);
  assert.equal((await h.request('GET', '/api/health/records?limit=501', undefined, a)).status, 400);
  assert.equal((await h.request('GET', `/api/health/records?owner=${b.id}`, undefined, a)).status, 400);
  assert.equal((await h.request('POST', '/api/health/apple-health/import', { consent: false, expectedRevision: 0, records: [], deletedIds: [] }, a)).status, 400);

  // Account isolation: synthetic Apple import for A is invisible to B and B cannot act as A.
  const record = { id: 'synthetic-ui-uuid', kind: 'steps', startTime: '2026-11-03T10:00:00Z', endTime: '2026-11-03T11:00:00Z', value: 1234, unit: 'count',
    source: { sourceId: 'com.example.synthetic', sourceName: 'Synthetic watch' }, metadata: {} };
  assert.equal((await h.request('POST', '/api/health/apple-health/import', { consent: true, expectedRevision: 0, records: [record], deletedIds: [] }, a)).status, 200);
  assert.equal((await h.request('GET', '/api/health/records', undefined, a)).body.records.length, 1);
  assert.equal((await h.request('GET', '/api/health/records', undefined, b)).body.records.length, 0);
  assert.ok((await h.request('GET', '/api/health/records', undefined, b, { 'X-Forma-Account': a.id })).status >= 400);
  assert.ok((await h.request('DELETE', '/api/health/apple-health/records', { confirm: true }, b, { 'X-Forma-Account': a.id })).status >= 400);
  assert.equal((await h.request('DELETE', '/api/health/apple-health/records', { confirm: true }, b)).body.deleted, 0);
  assert.equal((await h.request('GET', '/api/health/records', undefined, a)).body.records.length, 1);
  assert.equal((await h.request('GET', '/api/health/connections')).status >= 400, true, 'anonymous access is refused');
});
