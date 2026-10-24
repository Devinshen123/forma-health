import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createApp } from './app';
import { digestAuth } from './auth/oidc';
import { hashPassword } from './auth/password';
import { AuthError, type AuthMail } from './auth/config';

const NOW = Date.parse('2026-10-24T18:00:00Z');
async function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'forma-auth-backend-')), mails: AuthMail[] = [];
  const service = createApp({ dataDir: directory, ai: {}, health: { pollIntervalMs: 0 }, auth: { publicBaseUrl: 'https://forma.example.test' }, authNow: () => NOW,
    authFetch: async () => { throw new Error('This unit fixture never calls a provider'); }, authMailer: async mail => { mails.push(mail); } });
  t.after(() => { service.close(); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.includes('forma-auth-backend-')); rmSync(directory, { recursive: true, force: true }); });
  const makeAccount = async (email: string) => { const password = await hashPassword('synthetic-password-123'); const account = service.store.createAccount(email, 'Synthetic auth fixture', password.hash, password.salt); service.authentication.ledger.ensure(account.id); return account; };
  const owner = await makeAccount('synthetic@example.test');
  const session = (id = owner.id, created = NOW) => { const token = randomBytes(32).toString('hex'); service.store.createSession(id, token, Date.now() + 86400000, created); return token; };
  return { ...service, owner, makeAccount, session, mails };
}
function flow(ledger: ReturnType<typeof createApp>['authentication']['ledger'], subject: string) {
  const state = randomBytes(32).toString('hex'), binding = randomBytes(32).toString('hex');
  ledger.start({ state_hash: digestAuth(state), provider: 'google', intent: 'login', owner_id: null, session_hash: null, binding_hash: digestAuth(binding), nonce_hash: digestAuth('nonce-fixture'), phase: 'started', created_ms: NOW, expires_ms: NOW + 600000, password_version: null }, NOW);
  const pending = ledger.takeCallback(digestAuth(state), 'google', NOW);
  return { pending, binding, identity: { subject, email: 'social@example.test', emailVerified: true } };
}

test('verification tokens are stored only as hashes and consumed exactly once without password/session changes', async t => {
  const h = await fixture(t), session = h.session(), token = h.authentication.ledger.mailToken(h.owner.id, 'verify', NOW);
  const rows = h.store.db.prepare('SELECT * FROM auth_mail_tokens').all();
  assert.ok(!JSON.stringify(rows).includes(token));
  assert.equal(rows[0].token_hash, digestAuth(token));
  h.authentication.verifyEmail(token);
  assert.equal(h.authentication.security(h.owner.id).emailVerified, true);
  assert.ok(h.store.session(session));
  assert.throws(() => h.authentication.verifyEmail(token), (error: unknown) => error instanceof AuthError && error.code === 'AUTH_INVALID_TOKEN');
});

test('ordinary password changes keep an unverified email unverified and revoke old sessions', async t => {
  const h = await fixture(t), session = h.session(), second = h.session();
  await h.authentication.changePassword(h.owner.id, session, 'a-new-synthetic-password', 'synthetic-password-123');
  assert.equal(h.authentication.security(h.owner.id).emailVerified, false);
  assert.equal(h.store.session(session), undefined); assert.equal(h.store.session(second), undefined);
});

test('reset proof verifies the email, revokes every session and invalidates older verification/reset tokens', async t => {
  const h = await fixture(t), session = h.session(), second = h.session();
  const verify = h.authentication.ledger.mailToken(h.owner.id, 'verify', NOW), token = h.authentication.ledger.mailToken(h.owner.id, 'reset', NOW);
  await h.authentication.resetPassword(token, 'a-new-synthetic-password');
  assert.equal(h.authentication.security(h.owner.id).emailVerified, true);
  assert.equal(h.store.session(session), undefined); assert.equal(h.store.session(second), undefined);
  assert.throws(() => h.authentication.verifyEmail(verify));
  await assert.rejects(h.authentication.resetPassword(token, 'another-synthetic-password'));
});

