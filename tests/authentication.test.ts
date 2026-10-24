import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID, scryptSync, sign, verify, type KeyObject } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import type { Server } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createApp, type AppOptions } from '../server/app';
import type { SignInProvider } from '../src/auth';
import { emptyState } from '../src/types';

// Synthetic identities and locally generated signing keys only. Production JWT
// verification runs unmodified against injected, cryptographically valid JWKS.
const RSA = generateKeyPairSync('rsa', { modulusLength: 2048 });
const OTHER_RSA = generateKeyPairSync('rsa', { modulusLength: 2048 });
const APPLE_CLIENT_KEY = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const APPLE_PEM = APPLE_CLIENT_KEY.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const ORIGIN = 'http://127.0.0.1:5173';
const PUBLIC_URL = 'https://forma.example.test';
const NOW = Date.parse('2026-10-24T18:00:00Z');
const PASSWORD = 'Synthetic-QA-password-2026';
const NEW_PASSWORD = 'Synthetic-QA-new-password-2026';
const PRIVATE = 'QA_PRIVATE_OAUTH_ERROR_MUST_NOT_LEAK';
const ACCESS = 'QA_SYNTHETIC_PROVIDER_ACCESS_SECRET';
const REFRESH = 'QA_SYNTHETIC_PROVIDER_REFRESH_SECRET';
const CLIENT_IDS: Record<SignInProvider, string> = { google: 'google-fixture-client', apple: 'com.forma.service' };
type AuthConfig = NonNullable<AppOptions['auth']>;
type Mail = { to: string; subject: string; text: string };
type Session = { id: string; email: string; cookie: string };
type TokenSpec = { provider: SignInProvider; nonce: string; claims?: Record<string, unknown>; header?: Record<string, unknown>; key?: KeyObject; raw?: string };
type Captured = { url: URL; headers: Headers; body: URLSearchParams; init?: RequestInit };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
function signedToken(spec: TokenSpec, now: number) {
  if (spec.raw !== undefined) return spec.raw;
  const header = encode({ alg: 'RS256', typ: 'JWT', kid: `qa-${spec.provider}-key`, ...spec.header });
  const payload = encode({ iss: spec.provider === 'google' ? 'https://accounts.google.com' : 'https://appleid.apple.com',
    aud: CLIENT_IDS[spec.provider], sub: `qa-${spec.provider}-subject`, nonce: spec.nonce,
    iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 600,
    email: `${spec.provider}-qa@example.test`, email_verified: spec.provider === 'apple' ? 'true' : true,
    name: 'Synthetic provider user', ...spec.claims });
  const input = `${header}.${payload}`;
  return `${input}.${sign('sha256', Buffer.from(input), spec.key ?? RSA.privateKey).toString('base64url')}`;
}
function authConfig(): AuthConfig {
  return { publicBaseUrl: PUBLIC_URL, google: { clientId: CLIENT_IDS.google, clientSecret: 'google-fixture-secret' },
    apple: { clientId: CLIENT_IDS.apple, teamId: 'TEAM123', keyId: 'KEY123', privateKey: APPLE_PEM }, timeoutMs: 1000 };
}
async function fixture(t: TestContext, options: { auth?: AuthConfig; health?: AppOptions['health']; now?: () => number; mailer?: (mail: Mail) => Promise<void>; fetch?: (call: Captured) => Response | undefined | Promise<Response | undefined>; mail?: boolean; seed?: (directory: string) => void } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-independent-auth-qa-'));
  options.seed?.(directory);
  const mail: Mail[] = [], calls: Captured[] = [], codes = new Map<string, TokenSpec>();
  const now = options.now ?? (() => NOW);
  const transport: typeof fetch = async (input, init) => {
    const call = { url: new URL(String(input)), headers: new Headers(init?.headers), body: new URLSearchParams(String(init?.body ?? '')), init };
    calls.push(call);
    if (options.fetch) { const response = await options.fetch(call); if (response) return response; }
    if (call.url.href === 'https://www.googleapis.com/oauth2/v3/certs' || call.url.href === 'https://appleid.apple.com/auth/keys') {
      const provider = call.url.hostname === 'appleid.apple.com' ? 'apple' : 'google';
      return json({ keys: [{ ...RSA.publicKey.export({ format: 'jwk' }), kid: `qa-${provider}-key`, alg: 'RS256', use: 'sig' }] });
    }
    if (call.url.href === 'https://oauth2.googleapis.com/token' || call.url.href === 'https://appleid.apple.com/auth/token') {
      const spec = codes.get(call.body.get('code') ?? '');
      assert.ok(spec, 'production must exchange the exact code from the browser callback');
      return json({ token_type: 'Bearer', access_token: ACCESS, refresh_token: REFRESH, expires_in: 3600, id_token: signedToken(spec, now()) });
    }
    throw new Error(`Unexpected auth destination: ${call.url.origin}${call.url.pathname}`);
  };
  const configured = options.auth ?? authConfig();
  let service: ReturnType<typeof createApp>, server: Server, base = '', active = false;
  const start = async () => {
    service = createApp({ dataDir: directory, secureCookies: false, ai: {}, health: options.health ?? {}, healthFetch: async () => { throw new Error('No live health transport is permitted in auth QA'); }, auth: configured, authFetch: transport,
      authNow: now, ...(options.mail === false ? {} : { authMailer: options.mailer ?? (async message => { mail.push(message); }) }) });
    server = service.app.listen(0, '127.0.0.1');
    await new Promise<void>(ready => server.once('listening', ready));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}`; active = true;
  };
  const stop = async () => {
    if (!active) return;
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    service.close(); active = false;
  };
  await start();
  t.after(async () => {
    await stop(); const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-independent-auth-qa-'));
    rmSync(target, { recursive: true, force: true });
  });
  const request = async (method: string, path: string, body?: unknown, session?: Session, extra: Record<string, string> = {}, raw = false) => {
    const response = await fetch(base + path, { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json',
      ...(session ? { Cookie: session.cookie, 'X-Forma-Account': session.id } : {}), ...extra }, redirect: 'manual',
      ...(body === undefined ? {} : { body: raw ? String(body) : JSON.stringify(body) }) });
    const text = await response.text(); let value: any; try { value = JSON.parse(text); } catch { value = null; }
    return { status: response.status, body: value, text, headers: response.headers };
  };
  const sessionFrom = (response: Awaited<ReturnType<typeof request>>): Session => {
    const cookie = response.headers.getSetCookie().find(value => value.startsWith('forma_session='))?.split(';')[0];
    assert.ok(cookie, response.text); assert.ok(response.body.user?.id);
    return { id: response.body.user.id, email: response.body.user.email, cookie };
  };
  const register = async (email = `qa-${randomUUID()}@example.test`, previous?: Session) => {
    const result = await request('POST', '/api/auth/register', { email, password: PASSWORD, name: 'Synthetic QA user' }, previous);
    assert.equal(result.status, 201, result.text); return sessionFrom(result);
  };
  const login = async (email: string, password = PASSWORD, previous?: Session) => request('POST', '/api/auth/login', { email, password }, previous);
  const startFlow = async (provider: SignInProvider, session?: Session, intent: 'login' | 'link' = 'login', password?: string) => {
    const result = await request('POST', `/api/auth/${provider}/start`, { intent, ...(password === undefined ? {} : { password }) }, session);
    assert.equal(result.status, 200, result.text);
    const authorization = new URL(result.body.authorizationUrl), state = authorization.searchParams.get('state'), nonce = authorization.searchParams.get('nonce');
    assert.ok(state && nonce);
    const cookieHeader = result.headers.getSetCookie().find(value => value.startsWith('forma_auth_oauth=')); assert.ok(cookieHeader);
    return { provider, authorization, state, nonce, binding: cookieHeader.split(';')[0], cookieHeader };
  };
  const callback = async (flow: Awaited<ReturnType<typeof startFlow>>, change: Partial<TokenSpec> = {}, extra: Record<string, string> = {}) => {
    const code = `qa-code-${randomUUID()}`;
    codes.set(code, { provider: flow.provider, nonce: flow.nonce, ...change });
    const fields = { state: flow.state, code };
    return flow.provider === 'apple'
      ? request('POST', '/auth/callback/apple', new URLSearchParams(fields).toString(), undefined, { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://appleid.apple.com', ...extra }, true)
      : request('GET', `/auth/callback/google?${new URLSearchParams(fields)}`, undefined, undefined, extra);
  };
  const ticketFrom = (result: Awaited<ReturnType<typeof request>>) => {
    assert.equal(result.status, 303, result.text);
    const location = new URL(result.headers.get('location')!, PUBLIC_URL), fragment = new URLSearchParams(location.hash.slice(1));
    assert.equal(location.origin, PUBLIC_URL); assert.equal(fragment.get('auth'), 'oauth', result.text);
    const ticket = fragment.get('ticket'); assert.ok(ticket); return ticket;
  };
  const complete = (flow: Awaited<ReturnType<typeof startFlow>>, ticket: string, session?: Session, extra: Record<string, string> = {}) =>
    request('POST', '/api/auth/oauth/complete', { ticket }, session, { Cookie: `${flow.binding}${session ? `; ${session.cookie}` : ''}`, ...extra });
  const social = async (provider: SignInProvider, claims: Record<string, unknown> = {}) => {
    const flow = await startFlow(provider); const ticket = ticketFrom(await callback(flow, { claims }));
    const result = await complete(flow, ticket); assert.equal(result.status, 200, result.text); return sessionFrom(result);
  };
  const account = async (session: Session) => {
    const response = await request('GET', '/api/auth/account', undefined, session);
    assert.equal(response.status, 200, response.text); return response.body;
  };
  const authRows = () => {
    const tables = service.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'auth_%'").all();
    return tables.map(row => {
      assert.match(String(row.name), /^auth_[a-z_]+$/);
      return { table: row.name, rows: service.store.db.prepare(`SELECT * FROM ${row.name}`).all() };
    });
  };
  return { request, register, login, sessionFrom, startFlow, callback, ticketFrom, complete, social, account, authRows, mail, calls, codes,
    restart: async () => { await stop(); await start(); }, get service() { return service; } };
}
function noSecrets(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of [PRIVATE, ACCESS, REFRESH, 'google-fixture-secret', APPLE_PEM]) assert.ok(!text.includes(secret), `private auth material leaked: ${secret.slice(0, 35)}`);
}
function mailToken(message: Mail, kind: 'reset' | 'verify') {
  const match = message.text.match(/https?:\/\/\S+/); assert.ok(match);
  const url = new URL(match[0]), fragment = new URLSearchParams(url.hash.slice(1));
  assert.equal(url.origin, PUBLIC_URL); assert.equal(fragment.get('auth'), kind);
  assert.equal(url.search, ''); const token = fragment.get('token'); assert.ok(token); return token;
}
async function sentMail(h: Awaited<ReturnType<typeof fixture>>, kind: 'reset' | 'verify', to: string) {
  for (let i = 0; i < 100; i++) {
    const result = [...h.mail].reverse().find(message => message.to === to && message.text.includes(`#auth=${kind}`));
    if (result) return result;
    await new Promise(done => setTimeout(done, 5));
  }
  throw new Error(`No synthetic ${kind} message was accepted`);
}

