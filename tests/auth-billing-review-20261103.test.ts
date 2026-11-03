import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { Store } from '../server/store';
import { BillingService } from '../server/billing/service';
import type { BillingConfig } from '../server/billing/config';

// Independent QA: synthetic local storage, generated keys and injected HTTP only.
const root = resolve(tmpdir()); // Windows review commands explicitly set TEMP/TMP to D:/Forma/cache/tmp.
mkdirSync(root, { recursive: true });
const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const config: BillingConfig = {
  mode: 'sandbox', lagoUrl: 'http://127.0.0.1:3442',
  publicBaseUrl: 'http://127.0.0.1:3001', apiKey: 'independent-fake-key-never-network',
  webhookPublicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
};
const now = Date.parse('2026-11-03T12:00:00.617Z');
const periodStart = '2026-11-03T00:00:00.000Z';
const periodEnd = '2026-12-03T23:59:59.999Z';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const entitlements = (limit: number) => [{ code: 'photo_recognition', privileges: [{ code: 'monthly_limit', value: limit }] }];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(t: TestContext) {
  const dir = mkdtempSync(join(root, 'forma-independent-auth-billing-'));
  const store = new Store(dir);
  const owner = store.createAccount(randomUUID() + '@example.test', 'Independent synthetic QA', 'fake-hash', 'fake-salt').id;
  t.after(() => {
    store.close();
    assert.ok(resolve(dir).startsWith(root + sep));
    rmSync(dir, { recursive: true, force: true });
  });
  return { store, owner };
}

for (const pausedAt of ['customer read', 'customer creation'] as const) test(`QA privacy: deleting during ${pausedAt} cannot leave a recreated remote customer after cleanup`, async t => {
  const { store, owner } = fixture(t);
  const customerReadStarted = deferred<void>(), releaseCustomerRead = deferred<void>();
  let remoteCustomer = false, remoteSubscription = false, deletes = 0;
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input)), path = url.pathname;
    const method = init?.method;
    if (path.includes('/plans/')) {
      const code = path.split('/').at(-1)!;
      return json({ plan: { code, name: code, amount_cents: code === 'free_test' ? 0 : 2000, amount_currency: 'USD', interval: 'monthly', entitlements: entitlements(code === 'free_test' ? 3 : 100) } });
    }
    if (path.includes('/subscriptions/') && method === 'GET') return json({}, 404);
    if (path.endsWith('/customers/' + owner) && method === 'GET') {
      if (pausedAt === 'customer read') {
        customerReadStarted.resolve();
        await releaseCustomerRead.promise;
      }
      return json({}, 404);
    }
    if (path.endsWith('/customers/' + owner) && method === 'DELETE') {
      deletes++; remoteCustomer = false; remoteSubscription = false;
      return new Response(null, { status: 204 });
    }
    if (path.endsWith('/customers') && method === 'POST') {
      if (pausedAt === 'customer creation') {
        customerReadStarted.resolve();
        await releaseCustomerRead.promise;
      }
      remoteCustomer = true;
      return json({ customer: { external_id: owner, billing_configuration: { payment_provider: null } } });
    }
    if (path.endsWith('/subscriptions') && method === 'POST') {
      remoteSubscription = true;
      return json({ subscription: { lago_id: randomUUID(), external_id: 'forma_' + owner, external_customer_id: owner, plan_code: 'free_test', status: 'active', current_billing_period_started_at: periodStart, current_billing_period_ending_at: periodEnd, plan_amount_cents: 0, plan_amount_currency: 'USD', entitlements: entitlements(3) } });
    }
    if (path.endsWith('/invoices')) return json({ invoices: [] });
    if (path.endsWith('/current_usage')) return json({ customer_usage: { charges_usage: [] } });
    throw new Error('Unrecognized synthetic route: ' + method + ' ' + path);
  };
  const service = new BillingService(store, config, transport, () => now);
  t.after(() => service.close());
  const refresh = service.snapshot(owner).then(() => null, error => error);
  await customerReadStarted.promise;
  service.scheduleDeletion(owner);
  store.deleteAccount(owner);
  await service.flush();
  assert.equal(deletes, 1);
  const deletionRetained = !!store.db.prepare('SELECT 1 FROM billing_deletions WHERE external_customer_id=?').get(owner);
  releaseCustomerRead.resolve();
  await refresh;
  await service.flush();
  if (pausedAt === 'customer creation') assert.equal(deletionRetained, true, 'cleanup intent must survive while the external creation request is in flight');
  assert.equal(remoteCustomer, false, 'a stale account refresh recreated an external customer after its deletion receipt was removed');
  assert.equal(remoteSubscription, false, 'a deleted account must not retain an external subscription');
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM billing_memberships').get()?.n, 0);
});

test('QA privacy: deleting while billing is disabled keeps cleanup intent for re-enable and restart', async t => {
  const { store, owner } = fixture(t);
  const neverNetwork: typeof fetch = async () => { throw new Error('Disabled billing must stay offline'); };
  const disabled = new BillingService(store, {}, neverNetwork, () => now);
  disabled.scheduleDeletion(owner);
  store.deleteAccount(owner);
  await disabled.flush();
  disabled.close();
  let deletes = 0;
  const enabled = new BillingService(store, config, async (input, init) => {
    assert.equal(init?.method, 'DELETE');
    assert.equal(new URL(String(input)).pathname, '/api/v1/customers/' + owner);
    deletes++;
    return new Response(null, { status: 204 });
  }, () => now);
  t.after(() => enabled.close());
  await enabled.flush();
  assert.equal(deletes, 1, 'temporarily disabling billing must not discard cleanup for an existing external customer');
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM billing_deletions').get()?.n, 0);
});

test('QA privacy: a timed-out remote creation cannot outlive durable deletion cleanup', async t => {
  const { store, owner } = fixture(t);
  const creationStarted = deferred<void>();
  let remoteCustomer = false, remoteCreationAccepted = false;
  const transport: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname, method = init?.method;
    if (path.includes('/plans/')) {
      const code = path.split('/').at(-1)!;
      return json({ plan: { code, name: code, amount_cents: code === 'free_test' ? 0 : 2000, amount_currency: 'USD', interval: 'monthly', entitlements: entitlements(code === 'free_test' ? 3 : 100) } });
    }
    if (method === 'GET' && (path.includes('/subscriptions/') || path.endsWith('/customers/' + owner))) return json({}, 404);
    if (path.endsWith('/customers') && method === 'POST') {
      remoteCreationAccepted = true;
      creationStarted.resolve();
      // Model a server that accepted the request but continues its transaction
      // after the client's request was aborted. No actual server is contacted.
      return new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(new Error('Synthetic client timeout')), { once: true });
      });
    }
    if (path.endsWith('/customers/' + owner) && method === 'DELETE') {
      remoteCustomer = false;
      return new Response(null, { status: 204 });
    }
    throw new Error('Unrecognized synthetic route: ' + method + ' ' + path);
  };
  const service = new BillingService(store, { ...config, timeoutMs: 50 }, transport, () => now);
  t.after(() => service.close());
  const refresh = service.snapshot(owner).then(() => null, error => error);
  await creationStarted.promise;
  service.scheduleDeletion(owner);
  store.deleteAccount(owner);
  await service.flush();
  await refresh; // The client timed out; local refresh/mutation maps have drained.
  await service.flush();
  assert.equal(remoteCreationAccepted, true);
  remoteCustomer = true; // The previously accepted remote transaction now commits.
  await service.flush();
  assert.equal(remoteCustomer, false, 'a client timeout must not discard cleanup for a remote write whose outcome is still uncertain');
});
