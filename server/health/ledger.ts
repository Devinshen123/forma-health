import type { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { HealthProvider, HealthRecord, ImportedHealthRecord } from '../../src/health';
import { HealthError, type CloudProvider } from './model';

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export interface HealthTokens { accessToken: string; refreshToken?: string; expiresAt: number; scopes: string[]; subjectId?: string }
export interface ConnectionRow {
  owner_id: string; provider: HealthProvider; status: 'connected' | 'disconnected' | 'reauthorize'; scopes_json: string;
  encrypted_tokens: string | null; generation: number; lock_id: string | null; lock_until: number;
  connected_at: string | null; last_sync_at: string | null; last_error: string | null;
}
export interface OAuthRow { state_hash: string; owner_id: string; provider: CloudProvider; session_hash: string; binding_hash: string; verifier_cipher: string; generation: number; expires_ms: number }
export class HealthLedger {
  constructor(readonly db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS health_connections(
      owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,provider TEXT NOT NULL,status TEXT NOT NULL,
      scopes_json TEXT NOT NULL DEFAULT '[]',encrypted_tokens TEXT,generation INTEGER NOT NULL DEFAULT 0,
      lock_id TEXT,lock_until INTEGER NOT NULL DEFAULT 0,connected_at TEXT,last_sync_at TEXT,last_error TEXT,
      PRIMARY KEY(owner_id,provider));
      CREATE TABLE IF NOT EXISTS health_oauth_states(state_hash TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,session_hash TEXT NOT NULL,binding_hash TEXT NOT NULL,verifier_cipher TEXT NOT NULL,generation INTEGER NOT NULL,expires_ms INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS health_oauth_owner ON health_oauth_states(owner_id,provider);
      CREATE TABLE IF NOT EXISTS health_records(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,record_id TEXT NOT NULL,payload_json TEXT NOT NULL,imported_at TEXT NOT NULL,
      PRIMARY KEY(owner_id,provider,record_id));
      CREATE INDEX IF NOT EXISTS health_records_owner ON health_records(owner_id,provider,record_id);`);
  }
  transaction<T>(run: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = run(); this.db.exec('COMMIT'); return result; } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  row(owner: string, provider: HealthProvider) { return this.db.prepare('SELECT * FROM health_connections WHERE owner_id=? AND provider=?').get(owner, provider) as ConnectionRow | undefined; }
  ensure(owner: string, provider: HealthProvider) { this.db.prepare("INSERT OR IGNORE INTO health_connections(owner_id,provider,status) VALUES (?,?,'disconnected')").run(owner, provider); }
  count(owner: string, provider: HealthProvider) { return Number(this.db.prepare('SELECT COUNT(*) AS n FROM health_records WHERE owner_id=? AND provider=?').get(owner, provider)?.n ?? 0); }
  beginOAuth(owner: string, provider: CloudProvider, input: Omit<OAuthRow, 'owner_id' | 'provider' | 'generation'>, now: number) {
    return this.transaction(() => {
      this.ensure(owner, provider);
      this.db.prepare('DELETE FROM health_oauth_states WHERE expires_ms<=? OR (owner_id=? AND provider=?)').run(now, owner, provider);
      this.db.prepare("UPDATE health_connections SET generation=generation+1,status='disconnected',encrypted_tokens=NULL,scopes_json='[]',lock_id=NULL,lock_until=0,last_error=NULL WHERE owner_id=? AND provider=?").run(owner, provider);
      const generation = this.row(owner, provider)!.generation;
      this.db.prepare('INSERT INTO health_oauth_states VALUES (?,?,?,?,?,?,?,?)').run(input.state_hash, owner, provider, input.session_hash, input.binding_hash, input.verifier_cipher, generation, input.expires_ms);
      return generation;
    });
  }
  consumeOAuth(state: string, provider: CloudProvider, binding: string, session: string | undefined, now: number): OAuthRow {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM health_oauth_states WHERE state_hash=?').get(digest(state)) as OAuthRow | undefined;
      if (!row || row.provider !== provider || row.expires_ms <= now || row.binding_hash !== digest(binding) || session !== undefined && digest(session) !== row.session_hash ||
          !this.db.prepare('SELECT 1 FROM sessions WHERE token_hash=? AND owner_id=? AND expires_at>?').get(row.session_hash, row.owner_id, Date.now()))
        throw new HealthError('HEALTH_OAUTH_INVALID', 400);
      this.db.prepare('DELETE FROM health_oauth_states WHERE state_hash=?').run(row.state_hash);
      if (this.row(row.owner_id, provider)?.generation !== row.generation) throw new HealthError('HEALTH_OAUTH_INVALID', 400);
      return row;
    });
  }
  cancelSession(session: string) { this.db.prepare('DELETE FROM health_oauth_states WHERE session_hash=?').run(digest(session)); }
  connect(owner: string, provider: CloudProvider, generation: number, encrypted: string, scopes: string[], now: number, sessionHash: string) {
    const result = this.db.prepare("UPDATE health_connections SET status='connected',encrypted_tokens=?,scopes_json=?,connected_at=?,last_error=NULL WHERE owner_id=? AND provider=? AND generation=? AND EXISTS(SELECT 1 FROM sessions WHERE token_hash=? AND owner_id=? AND expires_at>?)")
      .run(encrypted, JSON.stringify(scopes), new Date(now).toISOString(), owner, provider, generation, sessionHash, owner, Date.now());
    if (result.changes !== 1) throw new HealthError('HEALTH_CONNECTION_CHANGED', 409);
  }
  disconnect(owner: string, provider: HealthProvider) {
    this.transaction(() => {
      this.ensure(owner, provider);
      this.db.prepare("UPDATE health_connections SET status='disconnected',generation=generation+1,encrypted_tokens=NULL,scopes_json='[]',lock_id=NULL,lock_until=0,last_error=NULL WHERE owner_id=? AND provider=?").run(owner, provider);
      this.db.prepare('DELETE FROM health_oauth_states WHERE owner_id=? AND provider=?').run(owner, provider);
    });
  }
  lock(owner: string, provider: CloudProvider, lockId: string, now: number) {
    const updated = this.db.prepare("UPDATE health_connections SET lock_id=?,lock_until=? WHERE owner_id=? AND provider=? AND status='connected' AND (lock_id IS NULL OR lock_until<=?)")
      .run(lockId, now + 120000, owner, provider, now);
    if (updated.changes !== 1) throw new HealthError(this.row(owner, provider)?.status === 'connected' ? 'HEALTH_SYNC_BUSY' : 'HEALTH_NOT_CONNECTED', 409);
    return this.row(owner, provider)!;
  }
  active(owner: string, provider: CloudProvider, generation: number, lockId?: string) {
    const row = this.row(owner, provider);
    return !!row && row.generation === generation && row.status === 'connected' && (!lockId || row.lock_id === lockId);
  }
  refresh(owner: string, provider: CloudProvider, generation: number, lock: string, encrypted: string, scopes: string[]) {
    if (!this.active(owner, provider, generation, lock)) throw new HealthError('HEALTH_CONNECTION_CHANGED', 409);
    this.db.prepare('UPDATE health_connections SET encrypted_tokens=?,scopes_json=? WHERE owner_id=? AND provider=? AND generation=? AND lock_id=?')
      .run(encrypted, JSON.stringify(scopes), owner, provider, generation, lock);
  }
  release(owner: string, provider: CloudProvider, generation: number, lock: string, error?: string, reauthorize = false) {
    if (!this.db.isOpen) return;
    this.db.prepare(`UPDATE health_connections SET lock_id=NULL,lock_until=0,last_error=?${reauthorize ? ",status='reauthorize',encrypted_tokens=NULL" : ''} WHERE owner_id=? AND provider=? AND generation=? AND lock_id=?`)
      .run(error ?? null, owner, provider, generation, lock);
  }
  save(owner: string, provider: HealthProvider, records: HealthRecord[], deleted: string[], now: number, expected?: { generation: number; lock: string } | { appleRevision: number }) {
    return this.transaction(() => {
      if (expected && 'generation' in expected && !this.active(owner, provider as CloudProvider, expected.generation, expected.lock)) throw new HealthError('HEALTH_CONNECTION_CHANGED', 409);
      if (expected && 'appleRevision' in expected && (this.row(owner, provider)?.generation ?? 0) !== expected.appleRevision) throw new HealthError('HEALTH_CONNECTION_CHANGED', 409);
      this.ensure(owner, provider);
      const importedAt = new Date(now).toISOString();
      const put = this.db.prepare('INSERT INTO health_records VALUES (?,?,?,?,?) ON CONFLICT(owner_id,provider,record_id) DO UPDATE SET payload_json=excluded.payload_json,imported_at=excluded.imported_at');
      for (const record of records) put.run(owner, provider, record.id, JSON.stringify(record), importedAt);
      const drop = this.db.prepare('DELETE FROM health_records WHERE owner_id=? AND provider=? AND record_id=?');
      let removed = 0;
      for (const id of deleted) removed += Number(drop.run(owner, provider, id).changes);
      if (this.count(owner, provider) > 100000) throw new HealthError('HEALTH_RECORD_LIMIT', 413);
      this.db.prepare("UPDATE health_connections SET status='connected',last_sync_at=?,last_error=NULL,connected_at=COALESCE(connected_at,?) WHERE owner_id=? AND provider=?").run(importedAt, importedAt, owner, provider);
      return { imported: records.length, deleted: removed };
    });
  }
  deleteRecords(owner: string, provider: HealthProvider) {
    return this.transaction(() => {
      this.ensure(owner, provider);
      // Invalidate an already fetched batch, including batches from another process.
      this.db.prepare('UPDATE health_connections SET generation=generation+1,lock_id=NULL,lock_until=0,last_sync_at=NULL WHERE owner_id=? AND provider=?').run(owner, provider);
      return Number(this.db.prepare('DELETE FROM health_records WHERE owner_id=? AND provider=?').run(owner, provider).changes);
    });
  }
  records(owner: string, provider?: HealthProvider, limit = 100, cursor = '') {
    const rows = this.db.prepare(`SELECT provider,record_id,payload_json,imported_at FROM health_records WHERE owner_id=? ${provider ? 'AND provider=?' : ''} AND provider||':'||record_id>? ORDER BY provider,record_id LIMIT ?`)
      .all(...(provider ? [owner, provider, cursor, limit + 1] : [owner, cursor, limit + 1])) as { provider: HealthProvider; record_id: string; payload_json: string; imported_at: string }[];
    const page = rows.slice(0, limit);
    return { records: page.map(row => ({ ...JSON.parse(row.payload_json), provider: row.provider, importedAt: row.imported_at } as ImportedHealthRecord)), nextCursor: rows.length > limit ? `${page.at(-1)!.provider}:${page.at(-1)!.record_id}` : null };
  }
  export(owner: string) {
    const records = this.db.prepare('SELECT provider,payload_json,imported_at FROM health_records WHERE owner_id=? ORDER BY provider,record_id').all(owner) as { provider: HealthProvider; payload_json: string; imported_at: string }[];
    const connections = this.db.prepare('SELECT provider,status,scopes_json,connected_at,last_sync_at FROM health_connections WHERE owner_id=?').all(owner);
    return { connections: connections.map(row => ({ provider: row.provider, status: row.status, scopes: JSON.parse(row.scopes_json as string), connectedAt: row.connected_at, lastSyncAt: row.last_sync_at })), records: records.map(row => ({ ...JSON.parse(row.payload_json), provider: row.provider, importedAt: row.imported_at })) };
  }
}
export function encrypt(value: unknown, key: Buffer, context: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(value => value.toString('base64url')).join('.');
}
export function decrypt<T>(encrypted: string, key: Buffer, context: string): T {
  try {
    const parts = encrypted.split('.');
    if (parts.length !== 3) throw new Error();
    const [iv, tag, bytes] = parts.map(value => Buffer.from(value, 'base64url'));
    const cipher = createDecipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([cipher.update(bytes), cipher.final()]).toString('utf8')) as T;
  } catch { throw new HealthError('HEALTH_REAUTHORIZE', 409); }
}