test('AUTH-QA: legacy password registration/login stays compatible and missing providers or mail fail truthfully', async t => {
  const h = await fixture(t, { auth: {}, mail: false });
  const options = await h.request('GET', '/api/auth/options'); assert.equal(options.status, 200);
  assert.equal(options.body.email.available, true); assert.equal(options.body.email.mailAvailable, false);
  assert.equal(options.body.providers.google.available, false); assert.equal(options.body.providers.apple.available, false);
  assert.equal((await h.request('GET', '/api/auth/account')).status, 401);
  const owner = await h.register(); assert.equal((await h.login(owner.email)).status, 200);
  assert.deepEqual((await h.account(owner)).providers, []);
  assert.equal((await h.account(owner)).hasPassword, true);
  assert.equal((await h.request('POST', '/api/auth/google/start', { intent: 'login' })).status, 503);
  for (const email of [owner.email, 'unknown-qa@example.test']) {
    const result = await h.request('POST', '/api/auth/forgot-password', { email });
    assert.equal(result.status, 503); assert.equal(result.body.code, 'AUTH_MAIL_NOT_CONFIGURED');
  }
  assert.equal(h.calls.length, 0);
});

test('AUTH-QA: verification links contain fragment tokens, store hashes, require explicit consumption and are single use', async t => {
  const h = await fixture(t); const owner = await h.register();
  assert.equal((await h.account(owner)).emailVerified, false);
  const sent = await h.request('POST', '/api/auth/send-verification', {}, owner); assert.ok(sent.status >= 200 && sent.status < 300, sent.text);
  const token = mailToken(await sentMail(h, 'verify', owner.email), 'verify');
  assert.ok(!JSON.stringify(h.authRows()).includes(token), 'raw email tokens must never be stored');
  assert.ok(JSON.stringify(h.authRows()).includes(createHash('sha256').update(token).digest('hex')));
  assert.notEqual((await h.request('GET', `/api/auth/verify-email?token=${token}`)).status, 200);
  assert.equal((await h.account(owner)).emailVerified, false, 'mail link GET or prefetch must not consume verification');
  assert.equal((await h.request('POST', '/api/auth/reset-password', { token, password: NEW_PASSWORD })).status, 400, 'verification tokens cannot reset a password');
  assert.equal((await h.request('POST', '/api/auth/verify-email', { token })).status, 200);
  assert.equal((await h.account(owner)).emailVerified, true);
  assert.equal((await h.request('POST', '/api/auth/verify-email', { token })).status, 400);
  noSecrets((await h.request('GET', '/api/export', undefined, owner)).text);
});

