import { DatabaseSync } from "node:sqlite";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { AppState, User } from "../src/types";
import { emptyState } from "../src/types";

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
      CREATE INDEX IF NOT EXISTS assets_owner ON assets(owner_id);`);
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
      state: JSON.parse(row.state_json) as AppState,
      revision: row.revision,
    };
  }
  save(ownerId: string, state: AppState, revision: number): boolean {
    return (
      this.db
        .prepare(
          "UPDATE states SET state_json=?,revision=revision+1 WHERE owner_id=? AND revision=?",
        )
        .run(JSON.stringify(state), ownerId, revision).changes === 1
    );
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
