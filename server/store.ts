import { DatabaseSync } from "node:sqlite";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AppState, User, FoodPhotoDraft, SyncMutation, SyncSnapshot, Workout } from "../src/types";
import { emptyState } from "../src/types";
import { AiError } from './ai-errors';
import { normalizedState, entityValues, changedEntityKeys, mutationHash, entityKey, applySyncChanges, SyncConflict } from './sync';
import { WorkbenchConflict, WorkbenchError, WORKBENCH_MEDIA_QUOTA, workbenchPlannerSnapshot, workbenchReferencedHashes, type WorkbenchMedia, type WorkbenchMediaMime, type WorkbenchReceipt, type WorkbenchSnapshot, type WorkbenchWarning, type WorkbenchWrite } from './training-workbench-data';
import type { CompanionItem } from '../src/companion';
import { CompanionError, CompanionLedger } from './companion';

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
  private readonly companion: CompanionLedger;
  constructor(dataDir: string, private readonly companionNow: () => number = Date.now) {
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
      CREATE TABLE IF NOT EXISTS sync_mutations(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,mutation_id TEXT NOT NULL,payload_hash TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(owner_id,mutation_id));
      CREATE TABLE IF NOT EXISTS asset_cleanup_intents(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,mutation_id TEXT NOT NULL,asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,created_at TEXT NOT NULL,PRIMARY KEY(owner_id,mutation_id,asset_id));
      CREATE INDEX IF NOT EXISTS asset_cleanup_intents_asset ON asset_cleanup_intents(asset_id);`);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workbench_states(owner_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,state_json TEXT NOT NULL,revision INTEGER NOT NULL,wid TEXT NOT NULL,warnings_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS workbench_revisions(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,revision INTEGER NOT NULL,state_json TEXT NOT NULL,wid TEXT NOT NULL,warnings_json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(owner_id,revision));
      CREATE TRIGGER IF NOT EXISTS immutable_workbench_revisions BEFORE UPDATE ON workbench_revisions BEGIN SELECT RAISE(ABORT,'Workbench revisions are immutable'); END;
      CREATE TABLE IF NOT EXISTS workbench_receipts(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request_hash TEXT NOT NULL,response_json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(owner_id,request_hash));
      CREATE TABLE IF NOT EXISTS workbench_projection_links(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,workout_id TEXT NOT NULL,payload_hash TEXT NOT NULL,PRIMARY KEY(owner_id,workout_id));
      CREATE TABLE IF NOT EXISTS workbench_media(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,hash TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(owner_id,hash));
    `);
    this.companion = new CompanionLedger(this.db);
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
      if (saved) {
        this.touchEntities(ownerId, changedEntityKeys(previous.state, state), state);
        this.companion.settle(ownerId, previous.state, state, new Date(this.companionNow()));
      }
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
      this.companion.settle(ownerId, snapshot.state, state, new Date(this.companionNow()));
      const createdAt = new Date().toISOString();
      this.db.prepare('INSERT INTO sync_mutations VALUES (?,?,?,?)').run(ownerId, mutation.mutationId, hash, createdAt);
      // Record exactly which of this owner's attachments the commit stopped referencing, so a replay
      // of the same receipt can still finish cleanup after a post-commit failure or a restart.
      const kept = attachmentIds(state), intent = this.db.prepare('INSERT OR IGNORE INTO asset_cleanup_intents SELECT owner_id,?,id,? FROM assets WHERE owner_id=? AND id=?');
      for (const assetId of attachmentIds(snapshot.state)) if (!kept.has(assetId)) intent.run(mutation.mutationId, createdAt, ownerId, assetId);
      return { snapshot: this.readSyncSnapshot(ownerId), previous: snapshot.state };
    });
  }
  assetCleanupIntents(ownerId: string, mutationId: string) {
    const rows = this.db.prepare('SELECT asset_id FROM asset_cleanup_intents WHERE owner_id=? AND mutation_id=? ORDER BY asset_id').all(ownerId, mutationId) as { asset_id: string }[];
    return rows.map(row => row.asset_id);
  }
  /** Consumes one recorded intent; a failed delete rolls back and leaves the intent for the next retry. */
  completeAssetCleanup(ownerId: string, mutationId: string, assetId: string) {
    return this.transaction(() => {
      // Only an intent recorded by this owner's mutation authorises deletion; anything else is a no-op.
      if (!this.db.prepare('SELECT 1 FROM asset_cleanup_intents WHERE owner_id=? AND mutation_id=? AND asset_id=?').get(ownerId, mutationId, assetId)) return false;
      const deleted = this.deleteUnreferencedAsset(ownerId, assetId);
      // Still referenced again or already gone: this mutation's removal needs no further cleanup.
      // Other mutations' intents for the same asset are left for their own replays.
      this.db.prepare('DELETE FROM asset_cleanup_intents WHERE owner_id=? AND mutation_id=? AND asset_id=?').run(ownerId, mutationId, assetId);
      return deleted;
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
    return this.transaction(() => this.deleteUnreferencedAsset(ownerId, assetId));
  }
  private deleteUnreferencedAsset(ownerId: string, assetId: string) {
    const asset = this.asset(ownerId, assetId);
    if (!asset) return false;
    // A state commit may have added a reference after a caller chose its cleanup candidates.
    // Callers hold the same SQLite write lock as state writers until deletion is complete.
    if (attachmentIds(this.snapshot(ownerId).state).has(assetId)) return false;
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
    rmSync(this.workbenchMediaFolder(ownerId), { recursive: true, force: true });
    this.transaction(() => {
      this.companion.revokeForAccount(ownerId, new Date(this.companionNow()));
      this.db.prepare("DELETE FROM accounts WHERE id=?").run(ownerId);
    });
  }

  workbenchSnapshot(ownerId: string): WorkbenchSnapshot {
    const row = this.db.prepare('SELECT state_json,revision,wid,warnings_json FROM workbench_states WHERE owner_id=?').get(ownerId) as { state_json: string; revision: number; wid: string; warnings_json: string } | undefined;
    return row ? { state: JSON.parse(row.state_json), rev: row.revision, wid: row.wid, warnings: JSON.parse(row.warnings_json) } : { state: null, rev: 0, warnings: [] };
  }

  saveWorkbench(ownerId: string, write: WorkbenchWrite, projection: { workouts: Workout[]; warnings: WorkbenchWarning[] }): WorkbenchReceipt {
    const requestHash = hashValue(write);
    return this.transaction(() => {
      const retry = this.db.prepare('SELECT response_json FROM workbench_receipts WHERE owner_id=? AND request_hash=?').get(ownerId, requestHash) as { response_json: string } | undefined;
      if (retry) return JSON.parse(retry.response_json) as WorkbenchReceipt;
      const current = this.workbenchSnapshot(ownerId);
      if ((write.baseRev ?? 0) !== current.rev || (write.baseWid !== undefined && write.baseWid !== current.wid)) throw new WorkbenchConflict(current);
      const before = this.snapshot(ownerId);
      const links = this.db.prepare('SELECT workout_id,payload_hash FROM workbench_projection_links WHERE owner_id=?').all(ownerId) as { workout_id: string; payload_hash: string }[];
      const linked = new Map(links.map(link => [link.workout_id, link.payload_hash]));
      const existing = new Map(before.state.workouts.map(workout => [workout.id, workout]));
      // A separate Forma editor cannot be overwritten by a later vendor-document save.
      for (const [id, hash] of linked) {
        const workout = existing.get(id);
        if (!workout || hashValue(workout) !== hash) throw new WorkbenchConflict(current, 'projection-conflict');
      }
      for (const workout of projection.workouts) if (existing.has(workout.id) && !linked.has(workout.id)) throw new WorkbenchConflict(current, 'projection-conflict');
      const workouts = [...before.state.workouts.filter(workout => !linked.has(workout.id)), ...projection.workouts];
      if (workouts.length > 10000) throw new WorkbenchError(413, 'The account has reached the supported workout limit');
      const next = { ...before.state, workouts };
      const changed = changedEntityKeys(before.state, next);
      if (changed.length) {
        this.ensureEntityVersions(ownerId, before.state);
        this.db.prepare('UPDATE states SET state_json=?,revision=revision+1 WHERE owner_id=?').run(JSON.stringify(next), ownerId);
        this.touchEntities(ownerId, changed, next);
      }
      this.companion.settle(ownerId, before.state, next, new Date(this.companionNow()));
      const rev = current.rev + 1, wid = randomBytes(8).toString('hex');
      const lineage = Array.isArray(current.state?._wids) ? current.state._wids.filter(value => typeof value === 'string') : [];
      const state = { ...write.state, _rev: rev, _wid: wid, _wids: [...lineage, ...(current.wid ? [current.wid] : [])].slice(-64) };
      const stateJson = JSON.stringify(state), warningsJson = JSON.stringify(projection.warnings), createdAt = new Date().toISOString();
      this.db.prepare('INSERT INTO workbench_states VALUES (?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET state_json=excluded.state_json,revision=excluded.revision,wid=excluded.wid,warnings_json=excluded.warnings_json').run(ownerId, stateJson, rev, wid, warningsJson);
      this.db.prepare('INSERT INTO workbench_revisions VALUES (?,?,?,?,?,?)').run(ownerId, rev, JSON.stringify(workbenchPlannerSnapshot(state)), wid, '[]', createdAt);
      this.db.prepare('DELETE FROM workbench_projection_links WHERE owner_id=?').run(ownerId);
      const insertLink = this.db.prepare('INSERT INTO workbench_projection_links VALUES (?,?,?)');
      for (const workout of projection.workouts) insertLink.run(ownerId, workout.id, hashValue(workout));
      const receipt: WorkbenchReceipt = { ok: true, ts: typeof write.state._ts === 'number' ? write.state._ts : null, rev, wid, warnings: projection.warnings };
      this.db.prepare('INSERT INTO workbench_receipts VALUES (?,?,?,?)').run(ownerId, requestHash, JSON.stringify(receipt), createdAt);
      return receipt;
    });
  }

  private workbenchMediaFolder(ownerId: string): string {
    if (!/^[a-f0-9-]{36}$/i.test(ownerId)) throw new Error('Invalid account path');
    const root = resolve(this.dataDir, 'workbench-media'), folder = resolve(root, ownerId);
    if (!folder.startsWith(root + sep)) throw new Error('Invalid account path');
    return folder;
  }
  private workbenchMediaPath(ownerId: string, hash: string): string {
    if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('Invalid media path');
    return join(this.workbenchMediaFolder(ownerId), hash);
  }
  workbenchMedia(ownerId: string, hash: string): WorkbenchMedia | undefined {
    return this.db.prepare('SELECT * FROM workbench_media WHERE owner_id=? AND hash=?').get(ownerId, hash) as unknown as WorkbenchMedia | undefined;
  }
  workbenchMediaList(ownerId: string): WorkbenchMedia[] {
    return this.db.prepare('SELECT * FROM workbench_media WHERE owner_id=? ORDER BY created_at,hash').all(ownerId) as unknown as WorkbenchMedia[];
  }
  workbenchMediaUsage(ownerId: string) {
    const usage = this.db.prepare('SELECT COALESCE(SUM(size),0) AS bytes,COUNT(*) AS count FROM workbench_media WHERE owner_id=?').get(ownerId) as { bytes: number; count: number };
    return { ...usage, quotaBytes: WORKBENCH_MEDIA_QUOTA };
  }
  workbenchMediaBytes(media: WorkbenchMedia): Buffer {
    try {
      const bytes = readFileSync(this.workbenchMediaPath(media.owner_id, media.hash));
      if (bytes.length !== media.size || hashValueBytes(bytes) !== media.hash) throw new WorkbenchError(404, 'Training media is not available', 'media-missing');
      return bytes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new WorkbenchError(404, 'Training media is not available', 'media-missing');
      throw error;
    }
  }
  workbenchMediaAvailable(ownerId: string, hash: string): boolean {
    const media = this.workbenchMedia(ownerId, hash);
    if (!media) return false;
    try { this.workbenchMediaBytes(media); return true; }
    catch (error) { if (error instanceof WorkbenchError && error.status === 404) return false; throw error; }
  }
  addWorkbenchMedia(ownerId: string, hash: string, mime: WorkbenchMediaMime, bytes: Buffer) {
    return this.transaction(() => {
      const existing = this.workbenchMedia(ownerId, hash);
      if (existing && this.workbenchMediaAvailable(ownerId, hash)) return { ok: true, hash, mime: existing.mime, size: existing.size, existed: true };
      if (this.workbenchMediaUsage(ownerId).bytes - (existing?.size ?? 0) + bytes.length > WORKBENCH_MEDIA_QUOTA) throw new WorkbenchError(413, 'Account media storage is full', 'media-quota');
      const folder = this.workbenchMediaFolder(ownerId), path = this.workbenchMediaPath(ownerId, hash);
      mkdirSync(folder, { recursive: true, mode: 0o700 });
      // A crash before the SQL insert may leave only an orphaned hash file. Reusing it is safe
      // after checking its bytes; no other account's directory is consulted.
      try { writeFileSync(path, bytes, { mode: 0o600, flag: existing ? 'w' : 'wx' }); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || hashValueBytes(readFileSync(path)) !== hash) throw error;
      }
      try { this.db.prepare('INSERT INTO workbench_media VALUES (?,?,?,?,?) ON CONFLICT(owner_id,hash) DO UPDATE SET mime=excluded.mime,size=excluded.size').run(ownerId, hash, mime, bytes.length, new Date().toISOString()); }
      catch (error) { if (!existing) rmSync(path, { force: true }); throw error; }
      return { ok: true, hash, mime, size: bytes.length, existed: false };
    });
  }
  sweepWorkbenchMedia(ownerId: string) {
    return this.transaction(() => {
      const kept = workbenchReferencedHashes(this.workbenchSnapshot(ownerId).state);
      // Only planner history is retained. Deleted workout/custom media are not kept by it.
      const history = this.db.prepare('SELECT state_json FROM workbench_revisions WHERE owner_id=?').all(ownerId) as { state_json: string }[];
      for (const revision of history) for (const hash of workbenchReferencedHashes(JSON.parse(revision.state_json))) kept.add(hash);
      let removed = 0, freedBytes = 0;
      for (const media of this.workbenchMediaList(ownerId)) if (!kept.has(media.hash)) {
        rmSync(this.workbenchMediaPath(ownerId, media.hash), { force: true });
        this.db.prepare('DELETE FROM workbench_media WHERE owner_id=? AND hash=?').run(ownerId, media.hash);
        removed++; freedBytes += media.size;
      }
      return { ok: true, removed, freedBytes };
    });
  }
  exportWorkbench(ownerId: string) {
    const revisions = this.db.prepare('SELECT revision,state_json,wid,warnings_json,created_at FROM workbench_revisions WHERE owner_id=? ORDER BY revision').all(ownerId) as { revision: number; state_json: string; wid: string; warnings_json: string; created_at: string }[];
    return {
      ...this.workbenchSnapshot(ownerId),
      revisions: revisions.map(row => ({ kind: 'planner', rev: row.revision, state: JSON.parse(row.state_json), wid: row.wid, createdAt: row.created_at })),
      media: this.workbenchMediaList(ownerId).map(media => ({ hash: media.hash, mime: media.mime, size: media.size, createdAt: media.created_at, base64: this.workbenchMediaBytes(media).toString('base64') })),
    };
  }

  companionSnapshot(ownerId: string) {
    return this.transaction(() => this.companion.snapshot(ownerId, this.snapshot(ownerId).state, new Date(this.companionNow())));
  }
  claimCompanion(ownerId: string, rest = false) {
    return this.transaction(() => {
      const state = this.snapshot(ownerId).state, now = new Date(this.companionNow());
      if (rest && !state.profile) throw new CompanionError(409, 'PROFILE_REQUIRED', 'Complete your profile before confirming a rest day');
      // Health-write transactions already settle observed new facts atomically. Claim is a safe
      // refresh, never a sweep of old snapshots in a newly selected time zone or reward day.
      if (rest) this.companion.rest(ownerId, state, now);
      return this.companion.snapshot(ownerId, state, now);
    });
  }
  openCompanionChest(ownerId: string, chestId: string) {
    return this.transaction(() => this.companion.openChest(ownerId, chestId, this.snapshot(ownerId).state, new Date(this.companionNow())));
  }
  equipCompanion(ownerId: string, item: CompanionItem | null) {
    return this.transaction(() => this.companion.equip(ownerId, item, this.snapshot(ownerId).state, new Date(this.companionNow())));
  }
  companionChallenge(ownerId: string, action: 'create' | 'join' | 'leave', code?: string) {
    const now = new Date(this.companionNow());
    if (action !== 'leave' && !this.transaction(() => this.companion.challengeAttempt(ownerId, now)))
      throw new CompanionError(429, 'CHALLENGE_RATE_LIMIT', 'Too many challenge requests. Try again later.', 3600 - Math.floor(now.getTime() / 1000) % 3600);
    return this.transaction(() => this.companion.challenge(ownerId, action, code, this.snapshot(ownerId).state, now));
  }
  exportCompanion(ownerId: string) {
    return this.transaction(() => this.companion.export(ownerId, this.snapshot(ownerId).state, new Date(this.companionNow())));
  }
}
const attachmentIds = (state: AppState) =>
  new Set([...state.meals, ...state.reports].flatMap(record => record.assetId ? [record.assetId] : []));
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
// Schema parsers and other Forma editors may reorder object fields without changing facts.
const hashValue = (value: unknown) => createHash('sha256').update(JSON.stringify(value, (_key, part) => part && typeof part === 'object' && !Array.isArray(part) ? Object.fromEntries(Object.keys(part).sort().map(key => [key, part[key]])) : part)).digest('hex');
const hashValueBytes = (value: Buffer) => createHash('sha256').update(value).digest('hex');
