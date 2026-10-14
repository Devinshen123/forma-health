import { DatabaseSync } from "node:sqlite";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { AppState, User, FoodPhotoDraft, SyncMutation, SyncSnapshot } from "../src/types";
import { emptyState } from "../src/types";
import { AiError } from './ai-errors';
import { normalizedState, entityValues, changedEntityKeys, mutationHash, entityKey, applySyncChanges, SyncConflict } from './sync';

export interface Account extends User {
  password_hash: string;
  password_salt: string;
}
export interface Asset {
  id: string;
  owner_id: string;
  name: string;
  mime: string;
  size: number;
  created_at: string;
}
export class Store {
  readonly db: DatabaseSync;
  readonly dataDir: string;
  private readonly uploadsDir: string;
  constructor(dataDir: string) {
    this.dataDir = resolve(dataDir);
    this.uploadsDir = join(this.dataDir, "uploads");
    mkdirSync(this.uploadsDir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(this.dataDir, "forma.sqlite"));
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS states(owner_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,state_json TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_owner ON sessions(owner_id);
      CREATE INDEX IF NOT EXISTS assets_owner ON assets(owner_id);
      CREATE TABLE IF NOT EXISTS food_photo_drafts(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,payload_json TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS drafts_owner ON food_photo_drafts(owner_id);
      CREATE TRIGGER IF NOT EXISTS immutable_food_photo_drafts BEFORE UPDATE ON food_photo_drafts BEGIN SELECT RAISE(ABORT,'Drafts are immutable'); END;
      CREATE TABLE IF NOT EXISTS ai_daily_usage(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,utc_day TEXT NOT NULL,requests INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,reserved_micro_usd INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(owner_id,utc_day));
      CREATE TABLE IF NOT EXISTS ai_requests(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,utc_day TEXT NOT NULL,created_ms INTEGER NOT NULL,outcome TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS ai_requests_owner_time ON ai_requests(owner_id,created_ms);
      CREATE TABLE IF NOT EXISTS ai_locks(owner_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,request_id TEXT NOT NULL REFERENCES ai_requests(id) ON DELETE CASCADE,expires_ms INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS ai_reservations(id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES ai_requests(id) ON DELETE CASCADE,owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,utc_day TEXT NOT NULL,reserved_micro_usd INTEGER NOT NULL,model TEXT NOT NULL,created_at TEXT NOT NULL,outcome TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ai_global_usage(utc_day TEXT PRIMARY KEY,reserved_micro_usd INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sync_entities(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,entity_key TEXT NOT NULL,version INTEGER NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(owner_id,entity_key));
      CREATE TABLE IF NOT EXISTS sync_mutations(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,mutation_id TEXT NOT NULL,payload_hash TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(owner_id,mutation_id));`);
    this.db
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .run(Date.now());
  }
  close() {
    if (this.db.isOpen) this.db.close();
  }
  accountByEmail(email: string) {
    return this.db
      .prepare("SELECT * FROM accounts WHERE email=?")
      .get(email) as unknown as Account | undefined;
  }
  createAccount(
    email: string,
    name: string,
    passwordHash: string,
    salt: string,
  ): User {
    const user = { id: randomUUID(), email, name };
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("INSERT INTO accounts VALUES (?,?,?,?,?,?)")
        .run(
          user.id,
          email,
          name,
          passwordHash,
          salt,
          new Date().toISOString(),
        );
      this.db
        .prepare("INSERT INTO states(owner_id,state_json) VALUES (?,?)")
        .run(user.id, JSON.stringify(emptyState()));
      this.db.exec("COMMIT");
      return user;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  createSession(ownerId: string, token: string, expiresAt: number) {
    this.db
      .prepare("INSERT INTO sessions VALUES (?,?,?)")
      .run(hashToken(token), ownerId, expiresAt);
  }
  session(token: string) {
    const row = this.db
      .prepare(
        "SELECT a.id,a.email,a.name,a.password_hash,a.password_salt FROM accounts a JOIN sessions s ON s.owner_id=a.id WHERE s.token_hash=? AND s.expires_at>?",
      )
      .get(hashToken(token), Date.now());
    return row as unknown as Account | undefined;
  }
  deleteSession(token: string) {
    this.db
      .prepare("DELETE FROM sessions WHERE token_hash=?")
      .run(hashToken(token));
  }
  snapshot(ownerId: string): { state: AppState; revision: number } {
    const row = this.db
      .prepare("SELECT state_json,revision FROM states WHERE owner_id=?")
      .get(ownerId) as { state_json: string; revision: number } | undefined;
    if (!row) throw new Error("Account state missing");
    return {
      state: normalizedState(JSON.parse(row.state_json) as AppState),
      revision: row.revision,
    };
  }
  save(ownerId: string, state: AppState, revision: number): boolean {
    return this.transaction(() => {
      const previous = this.snapshot(ownerId);
      if (previous.revision !== revision) return false;
      this.ensureEntityVersions(ownerId, previous.state);
      const saved = this.db
        .prepare(
          "UPDATE states SET state_json=?,revision=revision+1 WHERE owner_id=? AND revision=?",
        )
        .run(JSON.stringify(state), ownerId, revision).changes === 1;
      if (saved) this.touchEntities(ownerId, changedEntityKeys(previous.state, state), state);
      return saved;
    });
  }
  private ensureEntityVersions(ownerId: string, state: AppState) {
    const insert = this.db.prepare('INSERT OR IGNORE INTO sync_entities(owner_id,entity_key,version,deleted) VALUES (?,?,?,0)');
    for (const [key, value] of entityValues(state)) insert.run(ownerId, key, value === null ? 0 : 1);
  }
  private touchEntities(ownerId: string, keys: string[], state: AppState) {
    const values = entityValues(state);
    const update = this.db.prepare('INSERT INTO sync_entities(owner_id,entity_key,version,deleted) VALUES (?,?,1,?) ON CONFLICT(owner_id,entity_key) DO UPDATE SET version=version+1,deleted=excluded.deleted');
    for (const key of keys) update.run(ownerId, key, values.has(key) && values.get(key) !== null ? 0 : 1);
  }
  private readSyncSnapshot(ownerId: string): SyncSnapshot {
    const snapshot = this.snapshot(ownerId);
    this.ensureEntityVersions(ownerId, snapshot.state);
    const rows = this.db.prepare('SELECT entity_key,version FROM sync_entities WHERE owner_id=?').all(ownerId) as { entity_key: string; version: number }[];
    return { ...snapshot, entityVersions: Object.fromEntries(rows.map(row => [row.entity_key, row.version])) };
  }
  syncSnapshot(ownerId: string): SyncSnapshot {
    return this.transaction(() => this.readSyncSnapshot(ownerId));
  }
  sync(ownerId: string, mutation: SyncMutation, validate: (previous: AppState, candidate: AppState) => AppState): { snapshot: SyncSnapshot; previous?: AppState } {
    return this.transaction(() => {
      const snapshot = this.readSyncSnapshot(ownerId), hash = mutationHash(mutation);
      const receipt = this.db.prepare('SELECT payload_hash FROM sync_mutations WHERE owner_id=? AND mutation_id=?').get(ownerId, mutation.mutationId) as { payload_hash: string } | undefined;
      if (receipt) {
        if (receipt.payload_hash !== hash) throw new SyncConflict(snapshot, [`mutation:${mutation.mutationId}`], 'This mutation ID was already used for different changes.');
        return { snapshot };
      }
      const conflicts = mutation.changes.filter(change => (snapshot.entityVersions[entityKey(change)] ?? 0) !== change.baseVersion).map(entityKey);
      if (conflicts.length) throw new SyncConflict(snapshot, conflicts);
      const state = validate(snapshot.state, applySyncChanges(snapshot.state, mutation.changes));
      this.db.prepare('UPDATE states SET state_json=?,revision=revision+1 WHERE owner_id=?').run(JSON.stringify(state), ownerId);
      this.touchEntities(ownerId, mutation.changes.map(entityKey), state);
      this.db.prepare('INSERT INTO sync_mutations VALUES (?,?,?,?)').run(ownerId, mutation.mutationId, hash, new Date().toISOString());
      return { snapshot: this.readSyncSnapshot(ownerId), previous: snapshot.state };
    });
  }
  asset(ownerId: string, assetId: string) {
    return this.db
      .prepare("SELECT * FROM assets WHERE owner_id=? AND id=?")
      .get(ownerId, assetId) as unknown as Asset | undefined;
  }
  assets(ownerId: string) {
    return this.db
      .prepare("SELECT * FROM assets WHERE owner_id=?")
      .all(ownerId) as unknown as Asset[];
  }
  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = operation(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  beginAiRequest(ownerId: string, now: number, dailyLimit: number, leaseMs: number): string {
    return this.transaction(() => {
      const lock = this.db.prepare('SELECT expires_ms FROM ai_locks WHERE owner_id=?').get(ownerId) as { expires_ms: number } | undefined;
      if (lock && lock.expires_ms > now) throw new AiError('AI_RATE_LIMIT');
      const recent = this.db.prepare('SELECT COUNT(*) AS count FROM ai_requests WHERE owner_id=? AND created_ms>?').get(ownerId, now - 60000) as { count: number };
      if (recent.count >= 5) throw new AiError('AI_RATE_LIMIT');
      const day = new Date(now).toISOString().slice(0, 10);
      const usage = this.db.prepare('SELECT requests FROM ai_daily_usage WHERE owner_id=? AND utc_day=?').get(ownerId, day) as { requests: number } | undefined;
      if ((usage?.requests ?? 0) >= dailyLimit) throw new AiError('AI_BUDGET_LIMIT');
      const id = randomUUID();
      this.db.prepare('INSERT INTO ai_daily_usage(owner_id,utc_day,requests) VALUES (?,?,1) ON CONFLICT(owner_id,utc_day) DO UPDATE SET requests=requests+1').run(ownerId, day);
      this.db.prepare('INSERT INTO ai_requests VALUES (?,?,?,?,?)').run(id, ownerId, day, now, 'in_progress');
      this.db.prepare('INSERT INTO ai_locks VALUES (?,?,?) ON CONFLICT(owner_id) DO UPDATE SET request_id=excluded.request_id,expires_ms=excluded.expires_ms').run(ownerId, id, now + leaseMs);
      return id;
    });
  }
  reserveAiAttempt(ownerId: string, requestId: string, now: number, microUsd: number, dailyBudget: number, globalBudget: number, model: string): string {
    return this.transaction(() => {
      if (!this.db.prepare('SELECT id FROM ai_requests WHERE id=? AND owner_id=?').get(requestId, ownerId)) throw new AiError('AI_UNAVAILABLE');
      const day = new Date(now).toISOString().slice(0, 10);
      const row = this.db.prepare('SELECT reserved_micro_usd FROM ai_daily_usage WHERE owner_id=? AND utc_day=?').get(ownerId, day) as { reserved_micro_usd: number } | undefined;
      if ((row?.reserved_micro_usd ?? 0) + microUsd > dailyBudget) throw new AiError('AI_BUDGET_LIMIT');
      const global = this.db.prepare('SELECT reserved_micro_usd FROM ai_global_usage WHERE utc_day=?').get(day) as { reserved_micro_usd: number } | undefined;
      if ((global?.reserved_micro_usd ?? 0) + microUsd > globalBudget) throw new AiError('AI_BUDGET_LIMIT');
      const id = randomUUID();
      this.db.prepare('INSERT INTO ai_global_usage VALUES (?,?) ON CONFLICT(utc_day) DO UPDATE SET reserved_micro_usd=reserved_micro_usd+excluded.reserved_micro_usd').run(day, microUsd);
      this.db.prepare('INSERT INTO ai_daily_usage(owner_id,utc_day,attempts,reserved_micro_usd) VALUES (?,?,1,?) ON CONFLICT(owner_id,utc_day) DO UPDATE SET attempts=attempts+1,reserved_micro_usd=reserved_micro_usd+excluded.reserved_micro_usd').run(ownerId, day, microUsd);
      this.db.prepare('INSERT INTO ai_reservations VALUES (?,?,?,?,?,?,?,?)').run(id, requestId, ownerId, day, microUsd, model, new Date(now).toISOString(), 'reserved');
      return id;
    });
  }
  finishAiAttempt(ownerId: string, id: string, outcome: string) {
    this.db.prepare('UPDATE ai_reservations SET outcome=? WHERE id=? AND owner_id=?').run(outcome, id, ownerId);
  }
  finishAiRequest(ownerId: string, id: string, outcome: string) {
    this.transaction(() => {
      this.db.prepare('UPDATE ai_requests SET outcome=? WHERE id=? AND owner_id=?').run(outcome, id, ownerId);
      this.db.prepare('DELETE FROM ai_locks WHERE owner_id=? AND request_id=?').run(ownerId, id);
    });
  }
  addAiDraft(ownerId: string, draft: FoodPhotoDraft) {
    if (!this.asset(ownerId, draft.assetId)) throw new AiError('AI_IMAGE_INVALID');
    this.db.prepare('INSERT INTO food_photo_drafts VALUES (?,?,?,?,?)').run(draft.id, ownerId, draft.assetId, JSON.stringify(draft), draft.createdAt);
  }
  aiDraft(ownerId: string, draftId: string): FoodPhotoDraft | undefined {
    const row = this.db.prepare('SELECT payload_json FROM food_photo_drafts WHERE id=? AND owner_id=?').get(draftId, ownerId) as { payload_json: string } | undefined;
    return row && JSON.parse(row.payload_json) as FoodPhotoDraft;
  }
  aiDrafts(ownerId: string): FoodPhotoDraft[] {
    const rows = this.db.prepare('SELECT payload_json FROM food_photo_drafts WHERE owner_id=? ORDER BY created_at,id').all(ownerId) as { payload_json: string }[];
    return rows.map(row => JSON.parse(row.payload_json) as FoodPhotoDraft);
  }
  aiUsage(ownerId: string) {
    const rows = this.db.prepare('SELECT utc_day,requests,attempts,reserved_micro_usd FROM ai_daily_usage WHERE owner_id=? ORDER BY utc_day').all(ownerId) as { utc_day: string; requests: number; attempts: number; reserved_micro_usd: number }[];
    return rows.map(row => ({ utcDay: row.utc_day, requests: row.requests, attempts: row.attempts, reservedUsd: row.reserved_micro_usd / 1000000 }));
  }
  aiReservations(ownerId: string) {
    const rows = this.db.prepare('SELECT id,request_id,utc_day,reserved_micro_usd,model,created_at,outcome FROM ai_reservations WHERE owner_id=? ORDER BY created_at,id').all(ownerId) as { id: string; request_id: string; utc_day: string; reserved_micro_usd: number; model: string; created_at: string; outcome: string }[];
    return rows.map(row => ({ id: row.id, requestId: row.request_id, utcDay: row.utc_day, reservedUsd: row.reserved_micro_usd / 1000000, model: row.model, createdAt: row.created_at, outcome: row.outcome }));
  }
  private assetPath(ownerId: string, assetId: string) {
    if (!/^[a-f0-9-]{36}$/i.test(ownerId) || !/^[a-f0-9-]{36}$/i.test(assetId))
      throw new Error("Invalid asset identifier");
    const path = resolve(this.uploadsDir, ownerId, assetId);
    if (!path.startsWith(this.uploadsDir + sep))
      throw new Error("Invalid asset path");
    return path;
  }
  addAsset(ownerId: string, name: string, mime: string, bytes: Buffer) {
    const id = randomUUID(),
      path = this.assetPath(ownerId, id);
    mkdirSync(join(this.uploadsDir, ownerId), { recursive: true, mode: 0o700 });
    writeFileSync(path, bytes, { mode: 0o600, flag: "wx" });
    try {
      this.db
        .prepare("INSERT INTO assets VALUES (?,?,?,?,?,?)")
        .run(id, ownerId, name, mime, bytes.length, new Date().toISOString());
    } catch (error) {
      rmSync(path, { force: true });
      throw error;
    }
    return { id, name, mime };
  }
  assetBytes(asset: Asset) {
    return readFileSync(this.assetPath(asset.owner_id, asset.id));
  }
  deleteAsset(ownerId: string, assetId: string) {
    const asset = this.asset(ownerId, assetId);
    if (!asset) return false;
    this.db
      .prepare("DELETE FROM assets WHERE owner_id=? AND id=?")
      .run(ownerId, assetId);
    rmSync(this.assetPath(ownerId, assetId), { force: true });
    return true;
  }
  deleteAccount(ownerId: string) {
    const folder = resolve(this.uploadsDir, ownerId);
    if (
      !/^[a-f0-9-]{36}$/i.test(ownerId) ||
      !folder.startsWith(this.uploadsDir + sep)
    )
      throw new Error("Invalid account path");
    // Deleting files first prevents a failed filesystem cleanup from being reported as complete.
    rmSync(folder, { recursive: true, force: true });
    this.db.prepare("DELETE FROM accounts WHERE id=?").run(ownerId);
  }
}
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
