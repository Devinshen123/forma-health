import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { Store } from '../server/store';
import { BillingService } from '../server/billing/service';
import type { BillingConfig } from '../server/billing/config';

// Independent QA: synthetic local storage, generated keys and injected HTTP only.
const root = resolve('D:/Forma/cache/tmp');
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