test('AUTH-QA: recovery is non-enumerating, single use and revokes all old sessions after reset', async t => {
  const h = await fixture(t); const owner = await h.register();
  const second = h.sessionFrom(await h.login(owner.email));
  const known = await h.request('POST', '/api/auth/forgot-password', { email: owner.email });
  const unknown = await h.request('POST', '/api/auth/forgot-password', { email: 'qa-unknown@example.test' });
  assert.equal(known.status, 202); assert.equal(unknown.status, known.status); assert.deepEqual(unknown.body, known.body);
  const token = mailToken(await sentMail(h, 'reset', owner.email), 'reset');
  assert.ok(!h.mail.some(message => message.to === 'qa-unknown@example.test'));
  assert.ok(!JSON.stringify(h.authRows()).includes(token));
  const result = await h.request('POST', '/api/auth/reset-password', { token, password: NEW_PASSWORD }); assert.equal(result.status, 200, result.text);
  assert.equal((await h.request('GET', '/api/state', undefined, owner)).status, 401);
  assert.equal((await h.request('GET', '/api/state', undefined, second)).status, 401);
  assert.equal((await h.login(owner.email, PASSWORD)).status, 401);
  assert.equal((await h.login(owner.email, NEW_PASSWORD)).status, 200);
  const resetOwner = h.sessionFrom(await h.login(owner.email, NEW_PASSWORD));
  assert.equal((await h.account(resetOwner)).emailVerified, true, 'a valid email-delivered reset proves control of that email');
  assert.equal((await h.request('POST', '/api/auth/reset-password', { token, password: 'A-second-new-password-2026' })).status, 400);
});

test('AUTH-QA: configured mail outages preserve recovery anti-enumeration and do not expose transport errors', async t => {
  const h = await fixture(t, { mailer: async () => { throw new Error(PRIVATE); } }); const owner = await h.register();
  const known = await h.request('POST', '/api/auth/forgot-password', { email: owner.email });
  const unknown = await h.request('POST', '/api/auth/forgot-password', { email: 'qa-unknown@example.test' });
  assert.equal(known.status, 202); assert.equal(unknown.status, known.status); assert.deepEqual(unknown.body, known.body);
  noSecrets(known.text); noSecrets(unknown.text);
});

test('AUTH-QA: expired reset and verification tokens cannot change credentials or account verification', async t => {
  let now = NOW; const h = await fixture(t, { now: () => now }); const owner = await h.register();
  await h.request('POST', '/api/auth/forgot-password', { email: owner.email });
  const reset = mailToken(await sentMail(h, 'reset', owner.email), 'reset');
  await h.request('POST', '/api/auth/send-verification', {}, owner);
  const verification = mailToken(await sentMail(h, 'verify', owner.email), 'verify');
  now += 25 * 60 * 60_000;
  assert.equal((await h.request('POST', '/api/auth/reset-password', { token: reset, password: NEW_PASSWORD })).status, 400);
  assert.equal((await h.request('POST', '/api/auth/verify-email', { token: verification })).status, 400);
  assert.equal((await h.account(owner)).emailVerified, false);
  assert.equal((await h.login(owner.email)).status, 200);
});

