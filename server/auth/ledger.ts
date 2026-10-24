import type { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { emptyState, type User } from '../../src/types';
import type { AccountSecurity, SignInProvider } from '../../src/auth';
import { AuthError } from './config';
import { digestAuth, type VerifiedIdentity } from './oidc';

export interface AuthState {
  state_hash: string; provider: SignInProvider; intent: 'login' | 'link'; owner_id: string | null; session_hash: string | null;
  binding_hash: string; nonce_hash: string; phase: string; created_ms: number; expires_ms: number; password_version: number | null;
  created_revision: number;
}
export class AuthLedger {
  constructor(readonly db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS auth_account_security(owner_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,email_verified_at TEXT,has_password INTEGER NOT NULL DEFAULT 1,password_version INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS auth_identities(provider TEXT NOT NULL,subject TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,created_at TEXT NOT NULL,PRIMARY KEY(provider,subject),UNIQUE(owner_id,provider));
      CREATE TABLE IF NOT EXISTS auth_mail_tokens(token_hash TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,kind TEXT NOT NULL,password_version INTEGER NOT NULL,expires_ms INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_oauth_states(state_hash TEXT PRIMARY KEY,provider TEXT NOT NULL,intent TEXT NOT NULL,owner_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,session_hash TEXT,binding_hash TEXT NOT NULL,nonce_hash TEXT NOT NULL,phase TEXT NOT NULL,created_ms INTEGER NOT NULL,expires_ms INTEGER NOT NULL,password_version INTEGER);
      CREATE TABLE IF NOT EXISTS auth_oauth_tickets(ticket_hash TEXT PRIMARY KEY,state_hash TEXT NOT NULL UNIQUE REFERENCES auth_oauth_states(state_hash) ON DELETE CASCADE,identity_json TEXT NOT NULL,expires_ms INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_rate_limits(key_hash TEXT PRIMARY KEY,owner_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,count INTEGER NOT NULL,until_ms INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS auth_states_owner ON auth_oauth_states(owner_id);
      CREATE TABLE IF NOT EXISTS auth_security_clock(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL);
      INSERT OR IGNORE INTO auth_security_clock VALUES (1,0);
      INSERT OR IGNORE INTO auth_account_security(owner_id) SELECT id FROM accounts;`);
    if (!(db.prepare('PRAGMA table_info(auth_account_security)').all() as { name: string }[]).some(row => row.name === 'invalidated_revision')) db.exec('ALTER TABLE auth_account_security ADD COLUMN invalidated_revision INTEGER NOT NULL DEFAULT 0');
    if (!(db.prepare('PRAGMA table_info(auth_oauth_states)').all() as { name: string }[]).some(row => row.name === 'created_revision')) db.exec('ALTER TABLE auth_oauth_states ADD COLUMN created_revision INTEGER NOT NULL DEFAULT 0');
    if (!(db.prepare('PRAGMA table_info(auth_oauth_tickets)').all() as { name: string }[]).some(row => row.name === 'target_owner_id')) db.exec('ALTER TABLE auth_oauth_tickets ADD COLUMN target_owner_id TEXT REFERENCES accounts(id) ON DELETE CASCADE');
  }
  transaction<T>(run: () => T): T { this.db.exec('BEGIN IMMEDIATE'); try { const value = run(); this.db.exec('COMMIT'); return value; } catch (error) { this.db.exec('ROLLBACK'); throw error; } }
  ensure(owner: string) { this.db.prepare('INSERT OR IGNORE INTO auth_account_security(owner_id) SELECT id FROM accounts WHERE id=?').run(owner); }
  security(owner: string, mailAvailable: boolean): AccountSecurity {
    this.ensure(owner);
    const row = this.db.prepare('SELECT * FROM auth_account_security WHERE owner_id=?').get(owner);
    if (!row) throw new AuthError('AUTH_SESSION_CHANGED', 401);
    const identities = this.db.prepare('SELECT provider FROM auth_identities WHERE owner_id=? ORDER BY provider').all(owner) as { provider: SignInProvider }[];
    return { emailVerified: !!row.email_verified_at, hasPassword: !!row.has_password, providers: identities.map(row => row.provider), mailAvailable };
  }
  version(owner: string) { this.ensure(owner); return Number(this.db.prepare('SELECT password_version FROM auth_account_security WHERE owner_id=?').get(owner)?.password_version ?? -1); }
  liveSession(owner: string, sessionHash: string) {
    return !!this.db.prepare('SELECT 1 FROM sessions WHERE owner_id=? AND token_hash=? AND expires_at>?').get(owner, sessionHash, Date.now());
  }
  freshSession(owner: string, sessionHash: string, now: number) {
    const row = this.db.prepare('SELECT created_ms FROM sessions WHERE owner_id=? AND token_hash=? AND expires_at>?').get(owner, sessionHash, Date.now());
    return !!row && Number(row.created_ms) > 0 && Number(row.created_ms) <= now + 60000 && now - Number(row.created_ms) <= 15 * 60000;
  }
  revokeSession(session: string) { this.db.prepare('DELETE FROM auth_oauth_states WHERE session_hash=?').run(digestAuth(session)); }
  revokeAccount(owner: string) {
    this.db.prepare('DELETE FROM auth_oauth_states WHERE owner_id=?').run(owner);
    this.db.prepare('DELETE FROM auth_mail_tokens WHERE owner_id=?').run(owner);
  }
  rate(key: string, now: number, owner: string | null = null, limit = 3) {
    this.transaction(() => {
      this.db.prepare('DELETE FROM auth_rate_limits WHERE until_ms<=?').run(now);
      const hash = digestAuth(key), row = this.db.prepare('SELECT count FROM auth_rate_limits WHERE key_hash=?').get(hash);
      if (Number(row?.count ?? 0) >= limit) throw new AuthError('AUTH_RATE_LIMIT', 429);
      if (row) this.db.prepare('UPDATE auth_rate_limits SET count=count+1 WHERE key_hash=?').run(hash);
      else this.db.prepare('INSERT INTO auth_rate_limits VALUES (?,?,1,?)').run(hash, owner, now + 15 * 60000);
    });
  }
  mailToken(owner: string, kind: 'verify' | 'reset', now: number) {
    const token = randomBytes(32).toString('hex');
    this.transaction(() => {
      const version = this.version(owner);
      if (version < 0) throw new AuthError('AUTH_SESSION_CHANGED', 401);
      this.db.prepare('DELETE FROM auth_mail_tokens WHERE owner_id=? AND kind=?').run(owner, kind);
      this.db.prepare('INSERT INTO auth_mail_tokens VALUES (?,?,?,?,?)').run(digestAuth(token), owner, kind, version, now + (kind === 'reset' ? 30 * 60000 : 24 * 3600000));
    });
    return token;
  }
  private validMailToken(token: string, kind: 'verify' | 'reset', now: number) {
    const row = this.db.prepare('SELECT * FROM auth_mail_tokens WHERE token_hash=? AND kind=? AND expires_ms>?').get(digestAuth(token), kind, now);
    if (!row || this.version(String(row.owner_id)) !== row.password_version) throw new AuthError('AUTH_INVALID_TOKEN', 400);
    return row;
  }
  verifyEmail(token: string, now: number) {
    return this.transaction(() => {
      const row = this.validMailToken(token, 'verify', now), owner = String(row.owner_id);
      this.db.prepare('UPDATE auth_account_security SET email_verified_at=? WHERE owner_id=?').run(new Date(now).toISOString(), owner);
      this.db.prepare('DELETE FROM auth_mail_tokens WHERE token_hash=?').run(digestAuth(token)); return owner;
    });
  }
  passwordByReset(token: string, hash: string, salt: string, now: number) {
    return this.transaction(() => {
      const row = this.validMailToken(token, 'reset', now), owner = String(row.owner_id);
      this.setPassword(owner, hash, salt, now, true);
      return owner;
    });
  }
  passwordBySession(owner: string, sessionHash: string, version: number, hash: string, salt: string, now: number) {
    this.transaction(() => {
      if (!this.liveSession(owner, sessionHash) || this.version(owner) !== version) throw new AuthError('AUTH_SESSION_CHANGED', 401);
      this.setPassword(owner, hash, salt, now);
    });
  }
  private setPassword(owner: string, hash: string, salt: string, now: number, verifiedByEmail = false) {
    const revision = this.nextRevision();
    this.db.prepare('UPDATE accounts SET password_hash=?,password_salt=? WHERE id=?').run(hash, salt, owner);
    this.db.prepare('UPDATE auth_account_security SET has_password=1,password_version=password_version+1,invalidated_revision=?,email_verified_at=CASE WHEN ? THEN COALESCE(email_verified_at,?) ELSE email_verified_at END WHERE owner_id=?').run(revision, verifiedByEmail ? 1 : 0, new Date(now).toISOString(), owner);
    this.db.prepare('DELETE FROM sessions WHERE owner_id=?').run(owner);
    this.revokeAccount(owner);
    this.db.prepare('DELETE FROM health_oauth_states WHERE owner_id=?').run(owner);
  }
  private nextRevision() {
    this.db.prepare('UPDATE auth_security_clock SET revision=revision+1 WHERE id=1').run();
    return Number(this.db.prepare('SELECT revision FROM auth_security_clock WHERE id=1').get()!.revision);
  }
  private flowCurrent(owner: string, revision: number) {
    return revision > Number(this.db.prepare('SELECT invalidated_revision FROM auth_account_security WHERE owner_id=?').get(owner)?.invalidated_revision ?? 0);
  }
  start(state: Omit<AuthState, 'created_revision'>, now: number) {
    this.transaction(() => {
      this.db.prepare('DELETE FROM auth_oauth_states WHERE expires_ms<=?').run(now);
      if (state.owner_id && state.session_hash && !this.liveSession(state.owner_id, state.session_hash)) throw new AuthError('AUTH_SESSION_CHANGED', 401);
      const revision = this.nextRevision();
      this.db.prepare('INSERT INTO auth_oauth_states(state_hash,provider,intent,owner_id,session_hash,binding_hash,nonce_hash,phase,created_ms,expires_ms,password_version,created_revision) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(state.state_hash, state.provider, state.intent, state.owner_id, state.session_hash, state.binding_hash, state.nonce_hash, state.phase, state.created_ms, state.expires_ms, state.password_version, revision);
    });
  }
  takeCallback(hash: string, provider: SignInProvider, now: number): AuthState {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM auth_oauth_states WHERE state_hash=? AND provider=?').get(hash, provider) as AuthState | undefined;
      if (!row || row.phase !== 'started' || row.expires_ms <= now || row.owner_id && (!row.session_hash || !this.liveSession(row.owner_id, row.session_hash))) throw new AuthError('AUTH_INVALID_STATE');
      this.db.prepare("UPDATE auth_oauth_states SET phase='callback' WHERE state_hash=?").run(hash); return row;
    });
  }
  ticket(state: AuthState, identity: VerifiedIdentity, now: number) {
    const ticket = randomBytes(32).toString('hex');
    this.transaction(() => {
      const row = this.db.prepare("SELECT 1 FROM auth_oauth_states WHERE state_hash=? AND phase='callback' AND expires_ms>?").get(state.state_hash, now);
      if (!row || state.owner_id && (!state.session_hash || !this.liveSession(state.owner_id, state.session_hash))) throw new AuthError('AUTH_SESSION_CHANGED', 401);
      const target = this.db.prepare('SELECT owner_id FROM auth_identities WHERE provider=? AND subject=?').get(state.provider, identity.subject);
      if (target && !this.flowCurrent(String(target.owner_id), state.created_revision)) throw new AuthError('AUTH_SESSION_CHANGED', 401);
      this.db.prepare("UPDATE auth_oauth_states SET phase='ready' WHERE state_hash=?").run(state.state_hash);
      this.db.prepare('INSERT INTO auth_oauth_tickets(ticket_hash,state_hash,identity_json,expires_ms,target_owner_id) VALUES (?,?,?,?,?)').run(digestAuth(ticket), state.state_hash, JSON.stringify(identity), now + 2 * 60000, state.intent === 'link' ? state.owner_id : target?.owner_id ?? null);
    });
    return ticket;
  }
  complete(ticket: string, binding: string, session: string | undefined, now: number): User {
    return this.transaction(() => {
      const entry = this.db.prepare('SELECT t.identity_json,t.target_owner_id,t.expires_ms AS ticket_expires,s.* FROM auth_oauth_tickets t JOIN auth_oauth_states s ON s.state_hash=t.state_hash WHERE t.ticket_hash=?').get(digestAuth(ticket)) as (AuthState & { identity_json: string; target_owner_id: string | null; ticket_expires: number }) | undefined;
      if (!entry || entry.phase !== 'ready' || entry.ticket_expires <= now || entry.expires_ms <= now || entry.binding_hash !== digestAuth(binding)) throw new AuthError('AUTH_INVALID_STATE');
      if (entry.session_hash ? !session || digestAuth(session) !== entry.session_hash || !entry.owner_id || !this.liveSession(entry.owner_id, entry.session_hash) : !!session) throw new AuthError('AUTH_SESSION_CHANGED', 401);
      if (entry.intent === 'link' && (!entry.owner_id || entry.password_version !== this.version(entry.owner_id))) throw new AuthError('AUTH_SESSION_CHANGED', 401);
      const identity = JSON.parse(entry.identity_json) as VerifiedIdentity;
      const existing = this.db.prepare('SELECT owner_id FROM auth_identities WHERE provider=? AND subject=?').get(entry.provider, identity.subject);
      let owner = existing ? String(existing.owner_id) : undefined;
      if (entry.target_owner_id && (entry.intent === 'login' ? owner !== entry.target_owner_id : entry.owner_id !== entry.target_owner_id)) throw new AuthError('AUTH_SESSION_CHANGED', 401);
      if (owner && !this.flowCurrent(owner, entry.created_revision)) throw new AuthError('AUTH_SESSION_CHANGED', 401);
      if (entry.intent === 'link') {
        if (owner && owner !== entry.owner_id) throw new AuthError('AUTH_IDENTITY_IN_USE', 409);
        const other = this.db.prepare('SELECT subject FROM auth_identities WHERE owner_id=? AND provider=?').get(entry.owner_id!, entry.provider);
        if (other && other.subject !== identity.subject) throw new AuthError('AUTH_IDENTITY_IN_USE', 409);
        owner = entry.owner_id!;
      } else if (!owner) {
        if (!identity.email || !identity.emailVerified) throw new AuthError('AUTH_PROVIDER_EMAIL_REQUIRED', 409);
        if (this.db.prepare('SELECT id FROM accounts WHERE email=?').get(identity.email)) throw new AuthError('AUTH_ACCOUNT_EXISTS', 409);
        owner = randomUUID();
        this.db.prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?)').run(owner, identity.email, identity.name || (entry.provider === 'apple' ? 'Apple member' : 'Google member'), randomBytes(64).toString('hex'), randomBytes(16).toString('hex'), new Date(now).toISOString());
        this.db.prepare('INSERT INTO states(owner_id,state_json) VALUES (?,?)').run(owner, JSON.stringify(emptyState()));
        this.db.prepare('INSERT INTO auth_account_security(owner_id,email_verified_at,has_password) VALUES (?,?,0)').run(owner, new Date(now).toISOString());
      }
      if (!existing) this.db.prepare('INSERT INTO auth_identities VALUES (?,?,?,?)').run(entry.provider, identity.subject, owner!, new Date(now).toISOString());
      const user = this.db.prepare('SELECT id,email,name FROM accounts WHERE id=?').get(owner!) as unknown as User | undefined;
      if (!user) throw new AuthError('AUTH_SESSION_CHANGED', 401);
      this.db.prepare('DELETE FROM auth_oauth_states WHERE state_hash=?').run(entry.state_hash); return user;
    });
  }
}