test('a SQL failure during first social identity creation rolls back both account and identity', async t => {
  const h = await fixture(t), item = flow(h.authentication.ledger, 'first-social-subject');
  const ticket = h.authentication.ledger.ticket(item.pending, item.identity, NOW);
  const before = h.store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get()!.n;
  h.store.db.exec("CREATE TRIGGER synthetic_identity_failure BEFORE INSERT ON auth_identities BEGIN SELECT RAISE(ABORT,'synthetic identity fault'); END");
  assert.throws(() => h.authentication.complete(ticket, item.binding));
  assert.equal(h.store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get()!.n, before);
  assert.equal(h.store.db.prepare('SELECT COUNT(*) AS n FROM auth_identities').get()!.n, 0);
});

test('a reset invalidates anonymous pending social flows for that identity without affecting another account', async t => {
  const h = await fixture(t), other = await h.makeAccount('other@example.test');
  h.store.db.prepare('INSERT INTO auth_identities VALUES (?,?,?,?)').run('google', 'owner-subject', h.owner.id, new Date(NOW).toISOString());
  h.store.db.prepare('INSERT INTO auth_identities VALUES (?,?,?,?)').run('google', 'other-subject', other.id, new Date(NOW).toISOString());
  const old = flow(h.authentication.ledger, 'owner-subject'), unrelated = flow(h.authentication.ledger, 'other-subject');
  const oldTicket = h.authentication.ledger.ticket(old.pending, old.identity, NOW);
  const token = h.authentication.ledger.mailToken(h.owner.id, 'reset', NOW);
  await h.authentication.resetPassword(token, 'a-new-synthetic-password');
  assert.throws(() => h.authentication.complete(oldTicket, old.binding));
  assert.throws(() => h.authentication.ledger.ticket(old.pending, old.identity, NOW));
  const otherTicket = h.authentication.ledger.ticket(unrelated.pending, unrelated.identity, NOW);
  assert.equal(h.authentication.complete(otherTicket, unrelated.binding).id, other.id);
  const fresh = flow(h.authentication.ledger, 'owner-subject'), freshTicket = h.authentication.ledger.ticket(fresh.pending, fresh.identity, NOW);
  assert.equal(h.authentication.complete(freshTicket, fresh.binding).id, h.owner.id);
});

test('social-only setting of a first password requires recent session authentication', async t => {
  const h = await fixture(t);
  h.store.db.prepare('UPDATE auth_account_security SET has_password=0 WHERE owner_id=?').run(h.owner.id);
  const stale = h.session(h.owner.id, NOW - 16 * 60000);
  await assert.rejects(h.authentication.changePassword(h.owner.id, stale, 'first-synthetic-password'), (error: unknown) => error instanceof AuthError && error.code === 'AUTH_REAUTH_REQUIRED');
  assert.equal(h.authentication.security(h.owner.id).hasPassword, false);
  const fresh = h.session(); await h.authentication.changePassword(h.owner.id, fresh, 'first-synthetic-password');
  assert.equal(h.authentication.security(h.owner.id).hasPassword, true);
});

test('deleting an existing identity account cascades ready anonymous tickets instead of silently recreating it', async t => {
  const h = await fixture(t);
  h.store.db.prepare('INSERT INTO auth_identities VALUES (?,?,?,?)').run('google', 'deleted-owner-subject', h.owner.id, new Date(NOW).toISOString());
  const old = flow(h.authentication.ledger, 'deleted-owner-subject');
  const ticket = h.authentication.ledger.ticket(old.pending, old.identity, NOW);
  h.store.deleteAccount(h.owner.id);
  assert.equal(h.store.db.prepare('SELECT COUNT(*) AS n FROM auth_oauth_tickets').get()!.n, 0);
  assert.throws(() => h.authentication.complete(ticket, old.binding));
  assert.equal(h.store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get()!.n, 0);
  const fresh = flow(h.authentication.ledger, 'deleted-owner-subject'), freshTicket = h.authentication.ledger.ticket(fresh.pending, fresh.identity, NOW);
  assert.notEqual(h.authentication.complete(freshTicket, fresh.binding).id, h.owner.id);
});