test('AUTH-QA: Google code exchange verifies actual RSA JWS, nonce and PKCE before issuing a strict session', async t => {
  const h = await fixture(t); const flow = await h.startFlow('google');
  assert.equal(flow.authorization.origin, 'https://accounts.google.com');
  assert.equal(flow.authorization.searchParams.get('response_type'), 'code');
  assert.equal(flow.authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.match(flow.cookieHeader, /HttpOnly/i); assert.match(flow.cookieHeader, /SameSite=Strict/i);
  assert.match(flow.cookieHeader, /Path=\/api\/auth\/oauth\/complete/i);
  const pending = JSON.stringify(h.authRows()); assert.ok(!pending.includes(flow.state)); assert.ok(!pending.includes(flow.nonce)); assert.ok(!pending.includes(flow.binding.split('=')[1]));
  const callback = await h.callback(flow); assert.ok(!callback.headers.getSetCookie().some(cookie => cookie.startsWith('forma_session=')));
  const ticket = h.ticketFrom(callback); noSecrets(callback.headers.get('location'));
  const result = await h.complete(flow, ticket); assert.equal(result.status, 200, result.text);
  const owner = h.sessionFrom(result), security = await h.account(owner);
  assert.equal(security.emailVerified, true); assert.equal(security.hasPassword, false); assert.deepEqual(security.providers, ['google']);
  assert.match(result.headers.getSetCookie().find(value => value.startsWith('forma_session='))!, /SameSite=Strict/i);
  const exchange = h.calls.find(call => call.url.href === 'https://oauth2.googleapis.com/token'); assert.ok(exchange);
  assert.equal(exchange.body.get('redirect_uri'), `${PUBLIC_URL}/auth/callback/google`);
  assert.equal(createHash('sha256').update(exchange.body.get('code_verifier')!).digest('base64url'), flow.authorization.searchParams.get('code_challenge'));
  assert.ok(h.calls.some(call => call.url.href === 'https://www.googleapis.com/oauth2/v3/certs'));
  noSecrets(result.body); noSecrets((await h.request('GET', '/api/export', undefined, owner)).text); noSecrets(h.authRows());
});

test('AUTH-QA: Apple cross-site form_post without cookies only creates a ticket; same-origin bound completion verifies the client secret and identity', async t => {
  const h = await fixture(t); const flow = await h.startFlow('apple');
  assert.equal(flow.authorization.origin, 'https://appleid.apple.com');
  assert.equal(flow.authorization.searchParams.get('response_mode'), 'form_post');
  const callback = await h.callback(flow); const ticket = h.ticketFrom(callback);
  assert.ok(!callback.headers.getSetCookie().some(cookie => cookie.startsWith('forma_session=')));
  assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get()?.n, 0, 'a cross-site callback lacking its browser cookie must not create an account or authenticate');
  const missingBinding = await h.request('POST', '/api/auth/oauth/complete', { ticket }); assert.ok(missingBinding.status >= 400);
  const completed = await h.complete(flow, ticket); assert.equal(completed.status, 200, completed.text);
  const owner = h.sessionFrom(completed); assert.equal(owner.email, 'apple-qa@example.test');
  assert.deepEqual((await h.account(owner)).providers, ['apple']);
  const exchange = h.calls.find(call => call.url.href === 'https://appleid.apple.com/auth/token'); assert.ok(exchange);
  const secret = exchange.body.get('client_secret')!; const [header, payload, signature] = secret.split('.');
  assert.equal(JSON.parse(Buffer.from(header, 'base64url').toString()).alg, 'ES256');
  assert.equal(JSON.parse(Buffer.from(header, 'base64url').toString()).kid, 'KEY123');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  assert.equal(claims.iss, 'TEAM123'); assert.equal(claims.sub, CLIENT_IDS.apple); assert.equal(claims.aud, 'https://appleid.apple.com');
  assert.ok(verify('sha256', Buffer.from(`${header}.${payload}`), { key: APPLE_CLIENT_KEY.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')));
  noSecrets(completed.text); noSecrets(h.authRows());
});

test('AUTH-QA: signed tokens with invalid keys or claims cannot create an identity or session', async t => {
  const cases: Array<[string, Partial<TokenSpec>]> = [
    ['wrong signature', { key: OTHER_RSA.privateKey }], ['unknown kid', { header: { kid: 'qa-unknown-key' } }],
    ['wrong issuer', { claims: { iss: 'https://qa-attacker.invalid' } }], ['wrong audience', { claims: { aud: 'another-client' } }],
    ['wrong nonce', { claims: { nonce: 'qa-not-the-nonce' } }], ['missing nonce', { claims: { nonce: undefined } }],
    ['expired', { claims: { exp: Math.floor(NOW / 1000) - 600 } }], ['missing expiry', { claims: { exp: undefined } }],
    ['future issued-at', { claims: { iat: Math.floor(NOW / 1000) + 3600 } }], ['unverified email', { claims: { email_verified: false } }],
    ['algorithm confusion', { header: { alg: 'HS256' } }], ['empty subject', { claims: { sub: '' } }],
    ['multiple audiences wrong presenter', { claims: { aud: [CLIENT_IDS.google, 'another-client'], azp: 'another-client' } }],
    ['unknown critical header', { header: { crit: ['qa-unsupported-extension'] } }],
  ];
  for (const [name, change] of cases) await t.test(name, async child => {
    const h = await fixture(child); const flow = await h.startFlow('google');
    const callback = await h.callback(flow, change);
    const location = callback.headers.get('location');
    if (location && new URLSearchParams(new URL(location, PUBLIC_URL).hash.slice(1)).get('auth') === 'oauth') {
      const response = await h.complete(flow, h.ticketFrom(callback));
      assert.ok(response.status >= 400, name); noSecrets(response.text);
      assert.ok(!response.headers.getSetCookie().some(cookie => cookie.startsWith('forma_session=')));
    } else {
      assert.ok(callback.status >= 400 || location && new URLSearchParams(new URL(location, PUBLIC_URL).hash.slice(1)).get('auth') === 'error', name);
      noSecrets(callback.text); noSecrets(location);
      assert.ok(!callback.headers.getSetCookie().some(cookie => cookie.startsWith('forma_session=')));
    }
    assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get()?.n, 0);
  });
});

test('AUTH-QA: callback state and completion tickets are single-use, browser-bound and expire', async t => {
  let now = NOW; const h = await fixture(t, { now: () => now });
  const flow = await h.startFlow('google'); const callback = await h.callback(flow); const ticket = h.ticketFrom(callback);
  const replayCallback = await h.callback(flow);
  assert.ok(replayCallback.status >= 400 || !replayCallback.headers.get('location')?.includes('auth=oauth'), 'the same state cannot mint a second completion ticket');
  assert.ok((await h.request('POST', '/api/auth/oauth/complete', { ticket }, undefined, { Cookie: 'forma_auth_oauth=' + 'f'.repeat(64) })).status >= 400);
  const successfulFlow = await h.startFlow('google'); const validTicket = h.ticketFrom(await h.callback(successfulFlow));
  const result = await h.complete(successfulFlow, validTicket); assert.equal(result.status, 200, result.text);
  assert.ok((await h.complete(successfulFlow, validTicket)).status >= 400);
  const expiredFlow = await h.startFlow('google'); const expiredTicket = h.ticketFrom(await h.callback(expiredFlow));
  now += 3 * 60_000;
  assert.ok((await h.complete(expiredFlow, expiredTicket)).status >= 400);
  const stateFlow = await h.startFlow('google'); now += 11 * 60_000;
  const expiredState = await h.callback(stateFlow);
  assert.ok(expiredState.status >= 400 || !expiredState.headers.get('location')?.includes('auth=oauth'));
  noSecrets(JSON.stringify(h.authRows()));
});

test('AUTH-QA: matching old local email cannot silently merge; linking needs account binding and password confirmation', async t => {
  const h = await fixture(t); const owner = await h.register('google-qa@example.test'); const b = await h.register();
  const login = await h.startFlow('google'); const ticket = h.ticketFrom(await h.callback(login));
  const conflict = await h.complete(login, ticket);
  assert.equal(conflict.status, 409); assert.equal(conflict.body.code, 'AUTH_ACCOUNT_EXISTS');
  assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get()?.n, 2);
  assert.deepEqual((await h.account(owner)).providers, []);
  assert.ok((await h.request('POST', '/api/auth/google/start', { intent: 'link' }, owner)).status >= 400);
  assert.ok((await h.request('POST', '/api/auth/google/start', { intent: 'link', password: 'wrong-password-value' }, owner)).status >= 400);
  assert.equal((await h.request('POST', '/api/auth/google/start', { intent: 'link', password: PASSWORD }, owner, { 'X-Forma-Account': b.id })).status, 401);
  const link = await h.startFlow('google', owner, 'link', PASSWORD);
  const linked = await h.complete(link, h.ticketFrom(await h.callback(link)), owner);
  assert.equal(linked.status, 200, linked.text); assert.equal(linked.body.user.id, owner.id);
  const current = linked.headers.getSetCookie().some(cookie => cookie.startsWith('forma_session=')) ? h.sessionFrom(linked) : owner;
  assert.deepEqual((await h.account(current)).providers, ['google']);
  assert.deepEqual((await h.account(b)).providers, []);
});

test('AUTH-QA: provider subject is stable across email changes and an already-linked identity cannot be stolen by another account', async t => {
  const h = await fixture(t);
  const social = await h.social('google', { sub: 'qa-stable-subject', email: 'first-qa@example.test' });
  const again = await h.social('google', { sub: 'qa-stable-subject', email: 'changed-qa@example.test' });
  assert.equal(again.id, social.id); assert.equal(again.email, social.email);
  const local = await h.register(); const link = await h.startFlow('google', local, 'link', PASSWORD);
  const ticket = h.ticketFrom(await h.callback(link, { claims: { sub: 'qa-stable-subject', email: 'changed-qa@example.test' } }));
  const result = await h.complete(link, ticket, local); assert.equal(result.status, 409);
  assert.equal(result.body.code, 'AUTH_IDENTITY_IN_USE');
  assert.deepEqual((await h.account(local)).providers, []);
  assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get()?.n, 2);
});

