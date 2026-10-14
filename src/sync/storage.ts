import type { SyncMutation, SyncSnapshot, User } from '../types';

export interface CachedAccount {
  user: User;
  snapshot: SyncSnapshot;
  queue: SyncMutation[];
  updatedAt: string;
  settled?: string[];
  generation?: string;
}
interface Consent { enabled: boolean; generation: string }
const consentKey = (id: string) => `consent:${id}`;
const validConsent = (value: unknown): value is Consent => !!value && typeof value === 'object' && typeof (value as Consent).enabled === 'boolean' && typeof (value as Consent).generation === 'string' && (value as Consent).generation.length > 0;
const revokedMessage = 'Offline storage permission changed. Enable it again before saving to this device.';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('forma-private-offline-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('accounts', { keyPath: 'user.id' });
      request.result.createObjectStore('meta');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error('Offline storage unavailable'));
  });
}

/** Privacy decisions and queue changes share one transaction with their metadata. */
async function accountTransaction<T>(operation: (accounts: IDBObjectStore, meta: IDBObjectStore, setResult: (value: T) => void, fail: (error: Error) => void) => void, mode: IDBTransactionMode = 'readwrite'): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(['accounts', 'meta'], mode);
      let result: T, failure: Error | undefined;
      const fail = (error: Error) => { failure = error; tx.abort(); };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(failure ?? Error('Offline storage failed'));
      tx.onabort = () => reject(failure ?? Error('Offline storage cancelled'));
      operation(tx.objectStore('accounts'), tx.objectStore('meta'), value => { result = value; }, fail);
    });
  } finally { db.close(); }
}

function visibleRecord(record: CachedAccount | undefined, config: unknown): CachedAccount | undefined {
  if (!record) return undefined;
  // Legacy caches remain readable for explicit migration. A revoked epoch never does.
  if (config === undefined) return record;
  if (!validConsent(config) || !config.enabled || record.generation !== config.generation) return undefined;
  return record;
}

export async function readCached(id: string): Promise<CachedAccount | undefined> {
  return accountTransaction((accounts, meta, done) => {
    const record = accounts.get(id), config = meta.get(consentKey(id));
    let recordReady = false, configReady = false;
    const finish = () => { if (recordReady && configReady) done(visibleRecord(record.result, config.result)); };
    record.onsuccess = () => { recordReady = true; finish(); };
    config.onsuccess = () => { configReady = true; finish(); };
  }, 'readonly');
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}

export async function writeCached(data: CachedAccount, settleIds: string[] = [], grant = false): Promise<CachedAccount> {
  const merged = await accountTransaction<CachedAccount>((accounts, meta, done, fail) => {
    const previousRequest = accounts.get(data.user.id), consentRequest = meta.get(consentKey(data.user.id));
    let previousReady = false, consentReady = false, applied = false;
    const merge = () => {
      if (!previousReady || !consentReady || applied) return;
      applied = true;
      const previous = previousRequest.result as CachedAccount | undefined, config = consentRequest.result as unknown;
      let generation: string;
      if (grant) {
        generation = validConsent(config) && config.enabled ? config.generation : crypto.randomUUID();
        meta.put({ enabled: true, generation } satisfies Consent, consentKey(data.user.id));
      } else {
        if (!validConsent(config) || !config.enabled || data.generation !== config.generation) { fail(Error(revokedMessage)); return; }
        generation = config.generation;
      }
      // A previous epoch cannot inject its receipts or queue into a freshly granted cache.
      const sameEpoch = previous && (previous.generation === generation || (grant && previous.generation === undefined && config === undefined));
      const prior = sameEpoch ? previous : undefined;
      const settled = new Set([...(prior?.settled ?? []), ...settleIds]);
      const priorById = new Map((prior?.queue ?? []).map(batch => [batch.mutationId, batch]));
      const queue = new Map<string, SyncMutation>();
      // Incoming order preserves dependencies after review; unseen tab writes follow it.
      for (const batch of [...data.queue, ...(prior?.queue ?? [])]) {
        if (settled.has(batch.mutationId)) continue;
        const existing = queue.get(batch.mutationId) ?? priorById.get(batch.mutationId);
        if (existing && canonical(existing) !== canonical(batch)) { fail(Error('A pending mutation changed without a new identifier. Review it before saving.')); return; }
        if (!queue.has(batch.mutationId)) queue.set(batch.mutationId, batch);
      }
      const result: CachedAccount = {
        ...data,
        generation,
        snapshot: prior && prior.snapshot.revision > data.snapshot.revision ? prior.snapshot : data.snapshot,
        queue: [...queue.values()], settled: [...settled],
      };
      accounts.put(result);
      meta.put(data.user.id, 'lastAccount');
      done(result);
    };
    previousRequest.onsuccess = () => { previousReady = true; merge(); };
    consentRequest.onsuccess = () => { consentReady = true; merge(); };
  });
  try { localStorage.setItem(`forma-cache-update-${data.user.id}`, crypto.randomUUID()); }
  catch { /* A notification failure cannot undo the private committed transaction. */ }
  return merged;
}

export async function clearCached(id: string, requireEmpty = false): Promise<void> {
  await accountTransaction<void>((accounts, meta, done, fail) => {
    const record = accounts.get(id), last = meta.get('lastAccount');
    let recordReady = false, lastReady = false, applied = false;
    const clear = () => {
      if (!recordReady || !lastReady || applied) return;
      applied = true;
      if (requireEmpty && (record.result as CachedAccount | undefined)?.queue.length) { fail(Error('Sync or export and discard pending changes before disabling offline storage.')); return; }
      accounts.delete(id);
      meta.put({ enabled: false, generation: crypto.randomUUID() } satisfies Consent, consentKey(id));
      if (last.result === id) meta.delete('lastAccount');
      done(undefined);
    };
    record.onsuccess = () => { recordReady = true; clear(); };
    last.onsuccess = () => { lastReady = true; clear(); };
  });
}

export async function readLastCached(): Promise<CachedAccount | undefined> {
  return accountTransaction((accounts, meta, done) => {
    const last = meta.get('lastAccount');
    last.onsuccess = () => {
      if (typeof last.result !== 'string') { done(undefined); return; }
      const record = accounts.get(last.result), config = meta.get(consentKey(last.result));
      let recordReady = false, configReady = false;
      const finish = () => { if (recordReady && configReady) done(visibleRecord(record.result, config.result)); };
      record.onsuccess = () => { recordReady = true; finish(); };
      config.onsuccess = () => { configReady = true; finish(); };
    };
  }, 'readonly');
}
