import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import crypto, { randomUUID } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const originalScrypt = crypto.scrypt;
let interceptScrypt: ((args: unknown[]) => void) | undefined;
// Install before loading app as well as syncing native bindings: tsx may cache
// a transformed import. One forwarding function serves both sequential cases.
const forwardedScrypt = ((...args: unknown[]) => {
  interceptScrypt?.(args);
  Reflect.apply(originalScrypt, crypto, args);
}) as typeof crypto.scrypt;

async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), 10_000);
    })]);
  } finally { clearTimeout(timer); }
}

async function harness(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-delete-session-'));
  const { createApp } = await import('./app');
  const service = createApp({ dataDir: directory, secureCookies: false,
    aiFetch: async () => { throw new Error('External AI is forbidden in this synthetic fixture'); },
  });
  const server = service.app.listen(0, '127.0.0.1');
  await bounded(new Promise<void>((done, reject) => {
    server.once('listening', done); server.once('error', reject);
  }), 'listen');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => {
    server.closeAllConnections();
    await bounded(new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())), 'close');
    service.close();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-delete-session-'));
    rmSync(target, { recursive: true, force: true });
  });
  const request = async (path: string, method = 'GET', cookie?: string, owner?: string, body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api${path}`, { method,
      headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}), ...(owner ? { 'X-Forma-Account': owner } : {}),
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15_000),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { status: response.status, headers: response.headers, bytes,
      body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(bytes.toString()) : null,
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  };
  const register = async (label: string) => {
    const email = `delete-session-${label.toLowerCase()}-${randomUUID()}@example.test`, password = `Synthetic ${label} password ${randomUUID()}`;
    const response = await request('/auth/register', 'POST', undefined, undefined, { email, password, name: `Synthetic ${label}` });
    assert.equal(response.status, 201); assert.ok(response.cookie);
    const owner = response.body.user.id as string, cookie = response.cookie;
    const bytes = Buffer.from(`%PDF-1.7\nSynthetic ${label} original ${randomUUID()}\n%%EOF`);
    const asset = await request('/assets', 'POST', cookie, owner, { name: `synthetic-${label}.pdf`, mime: 'application/pdf', base64: bytes.toString('base64') });
    assert.equal(asset.status, 201);
    const initial = service.store.snapshot(owner);
    const saved = await request('/state', 'PUT', cookie, owner, { revision: initial.revision,
      state: { ...initial.state, reports: [{ id: randomUUID(), name: `Synthetic ${label} retained report`, date: '2026-10-18',
        assetId: asset.body.id, markers: [], extractionStatus: 'manual', createdAt: '2026-10-18T12:00:00.000Z' }] },
    });
    assert.equal(saved.status, 200);
    return { email, password, owner, cookie, assetId: asset.body.id as string, bytes,
      before: service.store.syncSnapshot(owner), file: join(directory, 'uploads', owner, asset.body.id),
    };
  };
  return { service, request, register };
}

// Adapted from independent QA's real HTTP probe: compute the actual scrypt hash,
// then hold only its callback. No fake successful password verification or product hook.
for (const revocation of ['login as B', 'logout'] as const)
  test(`account delete: ${revocation} during real password verification revokes the old request before any deletion or clearing cookie`, async t => {
    let release: (() => void) | undefined;
    let reached: (() => void) | undefined;
    const held = new Promise<void>(done => { reached = done; });
    let armed = true, actualHashMatched = false;
    let pendingDelete: Promise<{ status: number }> | undefined;
    try {
      crypto.scrypt = forwardedScrypt; syncBuiltinESMExports();
      const h = await harness(t), a = await h.register('A'), b = await h.register('B');
      const storedA = h.service.store.accountByEmail(a.email); assert.ok(storedA);
      const tokenA = a.cookie.slice('forma_session='.length);
      interceptScrypt = (args: unknown[]) => {
        if (armed && args[0] === a.password && args[1] === storedA.password_salt) {
          armed = false;
          const callback = args.at(-1) as (error: Error | null, key: Buffer) => void;
          args[args.length - 1] = (error: Error | null, key: Buffer) => {
            actualHashMatched = !error && crypto.timingSafeEqual(key, Buffer.from(storedA.password_hash, 'hex'));
            release = () => { release = undefined; callback(error, key); };
            reached!();
          };
        }
      };
      const deletionRequest = h.request('/account', 'DELETE', a.cookie, a.owner, { password: a.password });
      pendingDelete = deletionRequest;
      await bounded(Promise.race([held, deletionRequest.then(result => {
        throw new Error(`DELETE responded before the real scrypt latch: status ${result.status}`);
      })]), 'real scrypt completion');
      assert.equal(actualHashMatched, true, 'the actual password hash must match before revocation');
      assert.equal(h.service.store.session(tokenA)?.id, a.owner);
      let currentBCookie = b.cookie;
      if (revocation === 'login as B') {
        const login = await h.request('/auth/login', 'POST', a.cookie, undefined, { email: b.email, password: b.password });
        assert.equal(login.status, 200); assert.ok(login.cookie);
        assert.notEqual(login.cookie, a.cookie); currentBCookie = login.cookie;
      } else {
        assert.equal((await h.request('/auth/logout', 'POST', a.cookie, a.owner, {})).status, 200);
      }
      assert.equal(h.service.store.session(tokenA), undefined, 'original session must be revoked before releasing the successful password callback');
      assert.equal(h.service.store.session(currentBCookie.slice('forma_session='.length))?.id, b.owner);
      assert.ok(release); release();
      const deletion = await bounded(deletionRequest, 'DELETE response'); pendingDelete = undefined;
      assert.equal(deletion.status, 401, 'the stale request must not retain deletion authority after its await');
      assert.equal(deletion.body.code, 'ACCOUNT_CHANGED');
      assert.equal(deletion.headers.get('set-cookie'), null, 'a stale DELETE must not clear a newer browser session cookie');
      for (const account of [a, b]) {
        assert.ok(h.service.store.accountByEmail(account.email));
        assert.deepEqual(h.service.store.syncSnapshot(account.owner), account.before);
        assert.ok(h.service.store.asset(account.owner, account.assetId));
        assert.deepEqual(readFileSync(account.file), account.bytes);
      }
      const bState = await h.request('/state', 'GET', currentBCookie, b.owner);
      assert.equal(bState.status, 200); assert.deepEqual(bState.body.state, b.before.state); assert.equal(bState.body.revision, b.before.revision);
      const bOwn = await h.request(`/assets/${b.assetId}`, 'GET', currentBCookie);
      assert.equal(bOwn.status, 200); assert.deepEqual(bOwn.bytes, b.bytes);
      assert.equal((await h.request(`/assets/${a.assetId}`, 'GET', currentBCookie)).status, 404);
      const aLogin = await h.request('/auth/login', 'POST', undefined, undefined, { email: a.email, password: a.password });
      assert.equal(aLogin.status, 200); assert.ok(aLogin.cookie);
      const aOwn = await h.request(`/assets/${a.assetId}`, 'GET', aLogin.cookie);
      assert.equal(aOwn.status, 200); assert.deepEqual(aOwn.bytes, a.bytes);
    } finally {
      release?.();
      interceptScrypt = undefined;
      crypto.scrypt = originalScrypt; syncBuiltinESMExports();
      if (pendingDelete) await Promise.allSettled([bounded(pendingDelete, 'settle DELETE')]);
    }
  });