test('AUTH-QA: linking a different provider email does not verify the existing primary email', async t => {
  const h = await fixture(t); const owner = await h.register('local-primary@example.test');
  const flow = await h.startFlow('google', owner, 'link', PASSWORD);
  const result = await h.complete(flow, h.ticketFrom(await h.callback(flow, { claims: { email: 'another-provider@example.test' } })), owner);
  assert.equal(result.status, 200, result.text);
  const current = result.headers.getSetCookie().some(cookie => cookie.startsWith('forma_session=')) ? h.sessionFrom(result) : owner;
  assert.equal(current.email, owner.email); assert.equal((await h.account(current)).emailVerified, false);
});

test('AUTH-QA: logout and account switch between start/callback/complete invalidate pending linking', async t => {
  const h = await fixture(t); const a = await h.register(), b = await h.register();
  const link = await h.startFlow('google', a, 'link', PASSWORD); const ticket = h.ticketFrom(await h.callback(link));
  assert.equal((await h.request('POST', '/api/auth/logout', {}, a)).status, 200);
  assert.ok((await h.complete(link, ticket, a)).status >= 400);
  const again = h.sessionFrom(await h.login(a.email));
  const switchFlow = await h.startFlow('google', again, 'link', PASSWORD), switchTicket = h.ticketFrom(await h.callback(switchFlow));
  const switched = h.sessionFrom(await h.login(b.email, PASSWORD, again));
  assert.ok((await h.complete(switchFlow, switchTicket, switched)).status >= 400);
  assert.deepEqual((await h.account(switched)).providers, []);
  assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM auth_identities').get()?.n, 0, 'revoked links cannot commit a verified provider identity');
});

test('AUTH-QA: password changes require the current password, rotate this session and revoke other sessions', async t => {
  const h = await fixture(t); const first = await h.register(), second = h.sessionFrom(await h.login(first.email));
  const bad = await h.request('POST', '/api/auth/password', { currentPassword: 'not-the-password', password: NEW_PASSWORD }, first);
  assert.ok(bad.status >= 400); assert.equal((await h.request('GET', '/api/state', undefined, second)).status, 200);
  const changed = await h.request('POST', '/api/auth/password', { currentPassword: PASSWORD, password: NEW_PASSWORD }, first);
  assert.equal(changed.status, 200, changed.text); const current = h.sessionFrom(changed);
  assert.notEqual(current.cookie, first.cookie);
  assert.equal((await h.request('GET', '/api/state', undefined, first)).status, 401);
  assert.equal((await h.request('GET', '/api/state', undefined, second)).status, 401);
  assert.equal((await h.request('GET', '/api/state', undefined, current)).status, 200);
  assert.equal((await h.account(current)).emailVerified, false, 'current-password confirmation is not proof that the user controls an unverified email');
  assert.equal((await h.login(first.email)).status, 401);
  assert.equal((await h.login(first.email, NEW_PASSWORD)).status, 200);
});

