import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Store } from './store';
import { HealthService } from './health/service';
import { decrypt, encrypt, type HealthTokens } from './health/ledger';
import { HealthError, healthRecordSchema, resolveHealthConfig } from './health/model';
import { fetchHealthRecords, tokenResponse } from './health/providers';
import type { HealthRecord } from '../src/health';

const NOW = Date.parse('2026-10-23T12:00:00Z');
const fixtureRecord = (patch: Partial<HealthRecord> = {}): HealthRecord => ({ id: 'synthetic-health-uuid', kind: 'steps', startTime: '2026-10-23T10:00:00Z', endTime: '2026-10-23T11:00:00Z', value: 1000, unit: 'count', source: { sourceId: 'com.example.synthetic', sourceName: 'Synthetic watch' }, metadata: {}, ...patch });
function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-health-backend-'));
  const store = new Store(directory), service = new HealthService(store, { pollIntervalMs: 0 }, async () => { throw new Error('No external transport expected'); }, () => NOW);
  const account = store.createAccount('synthetic@example.test', 'Synthetic fixture', 'fixture-not-real-hash', 'fixture-not-real-salt');
  t.after(() => {
    service.close(); store.close();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.includes('forma-health-backend-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return { store, service, account };
}
test('Apple revision invalidates all stale chunks after disconnect or deletion, and replays do not duplicate records', t => {
  const { service, account } = fixture(t);
  const batch = { consent: true, expectedRevision: 0, records: [fixtureRecord()], deletedIds: [] };
  assert.equal(service.importApple(account.id, batch).connection.recordCount, 1);
  assert.equal(service.importApple(account.id, batch).connection.recordCount, 1);
  const disconnected = service.disconnect(account.id, 'apple-health');
  assert.equal(disconnected.syncRevision, 1);
  assert.throws(() => service.importApple(account.id, batch), (error: unknown) => error instanceof HealthError && error.code === 'HEALTH_CONNECTION_CHANGED');
  assert.equal(service.connection(account.id, 'apple-health').status, 'disconnected');
  assert.equal(service.deleteRecords(account.id, 'apple-health').deleted, 1);
  assert.equal(service.connection(account.id, 'apple-health').syncRevision, 2);
  service.deleteRecords(account.id, 'apple-health');
  assert.equal(service.connection(account.id, 'apple-health').syncRevision, 3);
  assert.throws(() => service.importApple(account.id, { ...batch, expectedRevision: 2 }));
  assert.equal(service.importApple(account.id, { ...batch, expectedRevision: 3 }).connection.recordCount, 1);
});

test('a SQL failure rolls back the complete Apple batch including deletes, imports and last successful cursor', t => {
  const { service, store, account } = fixture(t);
  service.importApple(account.id, { consent: true, expectedRevision: 0, records: [fixtureRecord()], deletedIds: [] });
  const before = service.ledger.export(account.id);
  store.db.exec("CREATE TRIGGER synthetic_health_fault BEFORE INSERT ON health_records WHEN NEW.record_id='fail' BEGIN SELECT RAISE(ABORT,'synthetic health failure'); END");
  assert.throws(() => service.importApple(account.id, { consent: true, expectedRevision: 0, records: [fixtureRecord({ id: 'would-have-been-inserted' }), fixtureRecord({ id: 'fail' })], deletedIds: ['synthetic-health-uuid'] }));
  assert.deepEqual(service.ledger.export(account.id), before);
});

test('health records and connection state cascade with their account and never mutate authored facts', t => {
  const { service, store, account } = fixture(t);
  const before = store.snapshot(account.id);
  service.importApple(account.id, { consent: true, expectedRevision: 0, records: [fixtureRecord()], deletedIds: [] });
  assert.deepEqual(store.snapshot(account.id), before);
  store.deleteAccount(account.id);
  for (const table of ['health_connections', 'health_records', 'health_oauth_states']) assert.equal(store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n, 0);
});

test('typed health schema rejects fabricated providers, missing/incorrect units, impossible intervals and unknown-as-zero coercion', () => {
  assert.equal(healthRecordSchema.safeParse(fixtureRecord({ value: null })).success, true);
  assert.equal(healthRecordSchema.safeParse(fixtureRecord({ value: 0 })).success, true);
  for (const patch of [{ provider: 'whoop' }, { userId: 'other-account' }, { unit: 'kcal' }, { value: '0' }, { value: -1 }, { value: 1.5 }, { value: Infinity }, { endTime: '2026-10-22T00:00:00Z' }])
    assert.equal(healthRecordSchema.safeParse({ ...fixtureRecord(), ...patch }).success, false);
  assert.equal(healthRecordSchema.safeParse(fixtureRecord({ kind: 'sleep', unit: 'min', value: 61.1 })).success, false);
});

test('AES-GCM binds tokens to the exact owner/provider and rejects changed ciphertext or key', () => {
  const key = Buffer.alloc(32, 7), other = Buffer.alloc(32, 8), secret = { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh' };
  const value = encrypt(secret, key, 'owner-a:whoop:tokens');
  assert.ok(!value.includes(secret.accessToken)); assert.ok(!value.includes(secret.refreshToken));
  assert.deepEqual(decrypt(value, key, 'owner-a:whoop:tokens'), secret);
  assert.throws(() => decrypt(value, key, 'owner-b:whoop:tokens'));
  assert.throws(() => decrypt(value, other, 'owner-a:whoop:tokens'));
  assert.throws(() => decrypt(value.slice(0, -5) + 'AAAAA', key, 'owner-a:whoop:tokens'));
});

test('provider configuration fails closed without crashing for an invalid key, callback origin or credentials', () => {
  const base = { tokenKey: Buffer.alloc(32, 1).toString('base64'), providers: { whoop: { clientId: 'fixture', clientSecret: 'fixture-secret' } }, pollIntervalMs: 0 };
  assert.ok(resolveHealthConfig(base).providers.whoop);
  assert.equal(resolveHealthConfig({ ...base, tokenKey: 'bad-key' }).providers.whoop, undefined);
  assert.equal(resolveHealthConfig({ ...base, publicBaseUrl: 'http://untrusted.example' }).providers.whoop, undefined);
  assert.equal(resolveHealthConfig({ ...base, publicBaseUrl: 'https://example.com/?callback=evil' }).providers.whoop, undefined);
  assert.equal(resolveHealthConfig({ ...base, providers: { whoop: { clientId: 'fixture', clientSecret: 'line\nbreak' } } }).providers.whoop, undefined);
});

test('refresh rotation retains prior grants only when scope is absent and uses actual narrower scopes when present', () => {
  const previous: HealthTokens = { accessToken: 'old-access', refreshToken: 'old-refresh', scopes: ['read:sleep', 'read:recovery', 'offline'], expiresAt: NOW };
  const raw = { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600, token_type: 'bearer' };
  const refreshed = tokenResponse(raw, 'whoop', NOW, previous);
  assert.deepEqual(refreshed.scopes, previous.scopes); assert.equal(refreshed.refreshToken, 'new-refresh');
  assert.deepEqual(tokenResponse({ ...raw, scope: 'read:sleep offline' }, 'whoop', NOW, previous).scopes, ['read:sleep', 'offline']);
  assert.throws(() => tokenResponse(raw, 'whoop', NOW));
  assert.throws(() => tokenResponse({ ...raw, scope: 'read:profile' }, 'whoop', NOW));
});

test('Oura sleep average heart rate remains an average HR observation and unknown HRV stays unknown', async () => {
  const tokens: HealthTokens = { accessToken: 'fixture', scopes: ['daily'], expiresAt: NOW + 3600000 };
  const results = await fetchHealthRecords('oura', tokens, '2026-10-22T00:00:00Z', '2026-10-23T12:00:00Z', async input => {
    const url = new URL(input);
    return { data: url.pathname.endsWith('/sleep') ? [{ id: 'sleep-1', bedtime_start: '2026-10-22T22:00:00Z', bedtime_end: '2026-10-23T06:00:00Z', total_sleep_duration: 27000, average_heart_rate: 55, average_hrv: null }] : [], next_token: null };
  }, 20);
  assert.equal(results.find(value => value.id.endsWith(':hr'))?.kind, 'heart_rate');
  assert.equal(results.find(value => value.id.endsWith(':hr'))?.metadata.statistic, 'sleep_average');
  assert.equal(results.find(value => value.kind === 'hrv_rmssd')?.value, null);
  assert.equal(results.find(value => value.kind === 'sleep')?.value, 450);
});

test('WHOOP recovery uses a measurement point, preserves update provenance, and open cycles are not fabricated', async () => {
  const tokens: HealthTokens = { accessToken: 'fixture', scopes: ['read:cycles', 'read:recovery'], expiresAt: NOW + 3600000 };
  const results = await fetchHealthRecords('whoop', tokens, '2026-10-22T00:00:00Z', '2026-10-23T12:00:00Z', async input => ({ records: new URL(input).pathname.endsWith('/cycle')
    ? [{ id: 1, start: '2026-10-23T06:00:00Z', end: null }]
    : [{ cycle_id: 1, created_at: '2026-10-23T06:00:00Z', updated_at: '2026-10-23T08:00:00Z', score_state: 'SCORED', score: { recovery_score: 70, resting_heart_rate: 52, hrv_rmssd_milli: 65 } }], next_token: null }), 20);
  assert.equal(results.length, 3);
  for (const result of results) { assert.equal(result.startTime, result.endTime); assert.equal(result.metadata.updatedAt, '2026-10-23T08:00:00.000Z'); }
});
