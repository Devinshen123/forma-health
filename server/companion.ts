import { randomBytes, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { AppState } from '../src/types';
import { COMPANION_ITEMS, COMPANION_RULE_VERSION, companionLevel, type CompanionChest, type CompanionItem, type CompanionQuest, type CompanionSnapshot, type CompanionChallenge } from '../src/companion';
import { companionDay, companionFacts, companionLocalDay, companionRecords, type CompanionFact } from './companion-rules';

const QUESTS: readonly CompanionQuest[] = ['nutrition', 'movement', 'sleep'];
interface RewardRow { id: number; utc_day: string; local_day: string; quest: CompanionQuest; rule_version: number; xp: number; source_kind: string; source_id: string; awarded_at: string }
interface ChestRow { id: string; milestone: number; item: CompanionItem | null; opened_at: string | null }
interface ChallengeRow { id: string; code: string; starts_at: string; ends_at: string; revoked_at: string | null }
interface MemberRow { owner_id: string; joined_at: string; after_reward_id: number }
export class CompanionError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) { super(message); }
}

/** Every write is called inside a Store transaction; game state never comes from AppState. */
export class CompanionLedger {
  constructor(private readonly db: DatabaseSync) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS companion_profiles(owner_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,equipped TEXT);
      CREATE TABLE IF NOT EXISTS companion_seen_facts(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,source_kind TEXT NOT NULL,source_id TEXT NOT NULL,first_seen_at TEXT NOT NULL,PRIMARY KEY(owner_id,source_kind,source_id));
      CREATE TABLE IF NOT EXISTS companion_rewards(
        id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        utc_day TEXT NOT NULL,local_day TEXT NOT NULL,quest TEXT NOT NULL CHECK(quest IN ('nutrition','movement','sleep')),
        rule_version INTEGER NOT NULL,xp INTEGER NOT NULL CHECK(xp=10),source_kind TEXT NOT NULL,source_id TEXT NOT NULL,awarded_at TEXT NOT NULL,
        UNIQUE(owner_id,utc_day,quest,rule_version),UNIQUE(owner_id,utc_day,quest),UNIQUE(owner_id,local_day,quest),UNIQUE(owner_id,quest,source_kind,source_id));
      CREATE TABLE IF NOT EXISTS companion_chests(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,milestone INTEGER NOT NULL,item TEXT,opened_at TEXT,UNIQUE(owner_id,milestone));
      CREATE TABLE IF NOT EXISTS companion_challenges(id TEXT PRIMARY KEY,creator_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,code TEXT NOT NULL UNIQUE,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,revoked_at TEXT);
      CREATE TABLE IF NOT EXISTS companion_challenge_members(challenge_id TEXT NOT NULL REFERENCES companion_challenges(id) ON DELETE CASCADE,owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,joined_at TEXT NOT NULL,after_reward_id INTEGER NOT NULL,PRIMARY KEY(challenge_id,owner_id));
      CREATE INDEX IF NOT EXISTS companion_members_owner ON companion_challenge_members(owner_id);
      CREATE TABLE IF NOT EXISTS companion_challenge_attempts(owner_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,window_start INTEGER NOT NULL,attempts INTEGER NOT NULL);
    `);
  }
  /** Observe new saved facts only. Existing data, date edits and time-zone changes never backfill XP. */
  settle(ownerId: string, previous: AppState, state: AppState, now: Date): void {
    const insertSeen = this.db.prepare('INSERT OR IGNORE INTO companion_seen_facts VALUES (?,?,?,?)');
    const identities = this.db.prepare('SELECT source_kind,source_id FROM companion_seen_facts WHERE owner_id=?').all(ownerId) as unknown as { source_kind: string; source_id: string }[];
    const key = (kind: string, id: string) => JSON.stringify([kind, id]);
    const seen = new Set(identities.map(row => key(row.source_kind, row.source_id)));
    const rememberIdentity = (kind: string, id: string) => {
      const identity = key(kind, id);
      if (!seen.has(identity)) { insertSeen.run(ownerId, kind, id, now.toISOString()); seen.add(identity); }
    };
    const remember = (fact: CompanionFact) => {
      rememberIdentity(fact.kind, fact.id);
      if (fact.externalId) rememberIdentity('workout-import', fact.externalId);
    };
    // Seed old identities before comparing the write, including first use after feature rollout.
    for (const fact of companionRecords(previous)) remember(fact);
    const eligible = new Set(companionFacts(state, now).map(fact => `${fact.kind}:${fact.id}`));
    for (const fact of companionRecords(state)) {
      const known = seen.has(key(fact.kind, fact.id)) || (fact.externalId && seen.has(key('workout-import', fact.externalId)));
      remember(fact);
      if (!known && eligible.has(`${fact.kind}:${fact.id}`)) this.grant(ownerId, state, now, fact);
    }
    this.unlockChests(ownerId);
  }
  rest(ownerId: string, state: AppState, now: Date): void {
    this.grant(ownerId, state, now, { quest: 'movement', kind: 'rest', id: companionLocalDay(state, now) });
    this.unlockChests(ownerId);
  }
  private grant(ownerId: string, state: AppState, now: Date, fact: CompanionFact): void {
    const utcDay = companionDay(now), localDay = companionLocalDay(state, now);
    const insert = this.db.prepare('INSERT OR IGNORE INTO companion_rewards(owner_id,utc_day,local_day,quest,rule_version,xp,source_kind,source_id,awarded_at) VALUES (?,?,?,?,?,10,?,?,?)');
    insert.run(ownerId, utcDay, localDay, fact.quest, COMPANION_RULE_VERSION, fact.kind, fact.id, now.toISOString());
  }
  private unlockChests(ownerId: string): void {
    const { days } = this.db.prepare('SELECT COUNT(DISTINCT utc_day) AS days FROM companion_rewards WHERE owner_id=?').get(ownerId) as { days: number };
    const addChest = this.db.prepare('INSERT OR IGNORE INTO companion_chests(id,owner_id,milestone,item,opened_at) VALUES (?,?,?,NULL,NULL)');
    for (let milestone = 3; milestone <= days; milestone += 3) addChest.run(randomUUID(), ownerId, milestone);
  }
  private chests(ownerId: string): CompanionChest[] {
    const rows = this.db.prepare('SELECT id,milestone,item,opened_at FROM companion_chests WHERE owner_id=? ORDER BY milestone').all(ownerId) as unknown as ChestRow[];
    return rows.map(row => ({ id: row.id, milestone: row.milestone, item: row.item, openedAt: row.opened_at }));
  }
  private activeChallenge(ownerId: string, now: Date): ChallengeRow | undefined {
    return this.db.prepare('SELECT c.id,c.code,c.starts_at,c.ends_at,c.revoked_at FROM companion_challenges c JOIN companion_challenge_members m ON m.challenge_id=c.id WHERE m.owner_id=? AND c.revoked_at IS NULL AND c.ends_at>? ORDER BY c.starts_at DESC LIMIT 1').get(ownerId, now.toISOString()) as unknown as ChallengeRow | undefined;
  }
  private displayedChallenge(ownerId: string, now: Date): ChallengeRow | undefined {
    const active = this.activeChallenge(ownerId, now);
    if (active) return active;
    const cutoff = new Date(now.getTime() - 48 * 3600000).toISOString();
    return this.db.prepare('SELECT c.id,c.code,c.starts_at,c.ends_at,c.revoked_at FROM companion_challenges c JOIN companion_challenge_members m ON m.challenge_id=c.id WHERE m.owner_id=? AND c.revoked_at IS NULL AND c.ends_at<=? AND c.ends_at>? ORDER BY c.ends_at DESC,c.starts_at DESC LIMIT 1').get(ownerId, now.toISOString(), cutoff) as unknown as ChallengeRow | undefined;
  }
  private participantDays(challenge: ChallengeRow, member: MemberRow): number {
    const row = this.db.prepare('SELECT COUNT(DISTINCT utc_day) AS days FROM companion_rewards WHERE owner_id=? AND id>? AND awarded_at>=? AND awarded_at<?').get(member.owner_id, member.after_reward_id, challenge.starts_at, challenge.ends_at) as { days: number };
    return row.days;
  }
  private challengeSnapshot(ownerId: string, now: Date): CompanionChallenge | null {
    const challenge = this.displayedChallenge(ownerId, now);
    if (!challenge) return null;
    const members = this.db.prepare('SELECT owner_id,joined_at,after_reward_id FROM companion_challenge_members WHERE challenge_id=? ORDER BY joined_at,owner_id').all(challenge.id) as unknown as MemberRow[];
    return { id: challenge.id, code: challenge.code, startsAt: challenge.starts_at, endsAt: challenge.ends_at,
      participants: members.map(member => ({ self: member.owner_id === ownerId, days: this.participantDays(challenge, member) })).sort((a, b) => Number(b.self) - Number(a.self)) };
  }
  snapshot(ownerId: string, state: AppState, now: Date): CompanionSnapshot {
    const day = companionDay(now), localDay = companionLocalDay(state, now);
    const totals = this.db.prepare('SELECT COALESCE(SUM(xp),0) AS xp,COUNT(DISTINCT utc_day) AS days FROM companion_rewards WHERE owner_id=?').get(ownerId) as { xp: number; days: number };
    const completed = this.db.prepare('SELECT DISTINCT quest FROM companion_rewards WHERE owner_id=? AND (utc_day=? OR local_day=?)').all(ownerId, day, localDay) as unknown as { quest: CompanionQuest }[];
    const profile = this.db.prepare('SELECT equipped FROM companion_profiles WHERE owner_id=?').get(ownerId) as { equipped: CompanionItem | null } | undefined;
    const chests = this.chests(ownerId);
    return { ruleVersion: COMPANION_RULE_VERSION, day, xp: totals.xp, level: companionLevel(totals.xp), activeDays: totals.days,
      equipped: profile?.equipped ?? null, inventory: COMPANION_ITEMS.filter(item => chests.some(chest => chest.item === item)),
      quests: QUESTS.map(id => ({ id, completed: completed.some(row => row.quest === id), xp: 10 })), chests, challenge: this.challengeSnapshot(ownerId, now) };
  }
  openChest(ownerId: string, chestId: string, state: AppState, now: Date): CompanionSnapshot {
    const chest = this.db.prepare('SELECT id,milestone,item,opened_at FROM companion_chests WHERE owner_id=? AND id=?').get(ownerId, chestId) as unknown as ChestRow | undefined;
    if (!chest) throw new CompanionError(404, 'CHEST_NOT_FOUND', 'This chest is not available');
    if (!chest.opened_at) {
      const item = COMPANION_ITEMS[(chest.milestone / 3 - 1) % COMPANION_ITEMS.length];
      this.db.prepare('UPDATE companion_chests SET item=?,opened_at=? WHERE owner_id=? AND id=? AND opened_at IS NULL').run(item, now.toISOString(), ownerId, chestId);
    }
    return this.snapshot(ownerId, state, now);
  }
  equip(ownerId: string, item: CompanionItem | null, state: AppState, now: Date): CompanionSnapshot {
    if (item !== null && !this.db.prepare('SELECT 1 FROM companion_chests WHERE owner_id=? AND item=? AND opened_at IS NOT NULL').get(ownerId, item))
      throw new CompanionError(409, 'ITEM_NOT_OWNED', 'Open the matching milestone chest before equipping this item');
    this.db.prepare('INSERT INTO companion_profiles(owner_id,equipped) VALUES (?,?) ON CONFLICT(owner_id) DO UPDATE SET equipped=excluded.equipped').run(ownerId, item);
    return this.snapshot(ownerId, state, now);
  }
  /** Persist attempt counters in their own transaction, including failed guesses. Leaving is never limited. */
  challengeAttempt(ownerId: string, now: Date): boolean {
    const window = Math.floor(now.getTime() / 3600000) * 3600000;
    this.db.prepare('INSERT INTO companion_challenge_attempts VALUES (?,?,1) ON CONFLICT(owner_id) DO UPDATE SET attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END,window_start=excluded.window_start').run(ownerId, window);
    const row = this.db.prepare('SELECT attempts FROM companion_challenge_attempts WHERE owner_id=?').get(ownerId) as { attempts: number };
    return row.attempts <= 20;
  }
  challenge(ownerId: string, action: 'create' | 'join' | 'leave', code: string | undefined, state: AppState, now: Date): CompanionSnapshot {
    const active = this.activeChallenge(ownerId, now);
    if (action === 'leave') {
      const displayed = active ?? this.displayedChallenge(ownerId, now);
      if (displayed) this.db.prepare('UPDATE companion_challenges SET revoked_at=? WHERE id=?').run(now.toISOString(), displayed.id);
      return this.snapshot(ownerId, state, now);
    }
    if (action === 'create') {
      if (active) return this.snapshot(ownerId, state, now);
      const id = randomUUID(), invite = randomBytes(8).toString('hex').toUpperCase();
      // Seven UTC calendar days, including the creation day. At most seven participation days.
      const end = new Date(`${companionDay(now)}T00:00:00.000Z`); end.setUTCDate(end.getUTCDate() + 7);
      this.db.prepare('INSERT INTO companion_challenges VALUES (?,?,?,?,?,NULL)').run(id, ownerId, invite, now.toISOString(), end.toISOString());
      this.addMember(id, ownerId, now);
      return this.snapshot(ownerId, state, now);
    }
    if (active?.code === code) return this.snapshot(ownerId, state, now);
    if (active) throw new CompanionError(409, 'CHALLENGE_ACTIVE', 'Leave your current challenge before joining another');
    const target = this.db.prepare('SELECT id,code,starts_at,ends_at,revoked_at FROM companion_challenges WHERE code=? AND revoked_at IS NULL AND ends_at>?').get(code ?? '', now.toISOString()) as unknown as ChallengeRow | undefined;
    const count = target && this.db.prepare('SELECT COUNT(*) AS count FROM companion_challenge_members WHERE challenge_id=?').get(target.id) as { count: number } | undefined;
    if (!target || !count || count.count !== 1) throw new CompanionError(404, 'CHALLENGE_UNAVAILABLE', 'This invitation is unavailable');
    this.addMember(target.id, ownerId, now);
    return this.snapshot(ownerId, state, now);
  }
  private addMember(challengeId: string, ownerId: string, now: Date): void {
    const last = this.db.prepare('SELECT COALESCE(MAX(id),0) AS id FROM companion_rewards WHERE owner_id=?').get(ownerId) as { id: number };
    this.db.prepare('INSERT INTO companion_challenge_members VALUES (?,?,?,?)').run(challengeId, ownerId, now.toISOString(), last.id);
  }
  revokeForAccount(ownerId: string, now: Date): void {
    this.db.prepare('UPDATE companion_challenges SET revoked_at=? WHERE revoked_at IS NULL AND id IN (SELECT challenge_id FROM companion_challenge_members WHERE owner_id=?)').run(now.toISOString(), ownerId);
  }
  export(ownerId: string, state: AppState, now: Date) {
    const snapshot = this.snapshot(ownerId, state, now);
    const rewards = this.db.prepare('SELECT id,utc_day,local_day,quest,rule_version,xp,source_kind,source_id,awarded_at FROM companion_rewards WHERE owner_id=? ORDER BY id').all(ownerId) as unknown as RewardRow[];
    const observed = this.db.prepare('SELECT source_kind,source_id,first_seen_at FROM companion_seen_facts WHERE owner_id=? ORDER BY first_seen_at,source_kind,source_id').all(ownerId) as unknown as { source_kind: string; source_id: string; first_seen_at: string }[];
    const challenges = this.db.prepare('SELECT c.id,c.code,c.starts_at,c.ends_at,c.revoked_at,m.joined_at,m.after_reward_id FROM companion_challenges c JOIN companion_challenge_members m ON m.challenge_id=c.id WHERE m.owner_id=? ORDER BY c.starts_at,c.id').all(ownerId) as unknown as (ChallengeRow & MemberRow)[];
    // Never export another participant's identifiers, progress or records.
    return { ruleVersion: snapshot.ruleVersion, xp: snapshot.xp, level: snapshot.level, activeDays: snapshot.activeDays, equipped: snapshot.equipped, inventory: snapshot.inventory, chests: snapshot.chests,
      rewards: rewards.map(row => ({ day: row.utc_day, localDay: row.local_day, quest: row.quest, ruleVersion: row.rule_version, xp: row.xp, sourceKind: row.source_kind, sourceId: row.source_id, awardedAt: row.awarded_at })),
      observedFacts: observed.map(row => ({ sourceKind: row.source_kind, sourceId: row.source_id, firstSeenAt: row.first_seen_at })),
      challenges: challenges.map(row => ({ id: row.id, code: row.code, startsAt: row.starts_at, endsAt: row.ends_at, revokedAt: row.revoked_at, joinedAt: row.joined_at, days: this.participantDays(row, { ...row, owner_id: ownerId }) })) };
  }
}