test('AUTH-QA: simultaneous reset requests consume one token exactly once', async t => {
  const h = await fixture(t); const owner = await h.register();
  await h.request('POST', '/api/auth/forgot-password', { email: owner.email });
  const token = mailToken(await sentMail(h, 'reset', owner.email), 'reset');
  const results = await Promise.all([NEW_PASSWORD, 'Another-new-QA-password-2026'].map(password => h.request('POST', '/api/auth/reset-password', { token, password })));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
});

test('AUTH-QA: password reset revokes pending login/link and health OAuth authorization state', async t => {
  const h = await fixture(t, { health: { tokenKey: Buffer.alloc(32, 19).toString('base64'), publicBaseUrl: PUBLIC_URL,
    providers: { whoop: { clientId: 'qa-whoop-client', clientSecret: 'qa-whoop-secret' } }, pollIntervalMs: 0 } });
  const owner = await h.register(); const flow = await h.startFlow('google', owner, 'link', PASSWORD);
  const ticket = h.ticketFrom(await h.callback(flow));
  const healthStart = await h.request('POST', '/api/health/whoop/connect', {}, owner); assert.equal(healthStart.status, 200, healthStart.text);
  assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM health_oauth_states WHERE owner_id=?').get(owner.id)?.n, 1);
  await h.request('POST', '/api/auth/forgot-password', { email: owner.email });
  const token = mailToken(await sentMail(h, 'reset', owner.email), 'reset');
  assert.equal((await h.request('POST', '/api/auth/reset-password', { token, password: NEW_PASSWORD })).status, 200);
  assert.ok((await h.complete(flow, ticket, owner)).status >= 400);
  assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM health_oauth_states WHERE owner_id=?').get(owner.id)?.n, 0);
  assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE owner_id=?').get(owner.id)?.n, 0);
});

test('AUTH-QA: a stale social-only session cannot set its first password; fresh provider authentication can', async t => {
  let now = NOW; const h = await fixture(t, { now: () => now }); const owner = await h.social('google');
  now += 16 * 60_000;
  const stale = await h.request('POST', '/api/auth/password', { password: NEW_PASSWORD }, owner);
  assert.equal(stale.status, 401); assert.equal(stale.body.code, 'AUTH_REAUTH_REQUIRED');
  assert.equal((await h.account(owner)).hasPassword, false);
  const fresh = await h.social('google'); assert.equal(fresh.id, owner.id);
  const result = await h.request('POST', '/api/auth/password', { password: NEW_PASSWORD }, fresh);
  assert.equal(result.status, 200, result.text);
  const current = h.sessionFrom(result); assert.equal((await h.account(current)).hasPassword, true);
  assert.equal((await h.login(owner.email, NEW_PASSWORD)).status, 200);
});

test('AUTH-QA: revocation during provider token exchange prevents committing a pending account link', async t => {
  let release!: () => void, announce!: () => void, context!: TokenSpec;
  const reached = new Promise<void>(done => { announce = done; });
  const h = await fixture(t, { fetch: async call => {
    if (call.url.href !== 'https://oauth2.googleapis.com/token') return undefined;
    announce();
    return await new Promise<Response>(done => { release = () => done(json({ id_token: signedToken(context, NOW), access_token: ACCESS })); });
  } });
  const owner = await h.register(); const flow = await h.startFlow('google', owner, 'link', PASSWORD);
  context = { provider: 'google', nonce: flow.nonce };
  const pending = h.callback(flow);
  await Promise.race([reached, pending.then(result => { throw new Error(`Token exchange was not reached: ${result.status}`); })]);
  assert.equal((await h.request('POST', '/api/auth/logout', {}, owner)).status, 200);
  release();
  const result = await pending;
  assert.ok(result.status >= 400 || !result.headers.get('location')?.includes('auth=oauth'));
  assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM auth_identities').get()?.n, 0);
  noSecrets(result.text); noSecrets(result.headers.get('location'));
});

test('AUTH-QA: auth completion retains Origin and JSON protection while Apple alone accepts cross-site form POST', async t => {
  const h = await fixture(t); const flow = await h.startFlow('google'); const ticket = h.ticketFrom(await h.callback(flow));
  assert.equal((await h.complete(flow, ticket, undefined, { Origin: 'https://qa-attacker.invalid' })).status, 403);
  assert.equal((await h.request('POST', '/api/auth/oauth/complete', new URLSearchParams({ ticket }).toString(), undefined,
    { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: flow.binding }, true)).status, 415);
  assert.equal((await h.complete(flow, ticket)).status, 200);
  assert.equal((await h.request('POST', '/api/auth/forgot-password', { email: 'qa@example.test' }, undefined, { Origin: 'https://qa-attacker.invalid' })).status, 403);
  const oversized = await h.request('POST', '/auth/callback/apple', new URLSearchParams({ state: 'f'.repeat(64), code: 'x'.repeat(100_000) }).toString(), undefined,
    { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://appleid.apple.com' }, true);
  assert.equal(oversized.status, 413);
});

test('AUTH-QA: unknown token keys never follow attacker-controlled JWKS URLs and provider outages fail safely', async t => {
  for (const mode of ['embedded-key', 'oversized', 'timeout'] as const) await t.test(mode, { timeout: 5000 }, async child => {
    let cancelled = false;
    const h = await fixture(child, { auth: { ...authConfig(), timeoutMs: 30 }, fetch: async call => {
      if (mode === 'oversized' && call.url.href === 'https://www.googleapis.com/oauth2/v3/certs')
        return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 200, headers: { 'Content-Length': String(128 * 1024 + 1) } });
      if (mode === 'timeout' && call.url.href === 'https://oauth2.googleapis.com/token') return await new Promise<Response>(() => {});
      return undefined;
    } });
    const flow = await h.startFlow('google');
    const change: Partial<TokenSpec> = mode === 'embedded-key' ? { key: OTHER_RSA.privateKey, header: { jku: 'https://qa-attacker.invalid/keys', jwk: OTHER_RSA.publicKey.export({ format: 'jwk' }) } } : {};
    const started = Date.now(), callback = await h.callback(flow, change);
    assert.ok(callback.status >= 400 || !callback.headers.get('location')?.includes('auth=oauth'));
    assert.ok(Date.now() - started < 2000);
    assert.ok(h.calls.every(call => !call.url.hostname.includes('attacker')));
    assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get()?.n, 0);
    if (mode === 'oversized') assert.equal(cancelled, true);
    noSecrets(callback.text); noSecrets(callback.headers.get('location'));
  });
});

test('AUTH-QA: verification tokens, provider identities and pending auth state are private and cascade on account deletion', async t => {
  const h = await fixture(t); const owner = await h.social('google', { sub: 'qa-delete-private-subject' });
  const password = await h.request('POST', '/api/auth/password', { password: NEW_PASSWORD }, owner); assert.equal(password.status, 200, password.text);
  const current = h.sessionFrom(password);
  await h.request('POST', '/api/auth/send-verification', {}, current);
  const token = mailToken(await sentMail(h, 'verify', owner.email), 'verify');
  await h.startFlow('apple', current, 'link', NEW_PASSWORD);
  const exported = await h.request('GET', '/api/export', undefined, current); assert.equal(exported.status, 200);
  noSecrets(exported.text); assert.ok(!exported.text.includes(token)); assert.ok(!exported.text.includes('qa-delete-private-subject'));
  const result = await h.request('DELETE', '/api/account', { password: NEW_PASSWORD }, current); assert.equal(result.status, 200, result.text);
  assert.ok(!JSON.stringify(h.authRows()).includes(owner.id));
  assert.deepEqual(h.service.store.db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal((await h.request('POST', '/api/auth/verify-email', { token })).status, 400);
});

test('AUTH-QA: password reset invalidates anonymous pending sign-in for an already linked subject, even in the same clock tick', async t => {
  for (const phase of ['token-in-flight', 'ticket-ready'] as const) await t.test(phase, async child => {
    let block = false, release!: () => void, announce!: () => void, context!: TokenSpec;
    const reached = new Promise<void>(done => { announce = done; });
    const h = await fixture(child, { fetch: async call => {
      if (!block || call.url.href !== 'https://oauth2.googleapis.com/token') return undefined;
      announce();
      return await new Promise<Response>(done => { release = () => done(json({ id_token: signedToken(context, NOW) })); });
    } });
    const owner = await h.social('google');
    await h.request('POST', '/api/auth/forgot-password', { email: owner.email });
    const resetToken = mailToken(await sentMail(h, 'reset', owner.email), 'reset');
    const flow = await h.startFlow('google'); context = { provider: 'google', nonce: flow.nonce };
    block = phase === 'token-in-flight';
    const pending = h.callback(flow);
    let ready: Awaited<ReturnType<typeof h.callback>> | undefined;
    if (block) await Promise.race([reached, pending.then(result => { throw new Error(`Token exchange was not reached: ${result.status}`); })]);
    else ready = await pending;
    assert.equal((await h.request('POST', '/api/auth/reset-password', { token: resetToken, password: NEW_PASSWORD })).status, 200);
    if (block) { block = false; release(); ready = await pending; }
    assert.ok(ready);
    const location = ready.headers.get('location');
    if (location && new URLSearchParams(new URL(location, PUBLIC_URL).hash.slice(1)).get('auth') === 'oauth')
      assert.ok((await h.complete(flow, h.ticketFrom(ready))).status >= 400, 'a pre-reset anonymous sign-in cannot mint a fresh session afterward');
    else assert.ok(ready.status >= 400 || location && new URLSearchParams(new URL(location, PUBLIC_URL).hash.slice(1)).get('auth') === 'error');
    assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE owner_id=?').get(owner.id)?.n, 0);
    assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get()?.n, 1);
    const fresh = await h.social('google'); assert.equal(fresh.id, owner.id, 'a newly initiated post-reset provider sign-in must still work');
  });
});

test('AUTH-QA: email tokens and single-use state remain durable across process restarts', async t => {
  const h = await fixture(t); const owner = await h.register();
  await h.request('POST', '/api/auth/send-verification', {}, owner);
  const verifyToken = mailToken(await sentMail(h, 'verify', owner.email), 'verify');
  await h.request('POST', '/api/auth/forgot-password', { email: owner.email });
  const resetToken = mailToken(await sentMail(h, 'reset', owner.email), 'reset');
  await h.restart();
  assert.equal((await h.request('POST', '/api/auth/verify-email', { token: verifyToken })).status, 200);
  assert.equal((await h.request('POST', '/api/auth/reset-password', { token: resetToken, password: NEW_PASSWORD })).status, 200);
  await h.restart();
  assert.equal((await h.request('POST', '/api/auth/verify-email', { token: verifyToken })).status, 400);
  assert.equal((await h.request('POST', '/api/auth/reset-password', { token: resetToken, password: PASSWORD })).status, 400);
  assert.equal((await h.login(owner.email, NEW_PASSWORD)).status, 200);
});

test('AUTH-QA: recovery rate limits are durable and symmetric for known and unknown email addresses', async t => {
  const h = await fixture(t); const owner = await h.register();
  for (const email of [owner.email, 'qa-rate-unknown@example.test']) {
    for (let i = 0; i < 3; i++) assert.equal((await h.request('POST', '/api/auth/forgot-password', { email })).status, 202);
    const limited = await h.request('POST', '/api/auth/forgot-password', { email });
    assert.equal(limited.status, 429); assert.equal(limited.body.code, 'AUTH_RATE_LIMIT');
  }
  await h.restart();
  for (const email of [owner.email, 'qa-rate-unknown@example.test']) assert.equal((await h.request('POST', '/api/auth/forgot-password', { email })).status, 429);
});

test('AUTH-QA: an anonymous ready ticket for a deleted identity cannot silently register that account again', async t => {
  const h = await fixture(t);
  const claims = { sub: 'qa-deleted-identity', email: 'qa-deleted-identity@example.test' };
  const owner = await h.social('google', claims);
  const password = await h.request('POST', '/api/auth/password', { password: NEW_PASSWORD }, owner);
  assert.equal(password.status, 200); const current = h.sessionFrom(password);
  const flow = await h.startFlow('google'), ticket = h.ticketFrom(await h.callback(flow, { claims }));
  assert.equal((await h.request('DELETE', '/api/account', { password: NEW_PASSWORD }, current)).status, 200);
  const stale = await h.complete(flow, ticket);
  assert.ok(stale.status >= 400, 'an existing-account ticket must stay bound to that account rather than become a new signup ticket');
  assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get()?.n, 0);
  assert.equal(h.service.store.db.prepare('SELECT COUNT(*) AS n FROM auth_identities').get()?.n, 0);
  assert.ok(!stale.headers.getSetCookie().some(cookie => cookie.startsWith('forma_session=')));
  const newlyAuthorized = await h.social('google', claims);
  assert.notEqual(newlyAuthorized.id, owner.id, 'a genuinely new post-deletion authorization may explicitly create an empty new account');
  const snapshot = await h.request('GET', '/api/state', undefined, newlyAuthorized);
  assert.deepEqual(snapshot.body.state.meals, []); assert.deepEqual(snapshot.body.state.workouts, []);
});

test('AUTH-QA: a legacy three-column session database migrates without losing its session, user state or revision', async t => {
  const owner: Session = { id: randomUUID(), email: 'qa-legacy@example.test', cookie: `forma_session=${'a'.repeat(64)}` };
  const legacyHash = createHash('sha256').update('a'.repeat(64)).digest('hex');
  const state = { ...emptyState(), meals: [{
    id: randomUUID(), date: '2026-10-24', name: 'Synthetic legacy lunch', type: 'lunch' as const,
    grams: 150, referenceGrams: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3,
    source: 'manual' as const, createdAt: '2026-10-24T12:00:00.000Z',
  }] };
  const revision = 7;
  const h = await fixture(t, { auth: {}, mail: false, seed: directory => {
    const legacy = new DatabaseSync(join(directory, 'forma.sqlite'));
    try {
      legacy.exec(`PRAGMA foreign_keys=ON;
        CREATE TABLE accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE states(owner_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,state_json TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);`);
      const salt = 'qa-legacy-salt';
      const hash = scryptSync(PASSWORD, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
      legacy.prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?)').run(owner.id, owner.email, 'Synthetic legacy user', hash, salt, '2026-10-20T12:00:00Z');
      legacy.prepare('INSERT INTO states VALUES (?,?,?)').run(owner.id, JSON.stringify(state), revision);
      legacy.prepare('INSERT INTO sessions VALUES (?,?,?)').run(legacyHash, owner.id, Date.now() + 86400_000);
      assert.equal(legacy.prepare('PRAGMA table_info(sessions)').all().length, 3, 'the fixture must actually start with the old session schema');
    } finally { legacy.close(); }
  } });
  const me = await h.request('GET', '/api/auth/me', undefined, owner);
  assert.equal(me.status, 200); assert.equal(me.body.user.id, owner.id);
  const snapshot = await h.request('GET', '/api/sync', undefined, owner);
  assert.equal(snapshot.status, 200, snapshot.text); assert.equal(snapshot.body.revision, revision); assert.deepEqual(snapshot.body.state, state);
  assert.equal(h.service.store.db.prepare('SELECT created_ms FROM sessions WHERE token_hash=?').get(legacyHash)?.created_ms, 0);
  // Simulate a migrated social-only security flag using this fixture's private DB.
  // An old cookie with no authentication timestamp must not acquire fresh status.
  h.service.store.db.prepare('UPDATE auth_account_security SET has_password=0 WHERE owner_id=?').run(owner.id);
  const cannotSetFirstPassword = await h.request('POST', '/api/auth/password', { password: NEW_PASSWORD }, owner);
  assert.equal(cannotSetFirstPassword.status, 401); assert.equal(cannotSetFirstPassword.body.code, 'AUTH_REAUTH_REQUIRED');
  h.service.store.db.prepare('UPDATE auth_account_security SET has_password=1 WHERE owner_id=?').run(owner.id);
  const loggedIn = await h.login(owner.email, PASSWORD, owner); assert.equal(loggedIn.status, 200, loggedIn.text);
  const current = h.sessionFrom(loggedIn); assert.notEqual(current.cookie, owner.cookie);
  assert.equal((await h.request('GET', '/api/state', undefined, owner)).status, 401);
  const preserved = await h.request('GET', '/api/sync', undefined, current);
  assert.equal(preserved.status, 200); assert.equal(preserved.body.revision, revision); assert.deepEqual(preserved.body.state, state);
  const newSessionHash = createHash('sha256').update(current.cookie.split('=')[1]).digest('hex');
  assert.equal(h.service.store.db.prepare('SELECT created_ms FROM sessions WHERE token_hash=?').get(newSessionHash)?.created_ms, NOW);
  const newlyRegistered = await h.register(undefined, current); assert.notEqual(newlyRegistered.id, owner.id);
  assert.equal((await h.request('GET', '/api/state', undefined, newlyRegistered)).status, 200);
  const row = h.service.store.db.prepare('SELECT state_json,revision FROM states WHERE owner_id=?').get(owner.id)!;
  assert.equal(row.revision, revision); assert.deepEqual(JSON.parse(String(row.state_json)), state);
  assert.deepEqual(h.service.store.db.prepare('PRAGMA foreign_key_check').all(), []);
});
